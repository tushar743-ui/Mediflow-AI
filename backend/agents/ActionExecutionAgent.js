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
Order Confirmation - Pharmacy AI

Dear ${consumer.name},

Your order #${order.id} has been confirmed!

Items:
${itemsList}

Total: $${order.total_amount}

Your order will be processed shortly. You'll receive a notification when it's ready for pickup/delivery.

Thank you for choosing our pharmacy!
      `.trim();

      // For development, log to console
      // In production, integrate with email service (SendGrid, AWS SES) or WhatsApp API
      console.log('📧 ORDER CONFIRMATION EMAIL:');
      console.log('To:', consumer.email);
      console.log('Subject: Order Confirmation #' + order.id);
      console.log(message);

      tracer.logToolCall(
        'send_notification',
        { 
          channel: 'email', 
          recipient: consumer.email,
          orderId: order.id 
        },
        { success: true, mocked: true }
      );

      // Mock WhatsApp notification
      if (consumer.phone) {
        console.log('📱 WHATSAPP MESSAGE:');
        console.log('To:', consumer.phone);
        console.log(`Hi ${consumer.name}! Your pharmacy order #${order.id} is confirmed. Total: $${order.total_amount}`);

        tracer.logToolCall(
          'send_notification',
          { 
            channel: 'whatsapp', 
            recipient: consumer.phone,
            orderId: order.id 
          },
          { success: true, mocked: true }
        );
      }

      await tracer.end({ success: true, messagesSent: 2 });
      return { success: true };

    } catch (error) {
      console.error('Error sending confirmation:', error);
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
