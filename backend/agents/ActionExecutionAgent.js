import { AgentTracer } from '../config/langfuse.js';
import { query } from '../config/database.js';
import axios from 'axios';

/**
 * Action / Tool-Execution Agent
 * Executes real backend actions - never hallucinates
 * Handles database operations, webhooks, notifications
 */
export class ActionExecutionAgent {
  constructor() {
    this.webhookUrl = process.env.FULFILLMENT_WEBHOOK_URL;
    this.notificationUrl = process.env.NOTIFICATION_WEBHOOK_URL;
    // DEBUG LOGS
  console.log('🔧 ActionExecutionAgent initialized');
  console.log('📦 Fulfillment webhook URL:', this.webhookUrl);
  console.log('📧 Notification webhook URL:', this.notificationUrl);
  console.log('📦 Is fulfillment URL set?', !!this.webhookUrl);
  console.log('📧 Is notification URL set?', !!this.notificationUrl);
  }
  

  /**
   * Create a new order in the database
   */
  async createOrder(orderData, sessionId) {
    const tracer = new AgentTracer(sessionId, 'action_execution');
    const trace = tracer.startTrace('create_order');

    const client = await query('BEGIN');

    try {
      // Create order record
      const orderResult = await query(`
        INSERT INTO orders 
        (consumer_id, status, total_amount, prescription_url)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        orderData.consumerId,
        'pending',
        orderData.totalAmount || 0,
        orderData.prescriptionUrl || null
      ]);

      const order = orderResult.rows[0];

      tracer.logToolCall(
        'database_insert',
        { table: 'orders', consumerId: orderData.consumerId },
        { orderId: order.id }
      );

      // Create order items
      const orderItems = [];
      for (const item of orderData.items) {
        const itemResult = await query(`
          INSERT INTO order_items 
          (order_id, medicine_id, quantity, dosage_frequency, unit_price, subtotal)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `, [
          order.id,
          item.medicineId,
          item.quantity,
          item.dosageFrequency,
          item.unitPrice,
          item.quantity * item.unitPrice
        ]);

        orderItems.push(itemResult.rows[0]);

        // Update inventory
        await this.updateInventory(item.medicineId, -item.quantity, sessionId, tracer);
      }

      await query('COMMIT');

      tracer.logDecision(
        'Order Created',
        `Order #${order.id} with ${orderItems.length} items`,
        { order, orderItems }
      );

      const result = { order, orderItems };
      await tracer.end(result);

      return result;

    } catch (error) {
      await query('ROLLBACK');
      console.error('Error creating order:', error);
      
      tracer.logDecision(
        'Order Creation Failed',
        error.message,
        { error: error.message }
      );

      await tracer.end({ error: error.message }, { status: 'error' });
      throw error;
    }
  }

  /**
   * Update medicine inventory
   */
  async updateInventory(medicineId, quantityChange, sessionId, parentTracer = null) {
    const tracer = parentTracer || new AgentTracer(sessionId, 'action_execution');
    
    if (!parentTracer) {
      tracer.startTrace('update_inventory');
    }

    try {
      const result = await query(`
        UPDATE medicines 
        SET stock_quantity = stock_quantity + $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [quantityChange, medicineId]);

      const medicine = result.rows[0];

      tracer.logToolCall(
        'inventory_update',
        { medicineId, quantityChange },
        { 
          success: true, 
          newStock: medicine.stock_quantity,
          medicineName: medicine.medicine_name
        }
      );

      // Check for low stock
      if (medicine.stock_quantity < 50) {
        await this.triggerLowStockAlert(medicine, sessionId, tracer);
      }

      if (!parentTracer) {
        await tracer.end({ medicine });
      }

      return medicine;

    } catch (error) {
      console.error('Error updating inventory:', error);
      
      if (!parentTracer) {
        await tracer.end({ error: error.message }, { status: 'error' });
      }
      
      throw error;
    }
  }

  /**
   * Trigger low stock alert
   */
  async triggerLowStockAlert(medicine, sessionId, tracer) {
    try {
      await query(`
        INSERT INTO proactive_alerts 
        (consumer_id, medicine_id, alert_type, alert_message, triggered_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [
        null, // System alert, not consumer-specific
        medicine.id,
        'low_stock',
        `Low stock alert: ${medicine.medicine_name} has only ${medicine.stock_quantity} ${medicine.unit_type} remaining`
      ]);

      tracer.logToolCall(
        'low_stock_alert',
        { medicine: medicine.medicine_name, stock: medicine.stock_quantity },
        { alertCreated: true }
      );

    } catch (error) {
      console.error('Error creating low stock alert:', error);
    }
  }

  /**
   * Trigger fulfillment webhook
   */
  async triggerFulfillmentWebhook(order, orderItems, sessionId) {
     console.log('🔍 DEBUG: triggerFulfillmentWebhook called');
  console.log('🔍 DEBUG: this.webhookUrl =', this.webhookUrl);
  console.log('🔍 DEBUG: Checking condition:', this.webhookUrl && this.webhookUrl !== 'https://webhook.site/your-unique-url');
    const tracer = new AgentTracer(sessionId, 'action_execution');
    tracer.startTrace('trigger_fulfillment_webhook');

    try {
      const payload = {
        event: 'order.created',
        timestamp: new Date().toISOString(),
        order: {
          id: order.id,
          consumerId: order.consumer_id,
          status: order.status,
          totalAmount: order.total_amount,
          orderDate: order.order_date
        },
        items: orderItems.map(item => ({
          medicineId: item.medicine_id,
          quantity: item.quantity,
          dosageFrequency: item.dosage_frequency
        }))
      };

      if (this.webhookUrl && this.webhookUrl !== 'https://webhook.site/your-unique-url') {
        const response = await axios.post(this.webhookUrl, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        });

        tracer.logToolCall(
          'webhook_call',
          { url: this.webhookUrl, payload },
          { 
            status: response.status, 
            success: true 
          }
        );

        // Update order to mark webhook as sent
        await query(`
          UPDATE orders 
          SET fulfillment_webhook_sent = true 
          WHERE id = $1
        `, [order.id]);

        await tracer.end({ success: true, response: response.data });
        return { success: true, response: response.data };

      } else {
        // Mock webhook for development
        console.log('📦 MOCK WEBHOOK - Order Fulfillment:', JSON.stringify(payload, null, 2));
        
        tracer.logToolCall(
          'mock_webhook',
          { payload },
          { success: true, note: 'Development mode - webhook mocked' }
        );

        await tracer.end({ success: true, mocked: true });
        return { success: true, mocked: true };
      }

    } catch (error) {
      console.error('Error triggering fulfillment webhook:', error);
      
      tracer.logToolCall(
        'webhook_call',
        { url: this.webhookUrl },
        { success: false, error: error.message }
      );

      await tracer.end({ error: error.message }, { status: 'error' });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send order confirmation (Email/WhatsApp)
   */
async sendOrderConfirmation(order, consumer, orderItems, sessionId) {
  const tracer = new AgentTracer(sessionId, 'action_execution');
  tracer.startTrace('send_order_confirmation');

  try {
    // Get medicine names for items
    const medicineIds = orderItems.map(item => item.medicine_id);
    const medicinesResult = await query(`
      SELECT id, medicine_name FROM medicines WHERE id = ANY($1)
    `, [medicineIds]);

    const medicineMap = {};
    medicinesResult.rows.forEach(m => {
      medicineMap[m.id] = m.medicine_name;
    });

    const itemsList = orderItems.map(item => 
      `- ${medicineMap[item.medicine_id]} x ${item.quantity}`
    ).join('\n');

    const message = `
Order Confirmation - MediFlow AI

Dear ${consumer.name},

Your order #${order.id} has been confirmed!

Items:
${itemsList}

Total: $${order.total_amount}

Your order will be processed shortly. You'll receive a notification when it's ready for pickup/delivery.

Thank you for choosing our pharmacy!
    `.trim();

    // ✅ ENHANCED: Send notification webhook to Zapier with detailed logging
    if (process.env.NOTIFICATION_WEBHOOK_URL && 
        process.env.NOTIFICATION_WEBHOOK_URL !== 'https://api.example.com/notifications') {
      
      // Build complete items array (not just first item)
      const allItems = orderItems.map(item => ({
        medicine_name: medicineMap[item.medicine_id],
        quantity: item.quantity,
        dosage_frequency: item.dosage_frequency,
        unit_price: item.unit_price,
        subtotal: item.subtotal
      }));

      const notificationPayload = {
        event: 'order.confirmation',
        timestamp: new Date().toISOString(),
        order_id: order.id,
        customer_name: consumer.name,
        customer_email: consumer.email || 'no-email@example.com',
        customer_phone: consumer.phone || '',
        // ✅ FIXED: Send all items, not just first one
        medicine: medicineMap[orderItems[0].medicine_id], // Primary item for Zapier
        quantity: orderItems[0].quantity,
        total_amount: order.total_amount,
        status: 'confirmed',
        items: itemsList, // Human-readable list
        items_array: allItems, // Structured array for advanced Zaps
        order_date: order.order_date || new Date().toISOString()
      };

      try {
        console.log('\n════════════════════════════════════════════════════════');
        console.log('📧 SENDING NOTIFICATION WEBHOOK TO ZAPIER');
        console.log('════════════════════════════════════════════════════════');
        console.log('🔗 Webhook URL:', process.env.NOTIFICATION_WEBHOOK_URL);
        console.log('📦 Payload:', JSON.stringify(notificationPayload, null, 2));
        console.log('════════════════════════════════════════════════════════\n');

        const response = await axios.post(
          process.env.NOTIFICATION_WEBHOOK_URL, 
          notificationPayload,
          {
            headers: { 
              'Content-Type': 'application/json',
              'User-Agent': 'MediFlow-AI/1.0'
            },
            timeout: 10000, // Increased timeout to 10s
            validateStatus: (status) => status < 500 // Accept 4xx as non-error
          }
        );

        // ✅ ENHANCED: Log full response details
        console.log('\n════════════════════════════════════════════════════════');
        console.log('✅ ZAPIER WEBHOOK RESPONSE');
        console.log('════════════════════════════════════════════════════════');
        console.log('📊 Status Code:', response.status);
        console.log('📊 Status Text:', response.statusText);
        console.log('📄 Response Headers:', JSON.stringify(response.headers, null, 2));
        console.log('📄 Response Body:', JSON.stringify(response.data, null, 2));
        console.log('════════════════════════════════════════════════════════\n');

        // ✅ Check for Zapier-specific errors
        if (response.status === 200 || response.status === 201) {
          // Check if Zapier returned an error in the body
          if (response.data && response.data.status === 'error') {
            console.error('⚠️  Zapier returned error in response body:', response.data);
            throw new Error(`Zapier error: ${response.data.message || 'Unknown error'}`);
          }

          console.log('✅ Notification webhook sent successfully!');
          
          tracer.logToolCall(
            'send_notification',
            { 
              channel: 'zapier_webhook', 
              recipient: consumer.email,
              orderId: order.id 
            },
            { 
              success: true, 
              status: response.status,
              zapierResponse: response.data 
            }
          );
        } else {
          // Non-200 response
          console.error(`⚠️  Unexpected status code: ${response.status}`);
          throw new Error(`Zapier returned status ${response.status}: ${response.statusText}`);
        }

      } catch (error) {
        console.log('\n════════════════════════════════════════════════════════');
        console.log('❌ NOTIFICATION WEBHOOK FAILED');
        console.log('════════════════════════════════════════════════════════');
        
        if (error.response) {
          // Zapier responded with error
          console.error('📊 Error Status:', error.response.status);
          console.error('📊 Error Status Text:', error.response.statusText);
          console.error('📄 Error Response:', JSON.stringify(error.response.data, null, 2));
          console.error('📄 Error Headers:', JSON.stringify(error.response.headers, null, 2));
        } else if (error.request) {
          // Request made but no response
          console.error('📡 No response received from Zapier');
          console.error('🔍 Request details:', error.request);
          console.error('💡 Possible causes:');
          console.error('   - Zapier webhook URL is incorrect');
          console.error('   - Network connectivity issues');
          console.error('   - Zapier service is down');
        } else {
          // Error in request setup
          console.error('⚙️  Error Message:', error.message);
          console.error('🔍 Error Stack:', error.stack);
        }
        
        console.log('════════════════════════════════════════════════════════\n');

        // Log to tracer
        tracer.logToolCall(
          'send_notification',
          { 
            channel: 'zapier_webhook', 
            recipient: consumer.email,
            orderId: order.id 
          },
          { 
            success: false, 
            error: error.message,
            errorDetails: error.response ? {
              status: error.response.status,
              data: error.response.data
            } : null
          }
        );

        // Don't throw - log error but continue
        console.error('⚠️  Order created successfully but notification failed');
      }
    } else {
      console.log('⚠️  NOTIFICATION_WEBHOOK_URL not configured or is placeholder');
      console.log('📝 Current value:', process.env.NOTIFICATION_WEBHOOK_URL);
    }

    // For development, log to console
    console.log('\n📧 ORDER CONFIRMATION EMAIL (MOCK):');
    console.log('To:', consumer.email);
    console.log('Subject: Order Confirmation #' + order.id);
    console.log(message);

    // Mock WhatsApp notification
    if (consumer.phone) {
      console.log('\n📱 WHATSAPP MESSAGE (MOCK):');
      console.log('To:', consumer.phone);
      console.log(`Hi ${consumer.name}! Your pharmacy order #${order.id} is confirmed. Total: $${order.total_amount}`);
    }

    await tracer.end({ success: true, messagesSent: 1 });
    return { success: true };

  } catch (error) {
    console.error('❌ Error in sendOrderConfirmation:', error);
    await tracer.end({ error: error.message }, { status: 'error' });
    return { success: false, error: error.message };
  }
}


  /**
   * Confirm order and trigger all automation
   */
  async confirmOrderAndAutomate(orderId, sessionId) {
    const tracer = new AgentTracer(sessionId, 'action_execution');
    tracer.startTrace('confirm_order_full_automation');

    try {
      // Get order details
      const orderResult = await query(`
        SELECT o.*, c.name, c.email, c.phone
        FROM orders o
        JOIN consumers c ON o.consumer_id = c.id
        WHERE o.id = $1
      `, [orderId]);

      if (orderResult.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderResult.rows[0];

      // Get order items
      const itemsResult = await query(`
        SELECT * FROM order_items WHERE order_id = $1
      `, [orderId]);

      const orderItems = itemsResult.rows;

      // Update order status
      await query(`
        UPDATE orders 
        SET status = 'confirmed', updated_at = NOW()
        WHERE id = $1
      `, [orderId]);

      tracer.logDecision(
        'Order Confirmed',
        `Order #${orderId} status updated to confirmed`,
        { orderId }
      );

      // Trigger fulfillment webhook
      await this.triggerFulfillmentWebhook(order, orderItems, sessionId);

      // Send confirmation to consumer
      await this.sendOrderConfirmation(
        order, 
        { name: order.name, email: order.email, phone: order.phone },
        orderItems,
        sessionId
      );

      const result = {
        success: true,
        orderId: order.id,
        status: 'confirmed',
        automationCompleted: true
      };

      await tracer.end(result);
      return result;

    } catch (error) {
      console.error('Error in order automation:', error);
      await tracer.end({ error: error.message }, { status: 'error' });
      throw error;
    }
  }

  /**
   * Log agent action to database
   */
  async logAction(sessionId, actionType, inputData, outputData, status = 'success') {
    try {
      await query(`
        INSERT INTO agent_actions 
        (session_id, agent_type, action_type, input_data, output_data, execution_status)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        sessionId,
        'action_execution',
        actionType,
        JSON.stringify(inputData),
        JSON.stringify(outputData),
        status
      ]);
    } catch (error) {
      console.error('Error logging action:', error);
    }
  }
}

export default ActionExecutionAgent;
