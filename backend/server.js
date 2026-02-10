import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';

// Import database
import pool, { query } from './config/database.js';

// Import agents
import AgentOrchestrator from './agents/AgentOrchestrator.js';
import PredictiveIntelligenceAgent from './agents/PredictiveIntelligenceAgent.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize orchestrator
const orchestrator = new AgentOrchestrator();
const predictiveAgent = new PredictiveIntelligenceAgent();

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * Health check
 */
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message
    });
  }
});

/**
 * Start new conversation session
 */
app.post('/api/conversation/start', async (req, res) => {
  try {
    const { consumerId } = req.body;
    const sessionId = uuidv4();

    await query(`
      INSERT INTO conversation_sessions (session_id, consumer_id, channel)
      VALUES ($1, $2, $3)
    `, [sessionId, consumerId, 'text']);

    res.json({ 
      sessionId,
      message: 'Conversation session started'
    });
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Send message in conversation
 */
app.post('/api/conversation/message', async (req, res) => {
  try {
    const { sessionId, consumerId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }

    // Get conversation history
    const history = await orchestrator.getConversationHistory(sessionId);

    // Process message through orchestrator
    const response = await orchestrator.processUserMessage(
      message,
      sessionId,
      consumerId,
      history
    );

    res.json(response);

  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ 
      error: error.message,
      message: "I apologize, but I encountered an error. Please try again."
    });
  }
});

/**
 * Get conversation history
 */
app.get('/api/conversation/:sessionId/history', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = await orchestrator.getConversationHistory(sessionId, 50);
    res.json({ history });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get consumer info
 */
app.get('/api/consumers/:consumerId', async (req, res) => {
  try {
    const { consumerId } = req.params;
    
    const result = await query(`
      SELECT * FROM consumers WHERE id = $1
    `, [consumerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Consumer not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting consumer:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all consumers
 */
app.get('/api/consumers', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, email, phone FROM consumers ORDER BY name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting consumers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pending proactive alerts for consumer
 */
app.get('/api/consumers/:consumerId/alerts', async (req, res) => {
  try {
    const { consumerId } = req.params;
    const alerts = await predictiveAgent.getPendingAlertsForConsumer(consumerId);
    res.json({ alerts });
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all medicines
 */
app.get('/api/medicines', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM medicines ORDER BY medicine_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting medicines:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get medicine by ID
 */
app.get('/api/medicines/:medicineId', async (req, res) => {
  try {
    const { medicineId } = req.params;
    
    const result = await query(`
      SELECT * FROM medicines WHERE id = $1
    `, [medicineId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting medicine:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all orders
 */
app.get('/api/orders', async (req, res) => {
  try {
    const { consumerId, status } = req.query;
    
    let queryText = `
      SELECT o.*, c.name as consumer_name
      FROM orders o
      JOIN consumers c ON o.consumer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (consumerId) {
      params.push(consumerId);
      queryText += ` AND o.consumer_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      queryText += ` AND o.status = $${params.length}`;
    }

    queryText += ` ORDER BY o.order_date DESC LIMIT 100`;

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get order details with items
 */
app.get('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const orderResult = await query(`
      SELECT o.*, c.name as consumer_name, c.email, c.phone
      FROM orders o
      JOIN consumers c ON o.consumer_id = c.id
      WHERE o.id = $1
    `, [orderId]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    const itemsResult = await query(`
      SELECT oi.*, m.medicine_name, m.unit_type
      FROM order_items oi
      JOIN medicines m ON oi.medicine_id = m.id
      WHERE oi.order_id = $1
    `, [orderId]);

    order.items = itemsResult.rows;

    res.json(order);
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get agent actions log (for admin observability)
 */
app.get('/api/admin/agent-actions', async (req, res) => {
  try {
    const { sessionId, agentType } = req.query;
    
    let queryText = `
      SELECT * FROM agent_actions
      WHERE 1=1
    `;
    const params = [];

    if (sessionId) {
      params.push(sessionId);
      queryText += ` AND session_id = $${params.length}`;
    }

    if (agentType) {
      params.push(agentType);
      queryText += ` AND agent_type = $${params.length}`;
    }

    queryText += ` ORDER BY created_at DESC LIMIT 100`;

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting agent actions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all proactive alerts (admin)
 */
app.get('/api/admin/alerts', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        pa.*,
        c.name as consumer_name,
        m.medicine_name
      FROM proactive_alerts pa
      LEFT JOIN consumers c ON pa.consumer_id = c.id
      LEFT JOIN medicines m ON pa.medicine_id = m.id
      ORDER BY pa.triggered_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manually trigger predictive analysis
 */
app.post('/api/admin/run-predictions', async (req, res) => {
  try {
    console.log('🔮 Manually triggered predictive analysis...');
    const predictions = await predictiveAgent.analyzeAllConsumersForRefills();
    
    res.json({ 
      success: true,
      predictionsCount: predictions.length,
      predictions
    });
  } catch (error) {
    console.error('Error running predictions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get inventory status
 */
app.get('/api/admin/inventory', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        *,
        CASE 
          WHEN stock_quantity = 0 THEN 'out_of_stock'
          WHEN stock_quantity < 50 THEN 'low_stock'
          WHEN stock_quantity < 100 THEN 'medium_stock'
          ELSE 'good_stock'
        END as stock_status
      FROM medicines
      ORDER BY stock_quantity ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SCHEDULED JOBS
// ============================================================================

/**
 * Schedule predictive refill analysis
 * Runs daily at 9 AM (configurable via env)
 */
const predictionSchedule = process.env.PREDICTION_SCHEDULE || '0 9 * * *';
cron.schedule(predictionSchedule, async () => {
  console.log('⏰ Running scheduled predictive refill analysis...');
  try {
    await predictiveAgent.analyzeAllConsumersForRefills('scheduled-prediction');
    console.log('✅ Scheduled prediction completed');
  } catch (error) {
    console.error('❌ Error in scheduled prediction:', error);
  }
});

console.log(`📅 Predictive analysis scheduled: ${predictionSchedule}`);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🏥 Agentic AI Pharmacy System - Backend Server           ║
║                                                               ║
║     Status: RUNNING                                           ║
║     Port: ${PORT}                                                   ║
║     Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                               ║
║     API Endpoints:                                            ║
║     • POST /api/conversation/start                            ║
║     • POST /api/conversation/message                          ║
║     • GET  /api/medicines                                     ║
║     • GET  /api/orders                                        ║
║     • GET  /api/consumers                                     ║
║     • GET  /api/admin/agent-actions                           ║
║     • POST /api/admin/run-predictions                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
