import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrescriptionParser } from './services/PrescriptionParser.js';
import fs from 'fs/promises';
// Import database
import pool, { query } from './config/database.js';

// Import agents
import AgentOrchestrator from './agents/AgentOrchestrator.js';
import PredictiveIntelligenceAgent from './agents/PredictiveIntelligenceAgent.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|heic|heif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG, HEIC) and PDF files are allowed'));
    }
  }
});
/**
 * Upload and parse prescription
 */
app.post('/api/prescription/upload', upload.single('prescription'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📤 Prescription uploaded:', req.file.originalname);

    // Parse the prescription
    const result = await prescriptionParser.parsePrescription(
      req.file.path,
      req.file.mimetype
    );

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {});

    if (!result.success) {
      return res.status(400).json({ 
        error: 'Failed to parse prescription',
        details: result.error
      });
    }

    res.json({
      success: true,
      medicines: result.medicines,
      patientInfo: result.patientInfo,
      rawText: result.rawText
    });

  } catch (error) {
    console.error('Error handling prescription upload:', error);
    res.status(500).json({ error: error.message });
  }
});
// Initialize prescription parser
const prescriptionParser = new PrescriptionParser();
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(console.error);

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
// ADMIN AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Simple admin password authentication
 */
const checkAdminPassword = (req, res, next) => {
  const providedPassword = req.headers['x-admin-password'];
  const correctPassword = process.env.ADMIN_SECRET || 'admin123';
  
  console.log('🔐 Admin auth check:');
  console.log('  Provided:', providedPassword || '(none)');
  console.log('  Expected:', correctPassword);
  console.log('  Match:', providedPassword === correctPassword);
  
  if (providedPassword === correctPassword) {
    next(); // Password correct, proceed
  } else {
    console.log('❌ Unauthorized admin access attempt');
    res.status(401).json({ error: 'Unauthorized. Wrong admin password.' });
  }
};

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

// ============================================================================
// ADMIN ROUTES (Protected with password)
// ============================================================================

/**
 * Get inventory status (Admin only)
 */
app.get('/api/admin/inventory', checkAdminPassword, async (req, res) => {
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

/**
 * Get all proactive alerts (Admin only)
 */
app.get('/api/admin/alerts', checkAdminPassword, async (req, res) => {
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
 * Get agent actions log (Admin only)
 */
app.get('/api/admin/agent-actions', checkAdminPassword, async (req, res) => {
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
 * Manually trigger predictive analysis (Admin only)
 */
app.post('/api/admin/run-predictions', checkAdminPassword, async (req, res) => {
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
// EXPORT FOR VERCEL (Must come before app.listen)
// ============================================================================

export default app;

// ============================================================================
// START SERVER (Only for local development, not on Vercel)
// ============================================================================

// Only start the server if NOT running on Vercel
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🏥 Agentic AI Pharmacy System - Backend Server           ║
║                                                               ║
║     Status: RUNNING                                           ║
║     Port: ${PORT}                                                   ║
║     Environment: ${process.env.NODE_ENV || 'development'}                              ║
║     Admin Password: ${process.env.ADMIN_SECRET ? '✅ SET' : '⚠️  Using default (admin123)'}                     ║
║                                                               ║
║     API Endpoints:                                            ║
║     • POST /api/conversation/start                            ║
║     • POST /api/conversation/message                          ║
║     • GET  /api/medicines                                     ║
║     • GET  /api/orders                                        ║
║     • GET  /api/consumers                                     ║
║     • GET  /api/admin/agent-actions          🔒               ║
║     • GET  /api/admin/inventory              🔒               ║
║     • GET  /api/admin/alerts                 🔒               ║
║     • POST /api/admin/run-predictions        🔒               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
}