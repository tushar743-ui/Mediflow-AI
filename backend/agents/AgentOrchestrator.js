// import ConversationAgent from './ConversationAgent.js';
// import SafetyPolicyAgent from './SafetyPolicyAgent.js';
// import PredictiveIntelligenceAgent from './PredictiveIntelligenceAgent.js';
// import ActionExecutionAgent from './ActionExecutionAgent.js';
// import { AgentTracer } from '../config/langfuse.js';
// import { query } from '../config/database.js';

// /**
//  * Agent Orchestrator
//  * Coordinates multi-agent workflow
//  * Routes messages through appropriate agents
//  */
// export class AgentOrchestrator {
//   constructor() {
//     this.conversationAgent = new ConversationAgent();
//     this.safetyAgent = new SafetyPolicyAgent();
//     this.predictiveAgent = new PredictiveIntelligenceAgent();
//     this.actionAgent = new ActionExecutionAgent();
//   }

//   /**
//    * Main entry point for processing user messages
//    */
//   async processUserMessage(userMessage, sessionId, consumerId, conversationHistory = []) {
//     const tracer = new AgentTracer(sessionId, 'orchestrator');
//     const trace = tracer.startTrace('process_user_message');

//     try {
//       console.log(`\n${'='.repeat(80)}`);
//       console.log(`🤖 ORCHESTRATOR: Processing message for consumer ${consumerId}`);
//       console.log(`Message: "${userMessage}"`);
//       console.log(`${'='.repeat(80)}\n`);

//       // Step 1: Extract intent using Conversation Agent
//       console.log('📝 Step 1: Extracting intent...');
//       const intent = await this.conversationAgent.extractIntent(
//         userMessage,
//         conversationHistory,
//         sessionId
//       );

//       console.log('Intent extracted:', intent);

//       tracer.logDecision(
//         'Intent Extracted',
//         `Intent: ${intent.intent}`,
//         intent
//       );

//       // Step 2: Route based on intent
//       let response;

//       switch (intent.intent) {
//         case 'order':
//         case 'refill':
//           response = await this.handleOrderIntent(
//             intent,
//             consumerId,
//             sessionId
//           );
//           break;

//         case 'question':
//           response = await this.handleQuestionIntent(
//             intent,
//             userMessage,
//             sessionId,
//             conversationHistory,
//             tracer
//           );
//           break;

//         case 'greeting':
//           response = await this.handleGreeting(
//             consumerId,
//             sessionId,
//             tracer
//           );
//           break;

//         default:
//           response = await this.handleGenericIntent(
//             intent,
//             userMessage,
//             sessionId,
//             tracer
//           );
//       }

//       // Save conversation
//       await this.saveConversationMessage(sessionId, 'user', userMessage);
//       await this.saveConversationMessage(sessionId, 'assistant', response.message || response.response);

//       await tracer.end({ response });
      
//       // Return normalized response
//       return {
//         message: response.message || response.response,
//         orderCreated: response.orderCreated || false,
//         orderId: response.orderId || null,
//         ...response
//       };

//     } catch (error) {
//       console.error('Error in orchestrator:', error);
//       await tracer.end({ error: error.message }, { status: 'error' });
      
//       return {
//         message: "I apologize, but I encountered an error processing your request. Please try again.",
//         error: error.message
//       };
//     }
//   }

//   /**
//    * Handle order/refill intent
//    */
//   async handleOrderIntent(intent, consumerId, sessionId) {
//     console.log('🛒 Handling order intent...');

//     // Handle multiple medicines
//     if (!intent.medicines || intent.medicines.length === 0) {
//       return {
//         message: "I'd be happy to help you order medicine. Which medication do you need?",
//         requiresAction: false
//       };
//     }

//     // Process all medicines
//     const orderResults = [];
//     const errors = [];

//     for (const medicineRequest of intent.medicines) {
//       try {
//         console.log(`🔍 Processing medicine: ${medicineRequest.name}`);
        
//         // Fuzzy match medicine
//         const matchedMedicine = await this.conversationAgent.fuzzyMatchMedicine(
//           medicineRequest.name
//         );

//         if (!matchedMedicine) {
//           errors.push(`❌ Medicine "${medicineRequest.name}" not found in our inventory`);
//           continue;
//         }

//         console.log(`✅ Medicine matched: ${matchedMedicine.medicine_name} (${matchedMedicine.generic_name})`);

//         // Run safety checks
//         const orderRequest = {
//           medicineId: matchedMedicine.id,
//           quantity: medicineRequest.quantity || 30,
//           dosageFrequency: medicineRequest.dosage_frequency || 'as prescribed'
//         };

//         console.log('🛡️  Running safety checks...');
//         const safetyResult = await this.safetyAgent.evaluateOrderSafety(
//           consumerId,
//           matchedMedicine,
//           orderRequest,
//           sessionId
//         );

//         if (safetyResult.decision === 'APPROVED') {
//           orderResults.push({
//             success: true,
//             medicine: matchedMedicine,
//             orderRequest: orderRequest,
//             safetyResult: safetyResult
//           });
//         } else {
//           errors.push(`❌ ${matchedMedicine.medicine_name}: ${safetyResult.reason}`);
//         }

//       } catch (error) {
//         console.error(`Error processing ${medicineRequest.name}:`, error);
//         errors.push(`❌ Error processing ${medicineRequest.name}`);
//       }
//     }

//     // If no medicines were approved, return errors
//     if (orderResults.length === 0) {
//       return {
//         message: errors.length > 0 
//           ? `I couldn't process your order:\n\n${errors.join('\n')}\n\nPlease let me know if you'd like to try something else.`
//           : "I couldn't find any of the requested medicines. Could you please specify which medications you need?",
//         requiresAction: false
//       };
//     }

//     // Create single order with multiple items
//     console.log(`✅ ${orderResults.length} medicine(s) approved, creating order...`);

//     try {
//       const orderData = {
//         consumerId: consumerId,
//         totalAmount: orderResults.reduce((sum, result) => 
//           sum + (parseFloat(result.medicine.price) * result.orderRequest.quantity), 0
//         ),
//         items: orderResults.map(result => ({
//           medicineId: result.medicine.id,
//           quantity: result.orderRequest.quantity,
//           dosageFrequency: result.orderRequest.dosageFrequency,
//           unitPrice: parseFloat(result.medicine.price)
//         }))
//       };

//       const { order, orderItems } = await this.actionAgent.createOrder(orderData, sessionId);
//       await this.actionAgent.confirmOrderAndAutomate(order.id, sessionId);

//       // Build response message
//       let responseMessage = `✅ Order confirmed! Order #${order.id}\n\n`;
//       responseMessage += `📦 Items:\n`;
      
//       orderResults.forEach((result, index) => {
//         responseMessage += `${index + 1}. ${result.medicine.medicine_name} - ${result.orderRequest.quantity} ${result.medicine.unit_type}\n`;
//       });
      
//       responseMessage += `\n💰 Total: $${order.total_amount}\n\n`;
//       responseMessage += `Your order will be processed shortly. You'll receive a confirmation email.`;

//       // Add any warnings
//       if (errors.length > 0) {
//         responseMessage += `\n\n⚠️ Note: Some items couldn't be added:\n${errors.join('\n')}`;
//       }

//       return {
//         message: responseMessage,
//         requiresAction: false,
//         orderCreated: true,
//         orderId: order.id
//       };

//     } catch (error) {
//       console.error('Error creating order:', error);
//       return {
//         message: `I encountered an error while creating your order: ${error.message}. Please try again.`,
//         requiresAction: false
//       };
//     }
//   }

//   /**
//    * Handle question intent
//    */
//   async handleQuestionIntent(intent, userMessage, sessionId, conversationHistory, tracer) {
//     console.log('❓ Handling question intent...');

//     const context = {
//       type: 'question',
//       question: userMessage,
//       conversationHistory
//     };

//     const response = await this.conversationAgent.generateResponse(context, sessionId);

//     return {
//       message: response,
//       isInformational: true
//     };
//   }

//   /**
//    * Handle greeting
//    */
//   async handleGreeting(consumerId, sessionId, tracer) {
//     console.log('👋 Handling greeting...');

//     // Check for pending proactive alerts
//     const alerts = await this.predictiveAgent.getPendingAlertsForConsumer(consumerId);

//     let greeting = "Hello! How can I help you today?";

//     if (alerts.length > 0) {
//       const alert = alerts[0];
//       greeting = `Hello! I noticed you may be running low on ${alert.medicine_name}. ${alert.alert_message} Would you like to refill it now?`;
      
//       // Mark as sent
//       await this.predictiveAgent.markAlertAsSent(alert.id);
//     }

//     return {
//       message: greeting,
//       proactiveAlert: alerts.length > 0 ? alerts[0] : null
//     };
//   }

//   /**
//    * Handle generic intent
//    */
//   async handleGenericIntent(intent, userMessage, sessionId, tracer) {
//     const response = await this.conversationAgent.generateResponse({
//       type: 'generic',
//       message: userMessage,
//       intent
//     }, sessionId);

//     return {
//       message: response
//     };
//   }

//   /**
//    * Get typical order quantity from history
//    */
//   async getTypicalQuantity(consumerId, medicineName) {
//     try {
//       const result = await query(`
//         SELECT AVG(oi.quantity)::int as typical_quantity
//         FROM order_items oi
//         JOIN orders o ON oi.order_id = o.id
//         JOIN medicines m ON oi.medicine_id = m.id
//         WHERE o.consumer_id = $1
//         AND m.medicine_name = $2
//         AND o.status = 'fulfilled'
//       `, [consumerId, medicineName]);

//       return result.rows[0]?.typical_quantity || null;
//     } catch (error) {
//       console.error('Error getting typical quantity:', error);
//       return null;
//     }
//   }

//   /**
//    * Save conversation message
//    */
//   async saveConversationMessage(sessionId, role, content) {
//     try {
//       await query(`
//         INSERT INTO conversation_messages (session_id, role, content)
//         VALUES ($1, $2, $3)
//       `, [sessionId, role, content]);

//       // Update session message count
//       await query(`
//         UPDATE conversation_sessions 
//         SET message_count = message_count + 1
//         WHERE session_id = $1
//       `, [sessionId]);

//     } catch (error) {
//       console.error('Error saving conversation message:', error);
//     }
//   }

//   /**
//    * Get conversation history
//    */
//   async getConversationHistory(sessionId, limit = 10) {
//     try {
//       const result = await query(`
//         SELECT role, content, created_at
//         FROM conversation_messages
//         WHERE session_id = $1
//         ORDER BY created_at DESC
//         LIMIT $2
//       `, [sessionId, limit]);

//       return result.rows.reverse(); // Return in chronological order
//     } catch (error) {
//       console.error('Error getting conversation history:', error);
//       return [];
//     }
//   }
// }

// export default AgentOrchestrator;








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
            consumerId,
            sessionId
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
      await this.saveConversationMessage(sessionId, 'assistant', response.message || response.response);

      await tracer.end({ response });
      
      // Return normalized response
      return {
        message: response.message || response.response,
        orderCreated: response.orderCreated || false,
        orderId: response.orderId || null,
        ...response
      };

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
  async handleOrderIntent(intent, consumerId, sessionId) {
    console.log('🛒 Handling order intent...');

    // Handle multiple medicines
    if (!intent.medicines || intent.medicines.length === 0) {
      return {
        message: "I'd be happy to help you order medicine. Which medication do you need?",
        requiresAction: false
      };
    }

    // Process all medicines
    const orderResults = [];
    const errors = [];

    for (const medicineRequest of intent.medicines) {
      try {
        console.log(`🔍 Processing medicine: ${medicineRequest.name}`);
        
        // Fuzzy match medicine
        const matchedMedicine = await this.conversationAgent.fuzzyMatchMedicine(
          medicineRequest.name
        );

        if (!matchedMedicine) {
          errors.push(`❌ Medicine "${medicineRequest.name}" not found in our inventory`);
          continue;
        }

        console.log(`✅ Medicine matched: ${matchedMedicine.medicine_name} (${matchedMedicine.generic_name})`);

        // Run safety checks
        const orderRequest = {
          medicineId: matchedMedicine.id,
          quantity: medicineRequest.quantity || 30,
          dosageFrequency: medicineRequest.dosage_frequency || 'as prescribed'
        };

        console.log('🛡️  Running safety checks...');
        const safetyResult = await this.safetyAgent.evaluateOrderSafety(
          consumerId,
          matchedMedicine,
          orderRequest,
          sessionId
        );

        if (safetyResult.decision === 'APPROVED') {
          orderResults.push({
            success: true,
            medicine: matchedMedicine,
            orderRequest: orderRequest,
            safetyResult: safetyResult
          });
        } else {
          errors.push(`❌ ${matchedMedicine.medicine_name}: ${safetyResult.reason}`);
        }

      } catch (error) {
        console.error(`Error processing ${medicineRequest.name}:`, error);
        errors.push(`❌ Error processing ${medicineRequest.name}`);
      }
    }

    // If no medicines were approved, return errors
    if (orderResults.length === 0) {
      return {
        message: errors.length > 0 
          ? `I couldn't process your order:\n\n${errors.join('\n')}\n\nPlease let me know if you'd like to try something else.`
          : "I couldn't find any of the requested medicines. Could you please specify which medications you need?",
        requiresAction: false
      };
    }

    // Create single order with multiple items
    console.log(`✅ ${orderResults.length} medicine(s) approved, creating order...`);

    try {
      const orderData = {
        consumerId: consumerId,
        totalAmount: orderResults.reduce((sum, result) => 
          sum + (parseFloat(result.medicine.price) * result.orderRequest.quantity), 0
        ),
        items: orderResults.map(result => ({
          medicineId: result.medicine.id,
          quantity: result.orderRequest.quantity,
          dosageFrequency: result.orderRequest.dosageFrequency,
          unitPrice: parseFloat(result.medicine.price)
        }))
      };

      const { order, orderItems } = await this.actionAgent.createOrder(orderData, sessionId);
      await this.actionAgent.confirmOrderAndAutomate(order.id, sessionId);

      // Build response message
      let responseMessage = `✅ Order confirmed! Order #${order.id}\n\n`;
      responseMessage += `📦 Items:\n`;
      
      orderResults.forEach((result, index) => {
        responseMessage += `${index + 1}. ${result.medicine.medicine_name} - ${result.orderRequest.quantity} ${result.medicine.unit_type}\n`;
      });
      
      responseMessage += `\n💰 Total: $${order.total_amount}\n\n`;
      responseMessage += `Your order will be processed shortly. You'll receive a confirmation email.`;

      // Add any warnings
      if (errors.length > 0) {
        responseMessage += `\n\n⚠️ Note: Some items couldn't be added:\n${errors.join('\n')}`;
      }

      return {
        message: responseMessage,
        requiresAction: false,
        orderCreated: true,
        orderId: order.id
      };

    } catch (error) {
      console.error('Error creating order:', error);
      return {
        message: `I encountered an error while creating your order: ${error.message}. Please try again.`,
        requiresAction: false
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
   * Handle generic intent
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