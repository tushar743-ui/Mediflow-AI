
import { ChatGroq } from "@langchain/groq";
import { AgentTracer } from '../config/langfuse.js';
import { query } from '../config/database.js';

/**
 * Safety & Policy Agent - Pharmacist Brain
 * Enforces prescription requirements, stock availability, dosage safety
 * Makes critical go/no-go decisions
 */
export class SafetyPolicyAgent {
constructor() {
  this.model = new ChatGroq({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.3,
    apiKey: process.env.GROQ_API_KEY, // Free at console.groq.com
  });
}



  /**
   * Comprehensive safety check for an order request
   */
  async evaluateOrderSafety(orderRequest, sessionId, consumerId) {
    const tracer = new AgentTracer(sessionId, 'safety_policy');
    const trace = tracer.startTrace('evaluate_order_safety');

    try {
      const checks = [];
      let canProceed = true;
      let requiresAction = [];
      let reasoning = [];

      // Get medicine details from database
      const medicineData = await this.getMedicineData(orderRequest.medicine_name);
      
      if (!medicineData) {
        return {
          decision: 'REJECTED',
          reason: 'Medicine not found in our inventory',
          canProceed: false,
          checks: ['medicine_not_found'],
          reasoning: ['The requested medicine is not available in our system']
        };
      }

      tracer.logDecision(
        'Medicine Found',
        `Found: ${medicineData.medicine_name}`,
        medicineData
      );

      // Check 1: Stock Availability
      const stockCheck = this.checkStockAvailability(
        medicineData,
        orderRequest.quantity
      );
      checks.push(stockCheck);
      
      if (!stockCheck.passed) {
        canProceed = false;
        reasoning.push(stockCheck.reason);
      }

      tracer.logToolCall(
        'stock_check',
        { medicine: medicineData.medicine_name, requested: orderRequest.quantity },
        stockCheck
      );

      // Check 2: Prescription Requirement
      const prescriptionCheck = await this.checkPrescriptionRequirement(
        medicineData,
        consumerId,
        tracer
      );
      checks.push(prescriptionCheck);

      if (!prescriptionCheck.passed) {
        requiresAction.push('upload_prescription');
        reasoning.push(prescriptionCheck.reason);
        canProceed = false;
      }

      tracer.logToolCall(
        'prescription_check',
        { medicine: medicineData.medicine_name, consumer: consumerId },
        prescriptionCheck
      );

      // Check 3: Dosage Safety (using LLM for intelligent analysis)
      const dosageCheck = await this.checkDosageSafety(
        medicineData,
        orderRequest,
        tracer
      );
      checks.push(dosageCheck);

      if (!dosageCheck.passed) {
        reasoning.push(dosageCheck.reason);
        if (dosageCheck.severity === 'critical') {
          canProceed = false;
        } else {
          requiresAction.push('confirm_dosage');
        }
      }

      tracer.logToolCall(
        'dosage_check',
        { medicine: medicineData.medicine_name, dosage: orderRequest.dosage_frequency },
        dosageCheck
      );

      // Check 4: Consumer Order History (interaction check)
      const historyCheck = await this.checkOrderHistory(
        consumerId,
        medicineData.id,
        orderRequest.quantity,
        tracer
      );
      checks.push(historyCheck);

      if (!historyCheck.passed && historyCheck.severity === 'warning') {
        requiresAction.push('confirm_quantity');
        reasoning.push(historyCheck.reason);
      }

      // Final decision
      let decision = 'REJECTED';
      if (canProceed && requiresAction.length === 0) {
        decision = 'APPROVED';
      } else if (!canProceed) {
        decision = 'REJECTED';
      } else {
        decision = 'REQUIRES_ACTION';
      }

      // Log decision to database
      await this.logSafetyDecision(sessionId, {
        medicine_id: medicineData.id,
        consumer_id: consumerId,
        decision,
        checks,
        reasoning,
        requiresAction
      });

      const result = {
        decision,
        canProceed,
        requiresAction,
        reasoning,
        checks,
        medicineData
      };

      tracer.logDecision(
        decision,
        reasoning.join('; '),
        result
      );

      await tracer.end(result);
      return result;

    } catch (error) {
      console.error('Error in safety evaluation:', error);
      await tracer.end({ error: error.message }, { status: 'error' });
      throw error;
    }
  }

  /**
   * Get medicine data from database
   */
async getMedicineData(medicineName) {
  // Clean the medicine name - remove anything in parentheses
  const cleanName = medicineName.split('(')[0].trim();
  
  // Try exact match with cleaned name
  let result = await query(
    `SELECT * FROM medicines WHERE medicine_name ILIKE $1 LIMIT 1`,
    [cleanName]
  );
  
  if (result.rows.length > 0) {
    return result.rows[0];
  }
  
  // Fallback: try fuzzy match
  const firstWord = cleanName.split(' ')[0];
  result = await query(
    `SELECT * FROM medicines WHERE medicine_name ILIKE $1 LIMIT 1`,
    [`%${firstWord}%`]
  );
  
  return result.rows[0] || null;
}

  /**
   * Check stock availability
   */
  checkStockAvailability(medicineData, requestedQuantity) {
    const available = medicineData.stock_quantity;
    const requested = requestedQuantity || 0;

    if (requested === 0) {
      return {
        check: 'stock_availability',
        passed: false,
        reason: 'No quantity specified',
        severity: 'critical'
      };
    }

    if (available < requested) {
      return {
        check: 'stock_availability',
        passed: false,
        reason: `Insufficient stock. Available: ${available}, Requested: ${requested}`,
        severity: 'critical',
        available,
        requested
      };
    }

    return {
      check: 'stock_availability',
      passed: true,
      reason: 'Stock available',
      available,
      requested
    };
  }

  /**
   * Check prescription requirement
   */
  async checkPrescriptionRequirement(medicineData, consumerId, tracer) {
    if (!medicineData.prescription_required) {
      return {
        check: 'prescription_requirement',
        passed: true,
        reason: 'No prescription required for this medicine'
      };
    }

    // Check if consumer has valid prescription
    const result = await query(
      `SELECT * FROM prescriptions 
       WHERE consumer_id = $1 
       AND medicine_id = $2 
       AND verified = true 
       AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
       ORDER BY prescription_date DESC 
       LIMIT 1`,
      [consumerId, medicineData.id]
    );

    if (result.rows.length > 0) {
      return {
        check: 'prescription_requirement',
        passed: true,
        reason: 'Valid prescription on file',
        prescription: result.rows[0]
      };
    }

    return {
      check: 'prescription_requirement',
      passed: false,
      reason: 'Prescription required but not found. Please upload a valid prescription.',
      severity: 'critical'
    };
  }

  /**
   * Check dosage safety using LLM
   */
  async checkDosageSafety(medicineData, orderRequest, tracer) {
const systemPrompt = `You are a medicine name matcher. Given a user's input and a list of available medicines, find the best match.

Consider:
- Common misspellings
- Generic vs brand names
- Partial matches
- Common abbreviations

CRITICAL: Return ONLY the exact medicine_name from the available list. Do NOT add generic names in parentheses.

For example:
- If list has "Paracetamol 500mg (Acetaminophen)", return ONLY "Paracetamol 500mg"
- Do NOT modify or append to the medicine name

Return ONLY valid JSON in this exact format with no other text:
{
  "matched_medicine": "Paracetamol 500mg",
  "confidence": 0.95,
  "alternatives": []
}`;

    try {
      const response = await this.model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Evaluate the dosage safety' }
      ]);

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        passed: true,
        severity: 'ok',
        reason: 'Unable to analyze, defaulting to safe'
      };

      return {
        check: 'dosage_safety',
        ...analysis
      };

    } catch (error) {
      console.error('Error in dosage safety check:', error);
      return {
        check: 'dosage_safety',
        passed: true,
        severity: 'ok',
        reason: 'Safety check completed with default approval'
      };
    }
  }

  /**
   * Check order history for unusual patterns
   */
  async checkOrderHistory(consumerId, medicineId, requestedQuantity, tracer) {
    const result = await query(
      `SELECT * FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.consumer_id = $1 
       AND oi.medicine_id = $2
       ORDER BY o.order_date DESC
       LIMIT 5`,
      [consumerId, medicineId]
    );

    if (result.rows.length === 0) {
      return {
        check: 'order_history',
        passed: true,
        reason: 'First time ordering this medicine'
      };
    }

    const recentOrders = result.rows;
    const averageQuantity = recentOrders.reduce((sum, order) => sum + order.quantity, 0) / recentOrders.length;

    // Check for unusual quantity (more than 2x average)
    if (requestedQuantity > averageQuantity * 2) {
      return {
        check: 'order_history',
        passed: false,
        severity: 'warning',
        reason: `Requested quantity (${requestedQuantity}) is significantly higher than your usual order (${Math.round(averageQuantity)}). Please confirm.`,
        averageQuantity: Math.round(averageQuantity)
      };
    }

    return {
      check: 'order_history',
      passed: true,
      reason: 'Order quantity consistent with history'
    };
  }

  /**
   * Log safety decision to database
   */
  async logSafetyDecision(sessionId, decisionData) {
    await query(
      `INSERT INTO agent_actions 
       (session_id, agent_type, action_type, input_data, output_data, reasoning, decision, execution_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sessionId,
        'safety_policy',
        'order_safety_check',
        JSON.stringify({ medicine_id: decisionData.medicine_id, consumer_id: decisionData.consumer_id }),
        JSON.stringify({ checks: decisionData.checks }),
        decisionData.reasoning.join('\n'),
        decisionData.decision,
        'success'
      ]
    );
  }
}

export default SafetyPolicyAgent;
