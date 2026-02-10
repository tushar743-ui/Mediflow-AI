# 🚀 Quick Start Guide

## 5-Minute Setup

### Step 1: Environment Variables (2 min)

Create `backend/.env`:
```bash
# Required
DATABASE_URL=postgresql://user:pass@host/pharmacy_db?sslmode=require
OPENAI_API_KEY=sk-...

# Optional (for full features)
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com

# Development defaults
PORT=3001
NODE_ENV=development
FULFILLMENT_WEBHOOK_URL=https://webhook.site/your-unique-url
```

### Step 2: Database Setup (1 min)

```bash
# Apply schema
psql $DATABASE_URL < database/schema.sql

# Seed with sample data
cd backend
npm install
npm run seed
```

### Step 3: Start Servers (1 min)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Step 4: Test the System (1 min)

1. Open http://localhost:3000
2. Select "John Smith"
3. Say or type: "I need to refill my Metformin"
4. Watch the multi-agent system work! 🎉

## What Just Happened?

When you sent that message:

1. **Conversation Agent** understood "refill" + "Metformin"
2. **Safety Agent** checked:
   - ✅ Prescription on file
   - ✅ Stock available (500 tablets)
   - ✅ Dosage is safe
3. **Action Agent** created the order
4. System sent fulfillment webhook + confirmation

Check the Admin tab to see:
- Order in the orders table
- Agent decisions in agent actions log
- Updated inventory

## Try These Commands

### Voice Commands
Click the 🎤 button and say:
- "Order 30 Paracetamol tablets"
- "What medicines do you have for allergies?"
- "Show my recent orders"

### Text Commands
Type in the chat:
- "I'm running low on my diabetes medication"
- "What's the price of Aspirin?"
- "Do I need a prescription for Vitamin D?"

### Proactive Features
1. Go to Admin tab
2. Click "🔮 Run Predictions"
3. Switch back to Chat
4. Logout and login as "Sarah Johnson"
5. See proactive refill reminder! 🔔

## Common First-Run Issues

### "Cannot connect to database"
- Check DATABASE_URL in .env
- Test: `psql $DATABASE_URL -c "SELECT 1"`
- Ensure schema.sql was applied

### "OpenAI API error"
- Verify OPENAI_API_KEY is valid
- Check API credits/rate limits
- Try: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

### "Voice not working"
- Use Chrome or Edge browser
- Ensure HTTPS (voice requires secure context)
- Grant microphone permissions
- Check browser console for errors

### "No consumers showing up"
- Run seed script: `npm run seed`
- Check database: `psql $DATABASE_URL -c "SELECT * FROM consumers"`

## Next Steps

### Explore the Admin Dashboard
- View real-time inventory
- Monitor all orders
- See proactive alerts
- Inspect agent decision logs

### Understand the Architecture
- Read ARCHITECTURE.md for deep dive
- Check agent code in `backend/agents/`
- Review database schema in `database/schema.sql`

### Customize the System
- Add medicines to `database/medicine_master.csv`
- Create new consumers
- Modify agent prompts
- Add custom safety rules

### Deploy to Production
See DEPLOYMENT.md for:
- Hosting recommendations
- Security hardening
- Performance optimization
- Monitoring setup

## Demo Scenarios

### Scenario 1: Safety Enforcement
Try ordering prescription medicine without prescription:
- Login as new user (no prescriptions)
- "Order Amoxicillin"
- System will reject: "Prescription required but not found"

### Scenario 2: Stock Limitation
Try ordering more than available:
- "Order 1000 Insulin Glargine vials"
- System will reject: "Insufficient stock. Available: 40"

### Scenario 3: Predictive Refills
- Use system for 30 days (or manipulate order dates)
- Run predictions
- See proactive refill reminders

### Scenario 4: Complete Order Flow
1. User: "I need my blood pressure medication"
2. System: Matches to Amlodipine or Lisinopril
3. User: "The 5mg one, 30 tablets"
4. System: Runs safety checks
5. System: Creates order + sends webhook
6. Check admin panel for complete audit trail

## Support Resources

- 📖 Full documentation: README.md
- 🏗️ Architecture details: ARCHITECTURE.md
- 🚀 Deployment guide: DEPLOYMENT.md
- 🐛 Troubleshooting: Check agent logs in admin panel
- 📊 Monitoring: Langfuse dashboard (if configured)

## Development Tips

### Hot Reload
Both frontend and backend support hot reload:
- Frontend: Changes reflect immediately
- Backend: Nodemon restarts on file changes

### Debugging
- Frontend: Browser DevTools + React DevTools
- Backend: Console logs + Langfuse traces
- Database: pgAdmin or TablePlus

### Testing Agents
Use the orchestrator directly:
```javascript
import AgentOrchestrator from './agents/AgentOrchestrator.js';

const orchestrator = new AgentOrchestrator();
const response = await orchestrator.processUserMessage(
  "Order 30 Paracetamol",
  "test-session",
  1
);
console.log(response);
```

---

**You're ready to go! 🎉**

The system is now running and ready to demonstrate autonomous, intelligent pharmacy operations with full observability and safety enforcement.
