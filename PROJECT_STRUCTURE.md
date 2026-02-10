# 📁 Project Structure

```
pharmacy-ai-system/
│
├── README.md                          # Main documentation
├── QUICKSTART.md                      # 5-minute setup guide
├── ARCHITECTURE.md                    # Deep dive into system design
│
├── database/                          # Database assets
│   ├── schema.sql                     # PostgreSQL schema (Neon)
│   ├── medicine_master.csv            # Sample medicine data
│   └── consumer_orders.csv            # Sample order history
│
├── backend/                           # Node.js backend
│   ├── package.json                   # Dependencies
│   ├── .env.example                   # Environment template
│   ├── server.js                      # Express server & API routes
│   │
│   ├── config/                        # Configuration
│   │   ├── database.js                # Neon PostgreSQL connection
│   │   └── langfuse.js                # Observability setup
│   │
│   ├── agents/                        # Multi-agent system
│   │   ├── ConversationAgent.js       # NLP & intent extraction
│   │   ├── SafetyPolicyAgent.js       # Safety & compliance
│   │   ├── PredictiveIntelligenceAgent.js  # Refill predictions
│   │   ├── ActionExecutionAgent.js    # Real-world actions
│   │   └── AgentOrchestrator.js       # Agent coordination
│   │
│   └── scripts/                       # Utility scripts
│       └── seed-database.js           # Database seeding
│
└── frontend/                          # React frontend
    ├── package.json                   # Dependencies
    ├── vite.config.js                 # Vite configuration
    ├── index.html                     # HTML template
    │
    └── src/
        ├── main.jsx                   # React entry point
        ├── index.css                  # Global styles
        ├── App.jsx                    # Main app component
        ├── App.css                    # App styles
        │
        └── components/
            ├── ChatInterface.jsx      # Chat UI with voice
            ├── ChatInterface.css      # Chat styles
            ├── VoiceInput.jsx         # Voice recognition
            ├── VoiceInput.css         # Voice input styles
            ├── ConsumerSelector.jsx   # User selection
            ├── ConsumerSelector.css   # Selector styles
            ├── AdminDashboard.jsx     # Admin panel
            └── AdminDashboard.css     # Dashboard styles
```

## File Count by Type

```
JavaScript/JSX: 15 files
CSS:            6 files
SQL:            1 file
CSV:            2 files
JSON:           2 files
Markdown:       3 files
Config:         1 file
Total:          30 files
```

## Key Files Overview

### Backend Core

**server.js** (350 lines)
- Express server setup
- REST API endpoints
- Cron job scheduling
- Error handling

**AgentOrchestrator.js** (400 lines)
- Multi-agent workflow coordination
- Message routing
- Response composition
- Conversation management

### Agent Implementation

**ConversationAgent.js** (250 lines)
- GPT-4 integration
- Intent extraction
- Fuzzy medicine matching
- Response generation

**SafetyPolicyAgent.js** (350 lines)
- Prescription verification
- Stock checking
- Dosage safety (LLM-powered)
- Order history analysis

**PredictiveIntelligenceAgent.js** (300 lines)
- Consumption pattern analysis
- Depletion date calculation
- Proactive alert generation
- Scheduled predictions

**ActionExecutionAgent.js** (300 lines)
- Database operations
- Webhook triggers
- Email/WhatsApp notifications
- Transaction management

### Frontend Core

**App.jsx** (150 lines)
- Main application shell
- Navigation
- Consumer selection
- View routing

**ChatInterface.jsx** (350 lines)
- Message display
- Voice input/output integration
- Proactive alerts
- Quick actions

**AdminDashboard.jsx** (350 lines)
- Inventory management
- Order tracking
- Alert monitoring
- Agent observability

### Database

**schema.sql** (250 lines)
- 11 tables with relationships
- Indexes for performance
- Triggers for timestamps
- Foreign key constraints

### Documentation

**README.md** (800 lines)
- Complete system documentation
- Setup instructions
- API reference
- Troubleshooting guide

**QUICKSTART.md** (250 lines)
- 5-minute setup
- Common issues
- Demo scenarios
- Development tips

**ARCHITECTURE.md** (900 lines)
- System design deep dive
- Agent workflows
- Data flow diagrams
- Scalability considerations

## Technology Stack Summary

### Backend Dependencies
```json
{
  "express": "^4.18.2",           // Web framework
  "pg": "^8.11.3",                // PostgreSQL client
  "langchain": "^0.1.20",         // LLM orchestration
  "@langchain/openai": "^0.0.19", // OpenAI integration
  "langfuse": "^3.9.0",           // Observability
  "axios": "^1.6.5",              // HTTP client
  "node-cron": "^3.0.3",          // Scheduling
  "papaparse": "^5.4.1",          // CSV parsing
  "uuid": "^9.0.1",               // ID generation
  "date-fns": "^3.0.6"            // Date utilities
}
```

### Frontend Dependencies
```json
{
  "react": "^18.2.0",             // UI framework
  "react-dom": "^18.2.0",         // React DOM
  "axios": "^1.6.5",              // API client
  "date-fns": "^3.0.6",           // Date utilities
  "vite": "^5.0.11"               // Build tool
}
```

## Code Statistics

### Backend
- Total Lines: ~2,500
- Agent Code: ~1,600 lines
- Server & Config: ~900 lines
- Comments & Documentation: ~400 lines

### Frontend
- Total Lines: ~2,200
- Components: ~1,500 lines
- Styles (CSS): ~700 lines
- Comments: ~200 lines

### Database & Scripts
- SQL Schema: ~250 lines
- Seed Script: ~200 lines
- Sample Data: ~30 records

### Documentation
- Total Lines: ~2,000
- README: ~800 lines
- ARCHITECTURE: ~900 lines
- QUICKSTART: ~250 lines

## Development Workflow

### Adding a New Medicine
1. Update `database/medicine_master.csv`
2. Run `npm run seed` or manual SQL INSERT
3. Refresh frontend - auto-available

### Creating a New Agent
1. Create `backend/agents/NewAgent.js`
2. Implement with Langfuse tracing
3. Register in `AgentOrchestrator.js`
4. Update database schema if needed

### Adding a UI Feature
1. Create component in `frontend/src/components/`
2. Add styles in corresponding CSS file
3. Import and use in `App.jsx` or other components
4. Update API endpoints in `server.js` if needed

### Database Migration
1. Write migration SQL
2. Apply to Neon database
3. Update `schema.sql` for new installations
4. Update seed script if needed

## Deployment Structure

### Production Layout
```
/var/www/pharmacy-ai/
├── backend/
│   ├── node_modules/
│   ├── agents/
│   ├── config/
│   ├── scripts/
│   ├── server.js
│   └── .env
│
├── frontend/
│   └── dist/              # Built static files
│
└── nginx/
    └── pharmacy-ai.conf   # Nginx config
```

### Environment-Specific Files
```
Development:
- backend/.env (with dev credentials)
- Frontend dev server (Vite)

Production:
- backend/.env.production
- Frontend build (dist/)
- Nginx reverse proxy
- PM2 process manager
```

## API Endpoint Structure

```
/api/
├── /health                    GET    Health check
├── /conversation/
│   ├── /start                POST   Start session
│   ├── /message              POST   Send message
│   └── /:sessionId/history   GET    Get history
├── /consumers/
│   ├── /                     GET    List all
│   ├── /:id                  GET    Get one
│   └── /:id/alerts           GET    Get alerts
├── /medicines/
│   ├── /                     GET    List all
│   └── /:id                  GET    Get one
├── /orders/
│   ├── /                     GET    List all
│   └── /:id                  GET    Get details
└── /admin/
    ├── /inventory            GET    Stock status
    ├── /alerts               GET    All alerts
    ├── /agent-actions        GET    Action logs
    └── /run-predictions      POST   Trigger predictions
```

## Security Considerations

### API Keys (Never Commit)
- `.env` files
- API credentials
- Database passwords
- Webhook URLs

### Git Ignore Pattern
```
.env
.env.*
!.env.example
node_modules/
dist/
*.log
.DS_Store
```

## Testing Strategy

### Manual Testing
1. Start both servers
2. Test each user scenario
3. Check admin dashboard
4. Verify Langfuse traces

### Automated Testing (Future)
- Unit tests for agents
- Integration tests for API
- E2E tests for workflows

## Performance Benchmarks

### Expected Performance
- Message response: < 3 seconds
- Prediction batch: < 30 seconds (100 consumers)
- Database queries: < 100ms
- API endpoints: < 500ms

### Optimization Opportunities
- Cache medicine catalog
- Batch LLM requests
- Use embeddings for matching
- Database query optimization

---

This structure provides a clean, maintainable codebase that's easy to understand, extend, and deploy.
