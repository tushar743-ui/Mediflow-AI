import ConversationAgent from './ConversationAgent.js';
import SafetyPolicyAgent from './SafetyPolicyAgent.js';
import PredictiveIntelligenceAgent from './PredictiveIntelligenceAgent.js';
import ActionExecutionAgent from './ActionExecutionAgent.js';
import { AgentTracer } from '../config/langfuse.js';
import { query } from '../config/database.js';

/**
 * Agent Orchestrator
 * Coordinates multi-agent workflow
 * Routes messages through appropriate agents
 */
export class AgentOrchestrator {
  constructor() {
    this.conversationAgent = new ConversationAgent();
    this.safetyAgent = new SafetyPolicyAgent();
    this.predictiveAgent = new PredictiveIntelligenceAgent();
    this.actionAgent = new ActionExecutionAgent();
  }

  /**
   * Main entry point for processing user messages
   */
  async processUserMessage(userMessage, sessionId, consumerId, conversationHistory = []) {
    const tracer = new AgentTracer(sessionId, 'orchestrator');
    const trace = tracer.startTrace('process_user_message');

    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🤖 ORCHESTRATOR: Processing message for consumer ${consumerId}`);
      console.log(`Message: "${userMessage}"`);
      console.log(`${'='.repeat(80)}\n`);

      // Step 1: Extract intent using Conversation Agent
      console.log('📝 Step 1: Extracting intent...');
      const intent = await this.conversationAgent.extractIntent(
        userMessage,
        conversationHistory,
        sessionId
      );

      console.log('Intent extracted:', intent);

      tracer.logDecision(
        'Intent Extracted',
        `Intent: ${intent.intent}`,
        intent
      );

      // Step 2: Route based on intent
      let response;

      switch (intent.intent) {
        case 'order':
        case 'refill':
          response = await this.handleOrderIntent(
            intent,
            userMessage,
            sessionId,
            consumerId,
            conversationHistory,
            tracer
          );
          break;

        case 'question':
          response = await this.handleQuestionIntent(
            intent,
            userMessage,
            sessionId,
            conversationHistory,
            tracer
          );
          break;

        case 'greeting':
          response = await this.handleGreeting(
            consumerId,
            sessionId,
            tracer
          );
          break;

        default:
          response = await this.handleGenericIntent(
            intent,
            userMessage,
            sessionId,
            tracer
          );
      }

      // Save conversation
      await this.saveConversationMessage(sessionId, 'user', userMessage);
      await this.saveConversationMessage(sessionId, 'assistant', response.message);

      await tracer.end({ response });
      return response;

    } catch (error) {
      console.error('Error in orchestrator:', error);
      await tracer.end({ error: error.message }, { status: 'error' });
      
      return {
        message: "I apologize, but I encountered an error processing your request. Please try again.",
        error: error.message
      };
    }
  }

  /**
   * Handle order/refill intent
   */
  async handleOrderIntent(intent, userMessage, sessionId, consumerId, conversationHistory, tracer) {
    console.log('🛒 Handling order intent...');

    // Check if we need clarification
    if (intent.clarification_needed && intent.clarification_needed.length > 0) {
      const clarificationMessage = await this.conversationAgent.generateResponse({
        type: 'clarification',
        questions: intent.clarification_needed,
        context: userMessage
      }, sessionId);

      return {
        message: clarificationMessage,
        requiresClarification: true,
        intent
      };
    }

    // Extract medicine information
    if (!intent.medicines || intent.medicines.length === 0) {
      return {
        message: "I'd be happy to help you order medication. Could you please tell me which medicine you need?",
        requiresClarification: true
      };
    }

    // Fuzzy match medicine
    const medicineName = intent.medicines[0].name;
    console.log(`🔍 Fuzzy matching medicine: ${medicineName}`);
    
    const medicineMatch = await this.conversationAgent.fuzzyMatchMedicine(
  medicineName,
  sessionId
);

// Check if clarification needed for dosage
if (medicineMatch.needs_clarification && medicineMatch.alternatives.length > 0) {
  return {
    message: `We have multiple options for ${medicineName}:\n${medicineMatch.alternatives.map((m, i) => `${i+1}. ${m}`).join('\n')}\n\nWhich one would you like?`,
    requiresClarification: true,
    alternatives: medicineMatch.alternatives
  };
}

    if (!medicineMatch.matched_medicine || medicineMatch.confidence < 0.6) {
      return {
        message: `I couldn't find "${medicineName}" in our inventory. Could you please check the spelling or try a different name? ${
          medicineMatch.alternatives && medicineMatch.alternatives.length > 0 
            ? `Did you mean: ${medicineMatch.alternatives.join(', ')}?` 
            : ''
        }`,
        requiresClarification: true
      };
    }

    console.log(`✅ Medicine matched: ${medicineMatch.matched_medicine}`);

    // If quantity not specified, ask
    if (!intent.quantity) {
      // Try to get from history
      const historyQuantity = await this.getTypicalQuantity(
        consumerId,
        medicineMatch.matched_medicine
      );

      if (historyQuantity) {
        return {
          message: `Would you like to order ${historyQuantity} ${medicineMatch.matched_medicine}, same as your usual order?`,
          suggestedOrder: {
            medicine: medicineMatch.matched_medicine,
            quantity: historyQuantity
          },
          requiresConfirmation: true
        };
      } else {
        return {
          message: `How many ${medicineMatch.matched_medicine} would you like to order?`,
          requiresClarification: true,
          partialOrder: {
            medicine: medicineMatch.matched_medicine
          }
        };
      }
    }

    // Run safety check
    console.log('🛡️  Running safety checks...');
    const safetyCheck = await this.safetyAgent.evaluateOrderSafety(
      {
        medicine_name: medicineMatch.matched_medicine,
        quantity: intent.quantity,
        dosage_frequency: intent.dosage_frequency
      },
      sessionId,
      consumerId
    );

    tracer.logDecision(
      'Safety Check Complete',
      safetyCheck.decision,
      safetyCheck
    );

    // Handle safety decision
    if (safetyCheck.decision === 'APPROVED') {
      // Create the order
      console.log('✅ Order approved, creating...');
      
      const orderResult = await this.createOrderFromIntent(
        consumerId,
        safetyCheck.medicineData,
        intent,
        sessionId,
        tracer
      );

      return {
        message: `Perfect! I've placed your order for ${intent.quantity} ${medicineMatch.matched_medicine}. Your order number is #${orderResult.order.id}. You'll receive a confirmation shortly!`,
        orderCreated: true,
        order: orderResult.order,
        orderItems: orderResult.orderItems
      };

    } else if (safetyCheck.decision === 'REQUIRES_ACTION') {
      const reasons = safetyCheck.reasoning.join(' ');
      const actions = safetyCheck.requiresAction.join(', ');
      
      return {
        message: `Before I can process your order: ${reasons} Please ${actions}.`,
        requiresAction: safetyCheck.requiresAction,
        reasoning: safetyCheck.reasoning
      };

    } else {
      // REJECTED
      const reasons = safetyCheck.reasoning.join(' ');
      
      return {
        message: `I'm unable to process this order. ${reasons}`,
        orderRejected: true,
        reasoning: safetyCheck.reasoning
      };
    }
  }

  /**
   * Handle question intent
   */
  async handleQuestionIntent(intent, userMessage, sessionId, conversationHistory, tracer) {
    console.log('❓ Handling question intent...');

    const context = {
      type: 'question',
      question: userMessage,
      conversationHistory
    };

    const response = await this.conversationAgent.generateResponse(context, sessionId);

    return {
      message: response,
      isInformational: true
    };
  }

  /**
   * Handle greeting
   */
  async handleGreeting(consumerId, sessionId, tracer) {
    console.log('👋 Handling greeting...');

    // Check for pending proactive alerts
    const alerts = await this.predictiveAgent.getPendingAlertsForConsumer(consumerId);

    let greeting = "Hello! How can I help you today?";

    if (alerts.length > 0) {
      const alert = alerts[0];
      greeting = `Hello! I noticed you may be running low on ${alert.medicine_name}. ${alert.alert_message} Would you like to refill it now?`;
      
      // Mark as sent
      await this.predictiveAgent.markAlertAsSent(alert.id);
    }

    return {
      message: greeting,
      proactiveAlert: alerts.length > 0 ? alerts[0] : null
    };
  }


  /**
   * 
   * uheneric intent
   */
  async handleGenericIntent(intent, userMessage, sessionId, tracer) {
    const response = await this.conversationAgent.generateResponse({
      type: 'generic',
      message: userMessage,
      intent
    }, sessionId);

    return {
      message: response
    };
  }

  /**
   * Create order from validated intent
   */
  async createOrderFromIntent(consumerId, medicineData, intent, sessionId, tracer) {
    const orderData = {
      consumerId,
      totalAmount: medicineData.price * intent.quantity,
      items: [{
        medicineId: medicineData.id,
        quantity: intent.quantity,
        dosageFrequency: intent.dosage_frequency || 'as directed',
        unitPrice: medicineData.price
      }]
    };

    // Create order
    const result = await this.actionAgent.createOrder(orderData, sessionId);

    // Trigger automation
    await this.actionAgent.confirmOrderAndAutomate(result.order.id, sessionId);

    return result;
  }




  /**
   * Get typical order quantity from history
   */
  async getTypicalQuantity(consumerId, medicineName) {
    try {
      const result = await query(`
        SELECT AVG(oi.quantity)::int as typical_quantity
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN medicines m ON oi.medicine_id = m.id
        WHERE o.consumer_id = $1
        AND m.medicine_name = $2
        AND o.status = 'fulfilled'
      `, [consumerId, medicineName]);

      return result.rows[0]?.typical_quantity || null;
    } catch (error) {
      console.error('Error getting typical quantity:', error);
      return null;
    }
  }



  /**
   * Save conversation message
   */
  async saveConversationMessage(sessionId, role, content) {
    try {
      await query(`
        INSERT INTO conversation_messages (session_id, role, content)
        VALUES ($1, $2, $3)
      `, [sessionId, role, content]);

      // Update session message count
      await query(`
        UPDATE conversation_sessions 
        SET message_count = message_count + 1
        WHERE session_id = $1
      `, [sessionId]);

    } catch (error) {
      console.error('Error saving conversation message:', error);
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(sessionId, limit = 10) {
    try {
      const result = await query(`
        SELECT role, content, created_at
        FROM conversation_messages
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [sessionId, limit]);

      return result.rows.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }
}

export default AgentOrchestrator;
