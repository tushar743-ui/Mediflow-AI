# 🏥 Agentic AI Pharmacy System

A production-ready, autonomous, intelligent pharmacy management system powered by a multi-agent AI architecture. The system transforms traditional pharmacy operations into a proactive, policy-aware ecosystem that behaves like a licensed expert pharmacist.

## 🌟 Key Features

### Multi-Agent Architecture
- **Conversation Agent**: Natural language understanding with fuzzy medicine matching
- **Safety & Policy Agent**: Enforces prescription requirements, stock availability, and dosage safety
- **Predictive Intelligence Agent**: Analyzes consumption patterns and proactively initiates refill reminders
- **Action Execution Agent**: Executes real backend operations without hallucination

### Core Capabilities
- ✅ **Conversational Ordering**: Natural language (text + voice) medicine ordering
- 🛡️ **Safety & Compliance**: Automatic prescription verification and dosage safety checks
- 🔮 **Predictive Refills**: AI-powered consumption analysis with proactive alerts
- 🤖 **Real-World Actions**: Database updates, webhook triggers, email/WhatsApp notifications
- 📊 **Full Observability**: Langfuse integration for complete agent tracing
- 🎤 **Voice Interface**: Web Speech API integration for voice input/output

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Chat UI      │  │ Voice I/O    │  │ Admin Panel  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Backend (Node.js + Express)                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │            Agent Orchestrator                         │ │
│  └───────────────────────────────────────────────────────┘ │
│           │          │          │          │                │
│           ▼          ▼          ▼          ▼                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │Conversa- │ │ Safety & │ │Predictive│ │ Action   │      │
│  │tion      │ │ Policy   │ │Intel.    │ │Execution │      │
│  │Agent     │ │ Agent    │ │Agent     │ │Agent     │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │              Langfuse Observability                   │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Neon PostgreSQL Database                       │
│  • Medicines   • Orders      • Prescriptions                │
│  • Consumers   • Alerts      • Agent Actions                │
│  • Consumption History       • Conversations                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              External Integrations                          │
│  • Fulfillment Webhooks  • Email Notifications              │
│  • WhatsApp API          • Prescription Verification        │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Tech Stack

### Frontend
- **React 18**: Modern hooks-based architecture
- **Vite**: Fast build tool and dev server
- **Web Speech API**: Native browser voice input/output
- **Axios**: HTTP client for API communication

### Backend
- **Node.js**: JavaScript runtime
- **Express**: Web application framework
- **OpenAI GPT-4**: Primary LLM for agent intelligence
- **Langfuse**: Observability and tracing
- **node-cron**: Scheduled task execution

### Database
- **Neon PostgreSQL**: Serverless PostgreSQL database
- **pg**: PostgreSQL client for Node.js

### AI & Agents
- **LangChain**: LLM orchestration framework
- **Multi-Agent Pattern**: Specialized agents for different tasks

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (Neon recommended)
- OpenAI API key
- Langfuse account (optional but recommended)

### Environment Setup

1. **Clone the repository** (or use the provided files)

2. **Backend Setup**
```bash
cd backend
cp .env.example .env
# Edit .env with your credentials:
# - DATABASE_URL (Neon PostgreSQL)
# - OPENAI_API_KEY
# - LANGFUSE_SECRET_KEY
# - LANGFUSE_PUBLIC_KEY
```

3. **Database Initialization**
```bash
# Connect to your Neon database and run:
psql $DATABASE_URL < ../database/schema.sql

# Or use a PostgreSQL client to execute schema.sql
```

4. **Seed Database**
```bash
npm install
npm run seed
```

This will populate the database with:
- 15 medicines from medicine_master.csv
- 5 consumers from consumer_orders.csv
- Historical order data
- Sample prescriptions

5. **Start Backend Server**
```bash
npm run dev
# Server runs on http://localhost:3001
```

6. **Frontend Setup** (in a new terminal)
```bash
cd ../frontend
npm install
npm run dev
# Frontend runs on http://localhost:3000
```

### First Run

1. Open browser to `http://localhost:3000`
2. Select a consumer profile
3. Try these commands:
   - "I need to refill my blood pressure medication"
   - "Order 30 Metformin tablets"
   - "What medicines do you have for diabetes?"
   - Click the microphone icon to use voice input

## 🎯 Key Workflows

### 1. Conversational Ordering

**User**: "I think I'm running low on my BP meds"

**System Flow**:
1. **Conversation Agent** extracts intent: "refill" + "BP meds"
2. Fuzzy matches to "Amlodipine 5mg" or "Lisinopril 10mg"
3. **Safety Agent** checks:
   - Prescription requirement ✓
   - Stock availability ✓
   - Valid prescription on file ✓
4. **Action Agent** creates order, updates inventory
5. Triggers fulfillment webhook + sends confirmation

### 2. Proactive Refill Reminders

**Scheduled Process** (daily at 9 AM):
1. **Predictive Agent** analyzes all consumers
2. Calculates consumption rate from order history
3. Predicts depletion dates
4. Creates proactive alerts for medicines running low
5. User sees alert on next login: "You may be running low on Metformin. Want to refill?"

### 3. Safety Enforcement

**User**: "Order 1000 insulin vials"

**System Response**:
1. **Safety Agent** flags:
   - Quantity unusually high vs. history
   - Requires confirmation
2. Responds: "This is significantly more than your usual order. Please confirm."

**User**: "Order antibiotics without prescription"

**System Response**:
1. **Safety Agent** checks prescription requirement
2. Responds: "Prescription required but not found. Please upload a valid prescription."

## 📊 Admin Dashboard

Access via the "Admin" tab to monitor:

### Inventory Management
- Real-time stock levels
- Low stock alerts
- Prescription requirements
- Price information

### Order Tracking
- All orders with status
- Consumer details
- Fulfillment webhook status
- Order timestamps

### Proactive Alerts
- Refill reminders sent to consumers
- Low stock system alerts
- Alert delivery status

### Agent Observability
- Complete agent action log
- Decision reasoning
- Input/output data
- Execution status
- Timestamp tracking

## 🔍 Observability with Langfuse

All agent actions are traced in Langfuse:

1. **Conversation traces**: Intent extraction, fuzzy matching
2. **Safety traces**: All safety checks with reasoning
3. **Predictive traces**: Consumption analysis, alert decisions
4. **Action traces**: Database operations, webhook calls

Access your Langfuse dashboard to see:
- Complete conversation flows
- Agent-to-agent communication
- Decision trees
- Performance metrics

## 🗄️ Database Schema

### Core Tables
- `medicines`: Medicine master data with stock
- `consumers`: Patient/customer records
- `orders`: Order records
- `order_items`: Order line items
- `prescriptions`: Valid prescriptions on file
- `consumption_history`: Purchase patterns for predictions
- `proactive_alerts`: AI-generated refill reminders
- `agent_actions`: Complete agent activity log
- `conversation_sessions`: Chat sessions
- `conversation_messages`: Message history

## 🔧 Configuration

### Scheduled Predictions
Edit `.env`:
```
PREDICTION_SCHEDULE=0 9 * * *  # 9 AM daily
```

Cron format: `minute hour day month weekday`

### Webhook Configuration
```
FULFILLMENT_WEBHOOK_URL=https://your-webhook.com
NOTIFICATION_WEBHOOK_URL=https://your-notifications.com
```

### Voice Settings
Voice input/output uses browser's Web Speech API:
- Works in Chrome, Edge, Safari
- Requires microphone permissions
- Configurable in VoiceInput component

## 📱 API Endpoints

### Conversation
- `POST /api/conversation/start` - Start new session
- `POST /api/conversation/message` - Send message
- `GET /api/conversation/:sessionId/history` - Get history

### Consumers
- `GET /api/consumers` - List all consumers
- `GET /api/consumers/:id` - Get consumer details
- `GET /api/consumers/:id/alerts` - Get pending alerts

### Medicines
- `GET /api/medicines` - List all medicines
- `GET /api/medicines/:id` - Get medicine details

### Orders
- `GET /api/orders` - List orders (with filters)
- `GET /api/orders/:id` - Get order details

### Admin
- `GET /api/admin/inventory` - Inventory with status
- `GET /api/admin/alerts` - All proactive alerts
- `GET /api/admin/agent-actions` - Agent activity log
- `POST /api/admin/run-predictions` - Manually trigger predictions

## 🎨 Customization

### Adding New Medicines
1. Update `database/medicine_master.csv`
2. Run seed script or manually insert into database
3. Ensure stock quantity, price, and prescription flag are set

### Adding New Agents
1. Create new agent class in `backend/agents/`
2. Implement required methods with Langfuse tracing
3. Register in `AgentOrchestrator`
4. Update database schema if needed

### Voice Provider Alternative
To use Deepgram or ElevenLabs instead of Web Speech API:

1. Add API keys to `.env`
2. Update `VoiceInput.jsx` to use provider's SDK
3. Update `ChatInterface.jsx` for TTS

## 🚨 Important Notes

### Production Deployment
- Set `NODE_ENV=production`
- Use proper HTTPS for voice features
- Configure real webhook URLs
- Set up email/WhatsApp services
- Enable Langfuse for monitoring
- Set up database backups
- Configure rate limiting

### Security
- Never expose API keys in frontend
- Implement user authentication
- Validate all inputs
- Sanitize database queries (using parameterized queries)
- Implement CORS properly
- Use HTTPS in production

### Compliance
- This is a demo system
- Real pharmacy systems require:
  - HIPAA compliance (if in US)
  - Proper medical licensing
  - Prescription verification systems
  - Regulatory approval
  - Professional oversight

## 📈 Scaling Considerations

### Database
- Neon scales automatically
- Add indexes for large datasets
- Consider read replicas for analytics

### Backend
- Deploy multiple instances behind load balancer
- Use Redis for session management
- Implement request queuing for predictions

### LLM Costs
- Cache common queries
- Use embeddings for medicine matching
- Implement rate limiting
- Consider fine-tuned models for classification

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL

# Check if schema is applied
psql $DATABASE_URL -c "\dt"
```

### Voice Not Working
- Check browser compatibility (Chrome/Edge preferred)
- Ensure HTTPS (required for microphone access)
- Grant microphone permissions
- Check browser console for errors

### Agent Not Responding
- Check OpenAI API key validity
- Verify API rate limits not exceeded
- Check Langfuse connection (optional)
- Review backend logs

### Predictions Not Running
- Check cron schedule format
- Verify consumers have order history
- Check logs for errors
- Manually trigger via admin panel

## 📝 License

This project is a demonstration of agentic AI architecture for educational purposes.

## 🤝 Contributing

This is a production-ready template. Key areas for enhancement:
- Additional safety rules
- More sophisticated predictive models
- Integration with real prescription verification
- Multi-language support
- Mobile app development
- Advanced analytics dashboard

## 📞 Support

For issues or questions:
1. Check troubleshooting section
2. Review agent action logs in admin panel
3. Check Langfuse traces
4. Review backend console logs

---

**Built with**: React, Node.js, PostgreSQL, OpenAI, LangChain, Langfuse

**Architecture**: Multi-Agent AI System

**Status**: Production-Ready Demo
