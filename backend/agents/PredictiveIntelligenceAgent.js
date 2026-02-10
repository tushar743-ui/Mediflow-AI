import { ChatOpenAI } from '@langchain/openai';
import { AgentTracer } from '../config/langfuse.js';
import { query } from '../config/database.js';
import { differenceInDays, addDays, parseISO } from 'date-fns';

/**
 * Predictive Intelligence Agent
 * Analyzes consumption patterns and proactively initiates refill conversations
 * Works on scheduled basis and event triggers
 */
export class PredictiveIntelligenceAgent {
  constructor() {
    this.model = new ChatOpenAI({
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze all consumers and predict refill needs
   * This runs on a schedule (e.g., daily at 9 AM)
   */
  async analyzeAllConsumersForRefills(sessionId = 'prediction-batch') {
    const tracer = new AgentTracer(sessionId, 'predictive_intelligence');
    const trace = tracer.startTrace('analyze_all_consumers');

    try {
      console.log('🔮 Starting predictive refill analysis...');

      // Get all active consumers with order history
      const consumersResult = await query(`
        SELECT DISTINCT c.id, c.name, c.email, c.phone
        FROM consumers c
        JOIN orders o ON c.id = o.consumer_id
        WHERE o.order_date > NOW() - INTERVAL '6 months'
      `);

      const consumers = consumersResult.rows;
      console.log(`Found ${consumers.length} active consumers to analyze`);

      const predictions = [];

      for (const consumer of consumers) {
        const consumerPredictions = await this.predictRefillsForConsumer(
          consumer.id,
          sessionId,
          tracer
        );
        predictions.push(...consumerPredictions);
      }

      console.log(`Generated ${predictions.length} refill predictions`);

      // Create proactive alerts for predictions
      await this.createProactiveAlerts(predictions, tracer);

      await tracer.end({ 
        totalConsumers: consumers.length,
        totalPredictions: predictions.length,
        predictions 
      });

      return predictions;

    } catch (error) {
      console.error('Error in predictive analysis:', error);
      await tracer.end({ error: error.message }, { status: 'error' });
      throw error;
    }
  }

  /**
   * Predict refills for a specific consumer
   */
  async predictRefillsForConsumer(consumerId, sessionId, parentTracer = null) {
    const tracer = parentTracer || new AgentTracer(sessionId, 'predictive_intelligence');
    
    if (!parentTracer) {
      tracer.startTrace('predict_consumer_refills');
    }

    const span = tracer.addSpan('analyze_consumer_history', { consumerId });

    try {
      // Get consumer's order history
      const historyResult = await query(`
        SELECT 
          oi.medicine_id,
          m.medicine_name,
          m.unit_type,
          oi.quantity,
          oi.dosage_frequency,
          o.order_date,
          m.prescription_required
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN medicines m ON oi.medicine_id = m.id
        WHERE o.consumer_id = $1
        AND o.status = 'fulfilled'
        ORDER BY m.medicine_name, o.order_date DESC
      `, [consumerId]);

      const orderHistory = historyResult.rows;

      if (orderHistory.length === 0) {
        span.end({ output: 'No order history' });
        return [];
      }

      // Group by medicine
      const medicineGroups = {};
      orderHistory.forEach(order => {
        if (!medicineGroups[order.medicine_id]) {
          medicineGroups[order.medicine_id] = [];
        }
        medicineGroups[order.medicine_id].push(order);
      });

      const predictions = [];

      // Analyze each medicine
      for (const [medicineId, orders] of Object.entries(medicineGroups)) {
        const prediction = await this.analyzeMedicineConsumption(
          consumerId,
          orders,
          tracer
        );

        if (prediction && prediction.shouldAlert) {
          predictions.push(prediction);
        }
      }

      span.end({ output: { predictionsCount: predictions.length } });

      if (!parentTracer) {
        await tracer.end({ predictions });
      }

      return predictions;

    } catch (error) {
      console.error(`Error predicting refills for consumer ${consumerId}:`, error);
      span.end({ output: { error: error.message } });
      
      if (!parentTracer) {
        await tracer.end({ error: error.message }, { status: 'error' });
      }
      
      return [];
    }
  }

  /**
   * Analyze consumption pattern for a specific medicine
   */
  async analyzeMedicineConsumption(consumerId, orders, tracer) {
    if (orders.length < 2) {
      // Not enough data to predict
      return null;
    }

    // Sort by date (newest first)
    orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

    const mostRecent = orders[0];
    const secondRecent = orders[1];

    // Calculate consumption rate
    const daysBetweenOrders = differenceInDays(
      new Date(mostRecent.order_date),
      new Date(secondRecent.order_date)
    );

    const averageQuantity = orders.slice(0, 3).reduce((sum, o) => sum + o.quantity, 0) / Math.min(3, orders.length);

    // Calculate expected depletion
    const expectedDepletionDate = addDays(new Date(mostRecent.order_date), daysBetweenOrders);
    const daysUntilDepletion = differenceInDays(expectedDepletionDate, new Date());

    // Use LLM to decide if we should alert
    const shouldAlert = await this.decideIfShouldAlert(
      {
        medicineName: mostRecent.medicine_name,
        daysUntilDepletion,
        daysBetweenOrders,
        averageQuantity,
        lastOrderDate: mostRecent.order_date,
        dosageFrequency: mostRecent.dosage_frequency,
        prescriptionRequired: mostRecent.prescription_required
      },
      tracer
    );

    if (!shouldAlert.alert) {
      return null;
    }

    const prediction = {
      consumerId,
      medicineId: mostRecent.medicine_id,
      medicineName: mostRecent.medicine_name,
      expectedDepletionDate,
      daysUntilDepletion,
      recommendedQuantity: Math.ceil(averageQuantity),
      confidence: this.calculateConfidence(orders.length, daysBetweenOrders),
      shouldAlert: true,
      alertMessage: shouldAlert.message,
      alertUrgency: shouldAlert.urgency
    };

    // Log to database
    await query(`
      INSERT INTO consumption_history 
      (consumer_id, medicine_id, purchase_date, quantity, dosage_frequency, expected_depletion_date)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      consumerId,
      mostRecent.medicine_id,
      mostRecent.order_date,
      mostRecent.quantity,
      mostRecent.dosage_frequency,
      expectedDepletionDate
    ]);

    tracer.logDecision(
      'Refill Prediction',
      `${mostRecent.medicine_name} - ${daysUntilDepletion} days until depletion`,
      prediction
    );

    return prediction;
  }

  /**
   * Use LLM to decide if we should send an alert
   */
  async decideIfShouldAlert(medicineData, tracer) {
    const systemPrompt = `You are a predictive healthcare assistant. Decide if we should send a refill reminder based on consumption patterns.

Medicine: ${medicineData.medicineName}
Days until expected depletion: ${medicineData.daysUntilDepletion}
Typical refill interval: ${medicineData.daysBetweenOrders} days
Last order: ${medicineData.lastOrderDate}
Dosage: ${medicineData.dosageFrequency}
Prescription required: ${medicineData.prescriptionRequired}

Consider:
- Alert if depletion is within 7 days
- For prescription medicines, alert earlier (10 days) to allow time for prescription renewal
- Don't alert if recently ordered (within 3 days)
- Urgent if depletion is within 3 days

Return JSON:
{
  "alert": true/false,
  "urgency": "low|medium|high",
  "message": "conversational reminder message",
  "reasoning": "why this decision was made"
}`;

    try {
      const response = await this.model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Should we send an alert?' }
      ]);

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      const decision = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        alert: medicineData.daysUntilDepletion <= 7,
        urgency: 'medium',
        message: `You may be running low on ${medicineData.medicineName}. Would you like to order a refill?`,
        reasoning: 'Default alert logic applied'
      };

      return decision;

    } catch (error) {
      console.error('Error in alert decision:', error);
      return {
        alert: false,
        urgency: 'low',
        message: '',
        reasoning: 'Error in decision making'
      };
    }
  }

  /**
   * Calculate confidence score based on data quality
   */
  calculateConfidence(orderCount, daysBetweenOrders) {
    let confidence = 0.5; // Base confidence

    // More orders = higher confidence
    if (orderCount >= 5) confidence += 0.3;
    else if (orderCount >= 3) confidence += 0.2;
    else confidence += 0.1;

    // Consistent interval = higher confidence
    if (daysBetweenOrders > 20 && daysBetweenOrders < 40) {
      confidence += 0.2; // Monthly refills are very predictable
    } else if (daysBetweenOrders > 80 && daysBetweenOrders < 100) {
      confidence += 0.15; // Quarterly refills
    }

    return Math.min(confidence, 0.95);
  }

  /**
   * Create proactive alerts in the database
   */
  async createProactiveAlerts(predictions, tracer) {
    for (const prediction of predictions) {
      try {
        await query(`
          INSERT INTO proactive_alerts 
          (consumer_id, medicine_id, alert_type, alert_message, triggered_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT DO NOTHING
        `, [
          prediction.consumerId,
          prediction.medicineId,
          'refill_reminder',
          prediction.alertMessage
        ]);

        tracer.logToolCall(
          'create_alert',
          { consumerId: prediction.consumerId, medicine: prediction.medicineName },
          { success: true }
        );

      } catch (error) {
        console.error('Error creating proactive alert:', error);
      }
    }
  }

  /**
   * Get pending alerts for a consumer
   */
  async getPendingAlertsForConsumer(consumerId) {
    const result = await query(`
      SELECT 
        pa.*,
        m.medicine_name,
        m.prescription_required
      FROM proactive_alerts pa
      JOIN medicines m ON pa.medicine_id = m.id
      WHERE pa.consumer_id = $1
      AND pa.sent = false
      AND pa.triggered_at > NOW() - INTERVAL '7 days'
      ORDER BY pa.triggered_at DESC
    `, [consumerId]);

    return result.rows;
  }

  /**
   * Mark alert as sent
   */
  async markAlertAsSent(alertId) {
    await query(`
      UPDATE proactive_alerts 
      SET sent = true 
      WHERE id = $1
    `, [alertId]);
  }
}

export default PredictiveIntelligenceAgent;
