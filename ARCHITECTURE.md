# 🏗️ System Architecture Deep Dive

## Overview

The Agentic AI Pharmacy System implements a **multi-agent architecture** where specialized AI agents collaborate to provide autonomous, safe, and intelligent pharmacy operations.

## Design Principles

### 1. Agent Specialization
Each agent has a single, well-defined responsibility:
- **Conversation Agent**: Human interface & language understanding
- **Safety Agent**: Rule enforcement & compliance
- **Predictive Agent**: Pattern analysis & proactive behavior
- **Action Agent**: Real-world execution & side effects

### 2. Never Hallucinate Actions
Agents use **tool calling** to interact with the real world:
- Database queries are actual SQL operations
- Webhooks are real HTTP requests
- No simulated or imaginary side effects

### 3. Complete Observability
Every agent action is traced via Langfuse:
- Input/output logging
- Decision reasoning
- Execution status
- Agent-to-agent communication

### 4. Safety First
Multiple safety layers:
- Prescription verification
- Stock availability checks
- Dosage safety analysis
- Order history anomaly detection

## Agent Architecture

### Conversation Agent

**Purpose**: Front-facing AI that understands human language

**Responsibilities**:
- Extract intent from natural language
- Fuzzy match medicine names
- Handle conversational context
- Generate user-friendly responses
- Ask clarifying questions

**Technology**:
- LLM: GPT-4 Turbo (temperature: 0.3 for controlled creativity)
- Pattern: Few-shot prompting with structured outputs

**Key Methods**:
```javascript
extractIntent(userMessage, conversationHistory, sessionId)
  → { intent, medicines, quantity, clarification_needed }

fuzzyMatchMedicine(medicineName, sessionId)
  → { matched_medicine, confidence, alternatives }

generateResponse(context, sessionId)
  → conversationalText
```

**Example Flow**:
```
User: "I think I'm running low on my BP meds"

1. Extract intent:
   - Intent: refill
   - Medicines: [{ name: "BP meds", confidence: 0.7 }]
   - Quantity: null
   - Clarification: ["Which BP medication?", "How many?"]

2. Fuzzy match:
   - Input: "BP meds"
   - Matches: ["Amlodipine 5mg", "Lisinopril 10mg"]
   - Confidence: 0.85

3. Generate response:
   "I found your blood pressure medications. Do you want to refill 
    Amlodipine 5mg or Lisinopril 10mg?"
```

### Safety & Policy Agent

**Purpose**: Pharmacist brain - enforces all safety rules

**Responsibilities**:
- Check prescription requirements
- Verify stock availability
- Analyze dosage safety
- Detect unusual order patterns
- Make go/no-go decisions

**Technology**:
- LLM: GPT-4 Turbo (temperature: 0 for deterministic decisions)
- Pattern: Chain-of-thought reasoning with structured validation

**Safety Checks**:

1. **Stock Check**:
```javascript
if (requestedQuantity > availableStock) {
  return REJECTED: "Insufficient stock"
}
```

2. **Prescription Check**:
```javascript
if (medicine.prescription_required) {
  prescription = await query(
    "SELECT * FROM prescriptions WHERE consumer_id = ? 
     AND medicine_id = ? AND verified = true 
     AND expiry_date > CURRENT_DATE"
  )
  if (!prescription) {
    return REJECTED: "Prescription required"
  }
}
```

3. **Dosage Safety Check** (LLM-powered):
```javascript
Prompt: "Evaluate if {quantity} {medicine} with 
         {dosage_frequency} is safe and reasonable"
         
LLM analyzes:
- Typical dosage ranges
- Red flags for abuse
- Consistency with medical standards

Returns: { passed: true/false, severity, reason }
```

4. **Order History Check**:
```javascript
if (requestedQuantity > averageQuantity * 2) {
  return WARNING: "Significantly higher than usual"
}
```

**Decision Matrix**:
```
All checks pass → APPROVED
Critical check fails → REJECTED
Non-critical fails → REQUIRES_ACTION
```

### Predictive Intelligence Agent

**Purpose**: Analyze patterns & proactively initiate conversations

**Responsibilities**:
- Analyze consumption history
- Calculate depletion dates
- Trigger refill reminders
- Predict stockouts
- Generate proactive alerts

**Technology**:
- LLM: GPT-4 Turbo (temperature: 0.1 for stable predictions)
- Pattern: Time-series analysis + LLM decision-making
- Scheduler: node-cron for daily execution

**Prediction Algorithm**:

1. **Consumption Rate Calculation**:
```javascript
orders = getOrderHistory(consumer, medicine)
  .sortBy(date)

daysBetweenOrders = averageDelta(orders.map(o => o.date))
averageQuantity = average(orders.map(o => o.quantity))
```

2. **Depletion Prediction**:
```javascript
lastOrder = orders[0]
expectedDepletionDate = lastOrder.date + daysBetweenOrders
daysUntilDepletion = today - expectedDepletionDate
```

3. **Alert Decision** (LLM-powered):
```javascript
Prompt: "Given: {medicine}, {daysUntilDepletion}, 
         {prescriptionRequired}. Should we alert?"

LLM considers:
- Time urgency (< 7 days)
- Prescription lead time
- Recent orders (avoid spam)

Returns: { alert: true/false, urgency, message }
```

4. **Confidence Scoring**:
```javascript
confidence = 0.5  // baseline
if (orderCount >= 5) confidence += 0.3
if (consistentInterval) confidence += 0.2
return min(confidence, 0.95)
```

**Scheduled Execution**:
```javascript
cron.schedule('0 9 * * *', async () => {
  consumers = getAllActiveConsumers()
  for (consumer of consumers) {
    predictions = await predictRefills(consumer)
    createProactiveAlerts(predictions)
  }
})
```

### Action Execution Agent

**Purpose**: Execute real-world actions without hallucination

**Responsibilities**:
- Create database records
- Update inventory
- Trigger webhooks
- Send notifications
- Log all actions

**Technology**:
- Direct database operations (no LLM)
- HTTP clients for webhooks
- Transactional safety

**Action Patterns**:

1. **Atomic Transactions**:
```javascript
async createOrder(orderData) {
  const client = await db.getClient()
  try {
    await client.query('BEGIN')
    
    // Create order
    order = await client.query('INSERT INTO orders...')
    
    // Create items
    for (item of orderData.items) {
      await client.query('INSERT INTO order_items...')
      await updateInventory(item.medicineId, -item.quantity)
    }
    
    await client.query('COMMIT')
    return order
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}
```

2. **Webhook Execution**:
```javascript
async triggerFulfillmentWebhook(order) {
  payload = {
    event: 'order.created',
    order: { id, items, total }
  }
  
  try {
    response = await axios.post(webhookUrl, payload)
    await markWebhookSent(order.id)
  } catch (error) {
    await logWebhookFailure(order.id, error)
  }
}
```

3. **Idempotency**:
```javascript
// Prevent duplicate actions
await query(`
  INSERT INTO agent_actions (session_id, action_type, ...)
  VALUES (?, ?, ...)
  ON CONFLICT (session_id, action_type) DO NOTHING
`)
```

## Orchestration Flow

### Message Processing Pipeline

```
User Message
    ↓
┌─────────────────────────┐
│ Orchestrator            │
│ 1. Route to agents      │
│ 2. Coordinate workflow  │
│ 3. Return response      │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ Conversation Agent      │
│ Extract intent          │
│ Fuzzy match medicine    │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ Safety Agent            │
│ Run all safety checks   │
│ Make decision           │
└─────────────────────────┘
    ↓
Decision: APPROVED?
    ↓ Yes
┌─────────────────────────┐
│ Action Agent            │
│ Create order            │
│ Update inventory        │
│ Trigger webhooks        │
└─────────────────────────┘
    ↓
Response to User
```

### Decision Flow Example

**User**: "Order 60 Metformin tablets"

```
Orchestrator.processUserMessage()
  ↓
ConversationAgent.extractIntent()
  Returns: { intent: "order", medicines: ["Metformin"], quantity: 60 }
  ↓
ConversationAgent.fuzzyMatchMedicine("Metformin")
  Returns: { matched: "Metformin 500mg", confidence: 0.95 }
  ↓
SafetyAgent.evaluateOrderSafety()
  ├─ Check 1: Stock (500 tablets) ✓
  ├─ Check 2: Prescription (on file) ✓
  ├─ Check 3: Dosage (twice daily for 30 days) ✓
  └─ Check 4: History (consistent with past) ✓
  Returns: { decision: "APPROVED" }
  ↓
ActionAgent.createOrder()
  ├─ INSERT INTO orders
  ├─ INSERT INTO order_items
  ├─ UPDATE medicines SET stock = stock - 60
  └─ Returns: { order: { id: 123 } }
  ↓
ActionAgent.confirmOrderAndAutomate()
  ├─ UPDATE orders SET status = 'confirmed'
  ├─ POST webhook (fulfillment)
  └─ Send email/WhatsApp confirmation
  ↓
ConversationAgent.generateResponse()
  Returns: "Perfect! Order #123 confirmed..."
```

## Data Flow

### Database Operations

**Write Operations** (Action Agent only):
- Orders: CREATE, UPDATE
- Inventory: UPDATE
- Alerts: CREATE
- Prescriptions: CREATE (admin)

**Read Operations** (All agents):
- Conversation Agent: Medicines, Order History
- Safety Agent: Medicines, Prescriptions, Orders
- Predictive Agent: Orders, Consumption History
- Action Agent: All tables (for validation)

### Event-Driven Patterns

**Order Created**:
```
Order Created
  ↓
ActionAgent.confirmOrderAndAutomate()
  ├→ Webhook: Fulfillment system
  ├→ Email: Customer confirmation
  ├→ WhatsApp: Order notification
  └→ Database: Update stock, log action
```

**Low Stock Detected**:
```
Inventory Update
  ↓
if (newStock < threshold)
  ↓
ActionAgent.triggerLowStockAlert()
  ├→ Create proactive alert
  ├→ Notify procurement team
  └→ Admin dashboard update
```

**Prediction Scheduled**:
```
Cron: Daily 9 AM
  ↓
PredictiveAgent.analyzeAllConsumers()
  ├→ For each consumer:
  │   ├→ Calculate depletion dates
  │   ├→ LLM decision on alerting
  │   └→ Create proactive alerts
  └→ Langfuse: Log predictions
```

## Observability Architecture

### Langfuse Integration

**Trace Hierarchy**:
```
Conversation Session (Trace)
├─ Message Processing (Span)
│  ├─ Intent Extraction (Generation)
│  ├─ Fuzzy Matching (Generation)
│  └─ Safety Check (Span)
│     ├─ Stock Check (Event)
│     ├─ Prescription Check (Event)
│     └─ Dosage Analysis (Generation)
└─ Order Creation (Span)
   ├─ Database Insert (Event)
   └─ Webhook Trigger (Event)
```

**Trace Example**:
```javascript
const tracer = new AgentTracer(sessionId, 'safety_policy')
tracer.startTrace('evaluate_order_safety')

const span = tracer.addSpan('prescription_check', { medicineId })
// ... perform check
span.end({ result: 'valid prescription found' })

tracer.logDecision(
  'APPROVED',
  'All safety checks passed',
  { checks: [...] }
)

await tracer.end({ decision: 'APPROVED' })
```

### Logging Strategy

**Agent Actions Table**:
```sql
INSERT INTO agent_actions (
  session_id,
  agent_type,
  action_type,
  input_data,    -- JSONB: What the agent received
  output_data,   -- JSONB: What the agent produced
  reasoning,     -- TEXT: Why this decision
  decision,      -- VARCHAR: APPROVED/REJECTED/etc
  execution_status  -- VARCHAR: success/failed
)
```

**Log Levels**:
- Agent decision points: Always logged
- Tool calls: Always logged
- LLM prompts/responses: Logged to Langfuse
- Database operations: Logged with timing
- Errors: Logged with full stack trace

## Scalability Considerations

### Horizontal Scaling

**Stateless Backend**:
- No in-memory session state
- All state in database or Redis
- Can run multiple instances behind load balancer

**Database Connection Pooling**:
```javascript
const pool = new Pool({
  max: 20,              // Max connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
})
```

**Async Agent Operations**:
```javascript
// Predictive analysis runs in background
async function scheduledPredictions() {
  const predictions = await predictiveAgent.analyzeAll()
  // Non-blocking - doesn't hold up API requests
}
```

### Performance Optimization

**Caching Strategy**:
- Medicine catalog: Cache in Redis (rarely changes)
- Consumer prescriptions: Cache with TTL
- Order history: Paginated queries

**LLM Cost Optimization**:
- Intent classification: Can use fine-tuned model
- Medicine matching: Can use embeddings + vector search
- Safety checks: Cache common scenarios
- Predictive decisions: Batch processing

**Database Indexing**:
```sql
CREATE INDEX idx_medicines_name ON medicines(medicine_name);
CREATE INDEX idx_orders_consumer_date ON orders(consumer_id, order_date);
CREATE INDEX idx_prescriptions_consumer_medicine 
  ON prescriptions(consumer_id, medicine_id);
```

## Security Architecture

### Input Validation

**SQL Injection Prevention**:
```javascript
// ✅ Good: Parameterized queries
await query('SELECT * FROM medicines WHERE id = $1', [medicineId])

// ❌ Bad: String concatenation
await query(`SELECT * FROM medicines WHERE id = ${medicineId}`)
```

**LLM Prompt Injection Defense**:
```javascript
// Separate user content from system instructions
const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: userInput }  // Isolated
]
```

### Data Privacy

**PII Protection**:
- Consumer data encrypted at rest (database level)
- Prescription URLs use signed URLs
- Agent logs: Redact PII before Langfuse

**Access Control**:
```javascript
// Admin endpoints require authentication
if (req.path.startsWith('/api/admin')) {
  requireAuth(req, res, next)
}
```

## Error Handling

### Agent Failures

**Graceful Degradation**:
```javascript
try {
  const intent = await conversationAgent.extractIntent(message)
} catch (error) {
  // Fallback: Use simple keyword matching
  const intent = simpleIntentClassifier(message)
}
```

**Retry Logic**:
```javascript
async function callLLMWithRetry(prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await llm.invoke(prompt)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await sleep(2 ** i * 1000)  // Exponential backoff
    }
  }
}
```

### Transaction Rollback

**Database Consistency**:
```javascript
try {
  await client.query('BEGIN')
  await createOrder()
  await updateInventory()
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
}
```

## Future Enhancements

### Potential Agent Additions

**Fraud Detection Agent**:
- Analyze order patterns for suspicious activity
- Flag unusual refill frequencies
- Detect prescription forgery

**Inventory Management Agent**:
- Auto-order when stock low
- Optimize reorder quantities
- Predict demand trends

**Customer Service Agent**:
- Handle complaints
- Process returns
- Answer FAQs

### Advanced Features

**Multi-turn Conversations**:
- State machine for complex workflows
- Context preservation across sessions
- Proactive follow-ups

**Personalization**:
- Learn user preferences
- Adapt communication style
- Recommend complementary products

**Integration Enhancements**:
- Real prescription verification APIs
- Insurance claims processing
- Doctor consultation booking

---

This architecture provides a solid foundation for an autonomous, safe, and scalable pharmacy system while maintaining complete observability and control.
