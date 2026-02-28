// import ConversationAgent from './ConversationAgent.js';
// import SafetyPolicyAgent from './SafetyPolicyAgent.js';
// import PredictiveIntelligenceAgent from './PredictiveIntelligenceAgent.js';
// import ActionExecutionAgent from './ActionExecutionAgent.js';
// import { AgentTracer } from '../config/langfuse.js';
// import { query } from '../config/database.js';

// export class AgentOrchestrator {
//   constructor() {
//     this.conversationAgent = new ConversationAgent();
//     this.safetyAgent = new SafetyPolicyAgent();
//     this.predictiveAgent = new PredictiveIntelligenceAgent();
//     this.actionAgent = new ActionExecutionAgent();
//   }

//   async processUserMessage(userMessage, sessionId, consumerId, conversationHistory = [], customerEmail = null) {
//     const tracer = new AgentTracer(sessionId, 'orchestrator');
//     const trace = tracer.startTrace('process_user_message');

//     try {
//       console.log(`\n${'='.repeat(80)}`);
//       console.log(`🤖 ORCHESTRATOR: Processing message for consumer ${consumerId}`);
//       console.log(`Message: "${userMessage}"`);
//       console.log(`Customer Email: ${customerEmail || 'not provided'}`);
//       console.log(`${'='.repeat(80)}\n`);

//       console.log('📝 Step 1: Extracting intent...');
//       const intent = await this.conversationAgent.extractIntent(
//         userMessage,
//         conversationHistory,
//         sessionId
//       );

//       console.log('Intent extracted:', intent);
//       tracer.logDecision('Intent Extracted', `Intent: ${intent.intent}`, intent);

//       let response;

//       switch (intent.intent) {
//         case 'order':
//         case 'refill':
//           response = await this.handleOrderIntent(
//             intent,
//             consumerId,
//             sessionId,
//             customerEmail   // ← pass email down
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
//           response = await this.handleGreeting(consumerId, sessionId, tracer);
//           break;

//         default:
//           response = await this.handleGenericIntent(intent, userMessage, sessionId, tracer);
//       }

//       await this.saveConversationMessage(sessionId, 'user', userMessage);
//       await this.saveConversationMessage(sessionId, 'assistant', response.message || response.response);

//       await tracer.end({ response });

//       return {
//         message: response.message || response.response,
//         orderCreated: response.orderCreated || false,
//         orderId: response.orderId || null,
//         orderDetails: response.orderDetails || null,   // ← for payment modal
//         needsPayment: response.needsPayment || false,  // ← for payment modal
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

//   async handleOrderIntent(intent, consumerId, sessionId, customerEmail = null) {
//     console.log('🛒 Handling order intent...');

//     if (!intent.medicines || intent.medicines.length === 0) {
//       return {
//         message: "I'd be happy to help you order medicine. Which medication do you need?",
//         requiresAction: false
//       };
//     }

//     const orderResults = [];
//     const errors = [];

//     for (const medicineRequest of intent.medicines) {
//       try {
//         console.log(`🔍 Processing medicine: ${medicineRequest.name}`);

//         const matchedMedicine = await this.conversationAgent.fuzzyMatchMedicine(
//           medicineRequest.name
//         );

//         if (!matchedMedicine) {
//           errors.push(`❌ Medicine "${medicineRequest.name}" not found in our inventory`);
//           continue;
//         }

//         console.log(`✅ Medicine matched: ${matchedMedicine.medicine_name} (${matchedMedicine.generic_name})`);

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
//             orderRequest,
//             safetyResult
//           });
//         } else {
//           errors.push(`❌ ${matchedMedicine.medicine_name}: ${safetyResult.reason}`);
//         }

//       } catch (error) {
//         console.error(`Error processing ${medicineRequest.name}:`, error);
//         errors.push(`❌ Error processing ${medicineRequest.name}`);
//       }
//     }

//     if (orderResults.length === 0) {
//       return {
//         message: errors.length > 0
//           ? `I couldn't process your order:\n\n${errors.join('\n')}\n\nPlease let me know if you'd like to try something else.`
//           : "I couldn't find any of the requested medicines. Could you please specify which medications you need?",
//         requiresAction: false
//       };
//     }

//     console.log(`✅ ${orderResults.length} medicine(s) approved, creating order...`);

//     try {
//       // Get consumer details
//       const consumerResult = await query('SELECT * FROM consumers WHERE id = $1', [consumerId]);
//       const consumer = consumerResult.rows[0];

//       const orderData = {
//         consumerId,
//         status: 'pending_payment',   // ← STOP here, do NOT confirm yet
//         totalAmount: orderResults.reduce((sum, result) =>
//           sum + (parseFloat(result.medicine.price) * result.orderRequest.quantity), 0
//         ),
//         items: orderResults.map(result => ({
//           medicineId: result.medicine.id,
//           quantity: result.orderRequest.quantity,
//           dosageFrequency: result.orderRequest.dosageFrequency,
//           unitPrice: parseFloat(result.medicine.price)
//         })),
//         customerEmail: customerEmail || consumer?.email || 'no-email@example.com'
//       };

//       // ✅ ONLY create the order — do NOT call confirmOrderAndAutomate here
//       const { order, orderItems } = await this.actionAgent.createOrder(orderData, sessionId);

//       // Build chat message
//       let responseMessage = `✅ Order prepared! Order #${order.id}\n\n`;
//       responseMessage += `📦 Items:\n`;
//       orderResults.forEach((result, index) => {
//         const lineTotal = (parseFloat(result.medicine.price) * result.orderRequest.quantity).toFixed(2);
//         responseMessage += `${index + 1}. ${result.medicine.medicine_name} — ${result.orderRequest.quantity} ${result.medicine.unit_type} ($${lineTotal})\n`;
//       });
//       responseMessage += `\n💰 Total: $${order.total_amount}\n\n`;
//       responseMessage += `Please review your order and complete payment to confirm it.`;

//       if (errors.length > 0) {
//         responseMessage += `\n\n⚠️ Note: Some items couldn't be added:\n${errors.join('\n')}`;
//       }

//       // Order details sent to frontend for the payment modal
//       const orderDetails = {
//         orderId: order.id,
//         totalAmount: parseFloat(order.total_amount),
//         items: orderResults.map(result => ({
//           medicine_name: result.medicine.medicine_name,
//           generic_name: result.medicine.generic_name,
//           quantity: result.orderRequest.quantity,
//           unit_type: result.medicine.unit_type,
//           unit_price: parseFloat(result.medicine.price),
//           dosage: result.orderRequest.dosageFrequency
//         })),
//         consumer_name: consumer?.name,
//         consumer_email: customerEmail || consumer?.email
//       };

//       return {
//         message: responseMessage,
//         requiresAction: true,
//         orderCreated: true,
//         orderId: order.id,
//         orderDetails,       // ← triggers modal in ChatInterface
//         needsPayment: true  // ← triggers modal in ChatInterface
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
//    * Called by server.js Stripe webhook AFTER real payment succeeds
//    */
//   async confirmOrderAfterPayment(orderId, paymentIntentId) {
//     try {
//       console.log(`💳 Confirming order ${orderId} after successful payment`);

//       await query(`
//         UPDATE orders 
//         SET 
//           status = 'confirmed',
//           payment_status = 'paid',
//           stripe_payment_intent_id = $1,
//           updated_at = NOW()
//         WHERE id = $2
//       `, [paymentIntentId, orderId]);

//       await this.actionAgent.confirmOrderAndAutomate(orderId, `payment-${orderId}`);

//       return { success: true, message: 'Order confirmed successfully' };

//     } catch (error) {
//       console.error('Error confirming order after payment:', error);
//       throw error;
//     }
//   }

//   /**
//    * Cancel order and restore inventory
//    */
//   async cancelOrder(orderId) {
//     try {
//       console.log(`❌ Cancelling order ${orderId}`);

//       const orderItemsResult = await query(`
//         SELECT medicine_id, quantity FROM order_items WHERE order_id = $1
//       `, [orderId]);

//       for (const item of orderItemsResult.rows) {
//         await query(`
//           UPDATE medicines
//           SET stock_quantity = stock_quantity + $1
//           WHERE id = $2
//         `, [item.quantity, item.medicine_id]);
//         console.log(`📦 Restored ${item.quantity} units of medicine ${item.medicine_id}`);
//       }

//       await query(`
//         UPDATE orders 
//         SET status = 'cancelled', payment_status = 'cancelled', updated_at = NOW()
//         WHERE id = $1
//       `, [orderId]);

//       console.log(`✅ Order ${orderId} cancelled and inventory restored`);
//       return { success: true, message: 'Order cancelled successfully' };

//     } catch (error) {
//       console.error('Error cancelling order:', error);
//       throw error;
//     }
//   }

//   async handleQuestionIntent(intent, userMessage, sessionId, conversationHistory, tracer) {
//     console.log('❓ Handling question intent...');
//     const response = await this.conversationAgent.generateResponse({
//       type: 'question',
//       question: userMessage,
//       conversationHistory
//     }, sessionId);
//     return { message: response, isInformational: true };
//   }

//   async handleGreeting(consumerId, sessionId, tracer) {
//     console.log('👋 Handling greeting...');
//     const alerts = await this.predictiveAgent.getPendingAlertsForConsumer(consumerId);
//     let greeting = "Hello! How can I help you today?";
//     if (alerts.length > 0) {
//       const alert = alerts[0];
//       greeting = `Hello! I noticed you may be running low on ${alert.medicine_name}. ${alert.alert_message} Would you like to refill it now?`;
//       await this.predictiveAgent.markAlertAsSent(alert.id);
//     }
//     return { message: greeting, proactiveAlert: alerts.length > 0 ? alerts[0] : null };
//   }

//   async handleGenericIntent(intent, userMessage, sessionId, tracer) {
//     const response = await this.conversationAgent.generateResponse({
//       type: 'generic',
//       message: userMessage,
//       intent
//     }, sessionId);
//     return { message: response };
//   }

//   async getTypicalQuantity(consumerId, medicineName) {
//     try {
//       const result = await query(`
//         SELECT AVG(oi.quantity)::int as typical_quantity
//         FROM order_items oi
//         JOIN orders o ON oi.order_id = o.id
//         JOIN medicines m ON oi.medicine_id = m.id
//         WHERE o.consumer_id = $1
//         AND m.medicine_name = $2
//         AND o.status IN ('fulfilled', 'confirmed')
//       `, [consumerId, medicineName]);
//       return result.rows[0]?.typical_quantity || null;
//     } catch (error) {
//       console.error('Error getting typical quantity:', error);
//       return null;
//     }
//   }

//   async saveConversationMessage(sessionId, role, content) {
//     try {
//       await query(`
//         INSERT INTO conversation_messages (session_id, role, content)
//         VALUES ($1, $2, $3)
//       `, [sessionId, role, content]);
//       await query(`
//         UPDATE conversation_sessions 
//         SET message_count = message_count + 1
//         WHERE session_id = $1
//       `, [sessionId]);
//     } catch (error) {
//       console.error('Error saving conversation message:', error);
//     }
//   }

//   async getConversationHistory(sessionId, limit = 10) {
//     try {
//       const result = await query(`
//         SELECT role, content, created_at
//         FROM conversation_messages
//         WHERE session_id = $1
//         ORDER BY created_at DESC
//         LIMIT $2
//       `, [sessionId, limit]);
//       return result.rows.reverse();
//     } catch (error) {
//       console.error('Error getting conversation history:', error);
//       return [];
//     }
//   }
// }
// 5
// export default AgentOrchestrator;











import ConversationAgent from './ConversationAgent.js';
import SafetyPolicyAgent from './SafetyPolicyAgent.js';
import PredictiveIntelligenceAgent from './PredictiveIntelligenceAgent.js';
import ActionExecutionAgent from './ActionExecutionAgent.js';
import { AgentTracer } from '../config/langfuse.js';
import { query } from '../config/database.js';

export class AgentOrchestrator {
  constructor() {
    this.conversationAgent = new ConversationAgent();
    this.safetyAgent = new SafetyPolicyAgent();
    this.predictiveAgent = new PredictiveIntelligenceAgent();
    this.actionAgent = new ActionExecutionAgent();
  }

  // ============================================================================
  // QUANTITY SANITIZATION
  // Prevents "Allegra 120" → quantity:120, "Pacimol 650" → quantity:650
  // The number in a medicine name is ALWAYS a dosage strength (mg), not quantity
  // ============================================================================

  /**
   * Extract the dosage strength number embedded in a medicine name.
   * e.g. "Allegra 120" → 120, "Pacimol 650" → 650, "Wysolone" → null
   */
  extractStrengthFromName(medicineName) {
    const match = String(medicineName || '').match(/(\d+)\s*(?:mg|mcg|ml|g)?$/i);
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Sanitize a quantity value for a given medicine name.
   * Returns null (→ ask user) if quantity looks like it's the mg strength.
   */
  sanitizeQuantity(medicineName, quantity) {
    if (!quantity || !Number.isInteger(quantity) || quantity <= 0) return null;

    const strength = this.extractStrengthFromName(medicineName);

    // If the quantity exactly matches the mg strength in the name → it's a parsing error
    if (strength && quantity === strength) {
      console.warn(
        `⚠️  Quantity ${quantity} matches dosage strength in "${medicineName}". ` +
        `Clearing quantity — will ask user to confirm.`
      );
      return null;
    }

    // Unrealistically high quantities (>60) for a single order are almost always parsing artifacts
    if (quantity > 60) {
      console.warn(
        `⚠️  Quantity ${quantity} is unrealistically high for "${medicineName}". ` +
        `Clearing quantity — will ask user to confirm.`
      );
      return null;
    }

    return quantity;
  }

  async processUserMessage(userMessage, sessionId, consumerId, conversationHistory = [], customerEmail = null) {
    const tracer = new AgentTracer(sessionId, 'orchestrator');
    tracer.startTrace('process_user_message');

    try {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🤖 ORCHESTRATOR: Processing message for consumer ${consumerId}`);
      console.log(`Message: "${userMessage}"`);
      console.log(`Customer Email: ${customerEmail || 'not provided'}`);
      console.log(`${'='.repeat(80)}\n`);

      console.log('📝 Step 1: Extracting intent...');
      const intent = await this.conversationAgent.extractIntent(
        userMessage,
        conversationHistory,
        sessionId
      );

      console.log('Intent extracted:', intent);
      tracer.logDecision('Intent Extracted', `Intent: ${intent.intent}`, intent);

      let response;

      switch (intent.intent) {
        case 'order':
        case 'refill':
          response = await this.handleOrderIntent(
            intent,
            consumerId,
            sessionId,
            customerEmail
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
          response = await this.handleGreeting(consumerId, sessionId, tracer);
          break;

        default:
          response = await this.handleGenericIntent(intent, userMessage, sessionId, tracer);
      }

      await this.saveConversationMessage(sessionId, 'user', userMessage);
      await this.saveConversationMessage(sessionId, 'assistant', response.message || response.response);

      await tracer.end({ response });

      return {
        message: response.message || response.response,
        orderCreated: response.orderCreated || false,
        orderId: response.orderId || null,
        orderDetails: response.orderDetails || null,
        needsPayment: response.needsPayment || false,
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

  async handleOrderIntent(intent, consumerId, sessionId, customerEmail = null) {
    console.log('🛒 Handling order intent...');

    if (!intent.medicines || intent.medicines.length === 0) {
      return {
        message: "I'd be happy to help you order medicine. Which medication do you need?",
        requiresAction: false
      };
    }

    const orderResults = [];
    const errors = [];
    const pendingQuantitySelections = [];

    for (const medicineRequest of intent.medicines) {
      try {
        console.log(`🔍 Processing medicine: ${medicineRequest.name}`);

        const matchedMedicine = await this.conversationAgent.fuzzyMatchMedicine(
          medicineRequest.name,
          sessionId
        );

        if (!matchedMedicine) {
          errors.push(`❌ Medicine "${medicineRequest.name}" not found in our inventory`);
          continue;
        }

        console.log(`✅ Medicine matched: ${matchedMedicine.medicine_name} (${matchedMedicine.generic_name})`);

        // ✅ KEY FIX: Sanitize quantity BEFORE using it
        // This strips out cases where "Allegra 120" → quantity:120 (that's mg, not tablets)
        const rawQty = medicineRequest?.quantity;
        const qty = this.sanitizeQuantity(matchedMedicine.medicine_name, rawQty);

        console.log(`📦 Quantity: raw=${rawQty}, sanitized=${qty}`);

        const isValidQty = qty !== null && Number.isInteger(qty) && qty > 0;

        if (!isValidQty) {
          // Ask user to select quantity via popup
          pendingQuantitySelections.push({
            medicineId: matchedMedicine.id,
            medicine_name: matchedMedicine.medicine_name,
            generic_name: matchedMedicine.generic_name,
            unit_type: matchedMedicine.unit_type,
            price: parseFloat(matchedMedicine.price),
            suggested_default_quantity: 1
          });
          continue;
        }

        const orderRequest = {
          medicineId: matchedMedicine.id,
          quantity: qty,
          dosageFrequency: medicineRequest.dosage_frequency || 'as prescribed'
        };

        console.log('🛡️  Running safety checks...');
        const safetyResult = await this.safetyAgent.evaluateOrderSafety(
          consumerId,
          matchedMedicine,
          orderRequest,
          sessionId
        );

        // ✅ Use sanitized quantity returned from safety agent (double safety net)
        const finalQuantity = safetyResult.sanitizedQuantity ?? qty;
        if (finalQuantity !== qty) {
          console.log(`🔧 Safety agent further corrected quantity: ${qty} → ${finalQuantity}`);
          orderRequest.quantity = finalQuantity;
        }

        if (safetyResult.decision === 'APPROVED') {
          orderResults.push({
            success: true,
            medicine: matchedMedicine,
            orderRequest,
            safetyResult
          });
        } else {
          errors.push(`❌ ${matchedMedicine.medicine_name}: ${safetyResult.reason}`);
        }

      } catch (error) {
        console.error(`Error processing ${medicineRequest.name}:`, error);
        errors.push(`❌ Error processing ${medicineRequest.name}`);
      }
    }

    // If any medicines need quantity selection, return popup trigger
    if (pendingQuantitySelections.length > 0) {
      const msg =
        pendingQuantitySelections.length === 1
          ? `Please select the quantity for ${pendingQuantitySelections[0].medicine_name}.`
          : `Please select quantities for the medicines to continue.`;

      return {
        message: msg,
        requiresAction: false,
        next_action: 'ask_quantity',
        clarification_needed: ['quantity'],
        pendingQuantitySelections,
        errors: errors.length ? errors : undefined
      };
    }

    // If nothing approved, return errors
    if (orderResults.length === 0) {
      return {
        message: errors.length > 0
          ? `I couldn't process your order:\n\n${errors.join('\n')}\n\nPlease let me know if you'd like to try something else.`
          : "I couldn't find any of the requested medicines. Could you please specify which medications you need?",
        requiresAction: false
      };
    }

    console.log(`✅ ${orderResults.length} medicine(s) approved, creating order...`);

    try {
      const consumerResult = await query('SELECT * FROM consumers WHERE id = $1', [consumerId]);
      const consumer = consumerResult.rows[0];

      const orderData = {
        consumerId,
        status: 'pending_payment',
        totalAmount: orderResults.reduce((sum, result) =>
          sum + (parseFloat(result.medicine.price) * result.orderRequest.quantity), 0
        ),
        items: orderResults.map(result => ({
          medicineId: result.medicine.id,
          quantity: result.orderRequest.quantity,
          dosageFrequency: result.orderRequest.dosageFrequency,
          unitPrice: parseFloat(result.medicine.price)
        })),
        customerEmail: customerEmail || consumer?.email || 'no-email@example.com'
      };

      const { order } = await this.actionAgent.createOrder(orderData, sessionId);

      let responseMessage = `✅ Order prepared! Order #${order.id}\n\n`;
      responseMessage += `📦 Items:\n`;
      orderResults.forEach((result, index) => {
        const lineTotal = (parseFloat(result.medicine.price) * result.orderRequest.quantity).toFixed(2);
        responseMessage += `${index + 1}. ${result.medicine.medicine_name} — ${result.orderRequest.quantity} ${result.medicine.unit_type} ($${lineTotal})\n`;
      });
      responseMessage += `\n💰 Total: $${order.total_amount}\n\n`;
      responseMessage += `Please review your order and complete payment to confirm it.`;

      if (errors.length > 0) {
        responseMessage += `\n\n⚠️ Note: Some items couldn't be added:\n${errors.join('\n')}`;
      }

      const orderDetails = {
        orderId: order.id,
        totalAmount: parseFloat(order.total_amount),
        items: orderResults.map(result => ({
          medicine_name: result.medicine.medicine_name,
          generic_name: result.medicine.generic_name,
          quantity: result.orderRequest.quantity,
          unit_type: result.medicine.unit_type,
          unit_price: parseFloat(result.medicine.price),
          dosage: result.orderRequest.dosageFrequency
        })),
        consumer_name: consumer?.name,
        consumer_email: customerEmail || consumer?.email
      };

      return {
        message: responseMessage,
        requiresAction: true,
        orderCreated: true,
        orderId: order.id,
        orderDetails,
        needsPayment: true
      };

    } catch (error) {
      console.error('Error creating order:', error);
      return {
        message: `I encountered an error while creating your order: ${error.message}. Please try again.`,
        requiresAction: false
      };
    }
  }

  async confirmOrderAfterPayment(orderId, paymentIntentId) {
    try {
      console.log(`💳 Confirming order ${orderId} after successful payment`);

      await query(`
        UPDATE orders 
        SET 
          status = 'confirmed',
          payment_status = 'paid',
          stripe_payment_intent_id = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [paymentIntentId, orderId]);

      await this.actionAgent.confirmOrderAndAutomate(orderId, `payment-${orderId}`);

      return { success: true, message: 'Order confirmed successfully' };

    } catch (error) {
      console.error('Error confirming order after payment:', error);
      throw error;
    }
  }

  async cancelOrder(orderId) {
    try {
      console.log(`❌ Cancelling order ${orderId}`);

      const orderItemsResult = await query(`
        SELECT medicine_id, quantity FROM order_items WHERE order_id = $1
      `, [orderId]);

      for (const item of orderItemsResult.rows) {
        await query(`
          UPDATE medicines
          SET stock_quantity = stock_quantity + $1
          WHERE id = $2
        `, [item.quantity, item.medicine_id]);
        console.log(`📦 Restored ${item.quantity} units of medicine ${item.medicine_id}`);
      }

      await query(`
        UPDATE orders 
        SET status = 'cancelled', payment_status = 'cancelled', updated_at = NOW()
        WHERE id = $1
      `, [orderId]);

      console.log(`✅ Order ${orderId} cancelled and inventory restored`);
      return { success: true, message: 'Order cancelled successfully' };

    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  async handleQuestionIntent(intent, userMessage, sessionId, conversationHistory, tracer) {
    console.log('❓ Handling question intent...');
    const response = await this.conversationAgent.generateResponse({
      type: 'question',
      question: userMessage,
      conversationHistory
    }, sessionId);
    return { message: response, isInformational: true };
  }

  async handleGreeting(consumerId, sessionId, tracer) {
    console.log('👋 Handling greeting...');
    const alerts = await this.predictiveAgent.getPendingAlertsForConsumer(consumerId);
    let greeting = "Hello! How can I help you today?";
    if (alerts.length > 0) {
      const alert = alerts[0];
      greeting = `Hello! I noticed you may be running low on ${alert.medicine_name}. ${alert.alert_message} Would you like to refill it now?`;
      await this.predictiveAgent.markAlertAsSent(alert.id);
    }
    return { message: greeting, proactiveAlert: alerts.length > 0 ? alerts[0] : null };
  }

  async handleGenericIntent(intent, userMessage, sessionId, tracer) {
    const response = await this.conversationAgent.generateResponse({
      type: 'generic',
      message: userMessage,
      intent
    }, sessionId);
    return { message: response };
  }

  async saveConversationMessage(sessionId, role, content) {
    try {
      await query(`
        INSERT INTO conversation_messages (session_id, role, content)
        VALUES ($1, $2, $3)
      `, [sessionId, role, content]);
      await query(`
        UPDATE conversation_sessions 
        SET message_count = message_count + 1
        WHERE session_id = $1
      `, [sessionId]);
    } catch (error) {
      console.error('Error saving conversation message:', error);
    }
  }

  async getConversationHistory(sessionId, limit = 10) {
    try {
      const result = await query(`
        SELECT role, content, created_at
        FROM conversation_messages
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [sessionId, limit]);
      return result.rows.reverse();
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }
}

export default AgentOrchestrator;