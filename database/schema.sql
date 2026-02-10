-- Agentic AI Pharmacy System - Database Schema
-- PostgreSQL (Neon Serverless)

-- Medicine Master Data Table
CREATE TABLE medicines (
    id SERIAL PRIMARY KEY,
    medicine_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    unit_type VARCHAR(50) NOT NULL, -- tablets, ml, capsules, etc.
    prescription_required BOOLEAN NOT NULL DEFAULT false,
    dosage_info TEXT,
    category VARCHAR(100),
    price DECIMAL(10, 2),
    manufacturer VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consumer/Patient Table
CREATE TABLE consumers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order History Table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    consumer_id INTEGER REFERENCES consumers(id),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL, -- pending, confirmed, fulfilled, cancelled
    total_amount DECIMAL(10, 2),
    prescription_url TEXT,
    fulfillment_webhook_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Items Table
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    medicine_id INTEGER REFERENCES medicines(id),
    quantity INTEGER NOT NULL,
    dosage_frequency VARCHAR(100), -- "twice daily", "once daily", etc.
    unit_price DECIMAL(10, 2),
    subtotal DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prescription Records
CREATE TABLE prescriptions (
    id SERIAL PRIMARY KEY,
    consumer_id INTEGER REFERENCES consumers(id),
    medicine_id INTEGER REFERENCES medicines(id),
    prescribed_by VARCHAR(255),
    prescription_date DATE,
    expiry_date DATE,
    prescription_url TEXT,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consumption History (for predictive intelligence)
CREATE TABLE consumption_history (
    id SERIAL PRIMARY KEY,
    consumer_id INTEGER REFERENCES consumers(id),
    medicine_id INTEGER REFERENCES medicines(id),
    purchase_date TIMESTAMP,
    quantity INTEGER,
    dosage_frequency VARCHAR(100),
    expected_depletion_date DATE,
    actual_refill_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent Actions Log (for observability)
CREATE TABLE agent_actions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255),
    agent_type VARCHAR(100), -- conversation, safety, predictive, action
    action_type VARCHAR(100), -- order_created, safety_check, refill_prediction, etc.
    input_data JSONB,
    output_data JSONB,
    reasoning TEXT,
    decision VARCHAR(50), -- approved, rejected, pending
    execution_status VARCHAR(50), -- success, failed, pending
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Proactive Alerts
CREATE TABLE proactive_alerts (
    id SERIAL PRIMARY KEY,
    consumer_id INTEGER REFERENCES consumers(id),
    medicine_id INTEGER REFERENCES medicines(id),
    alert_type VARCHAR(50), -- refill_reminder, low_stock, prescription_expiry
    alert_message TEXT,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent BOOLEAN DEFAULT false,
    consumer_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversation Sessions
CREATE TABLE conversation_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) UNIQUE NOT NULL,
    consumer_id INTEGER REFERENCES consumers(id),
    channel VARCHAR(50), -- text, voice
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversation Messages
CREATE TABLE conversation_messages (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES conversation_sessions(session_id),
    role VARCHAR(50), -- user, assistant, system
    content TEXT NOT NULL,
    audio_url TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_medicines_name ON medicines(medicine_name);
CREATE INDEX idx_orders_consumer ON orders(consumer_id);
CREATE INDEX idx_orders_date ON orders(order_date);
CREATE INDEX idx_order_items_medicine ON order_items(medicine_id);
CREATE INDEX idx_consumption_consumer ON consumption_history(consumer_id);
CREATE INDEX idx_agent_actions_session ON agent_actions(session_id);
CREATE INDEX idx_agent_actions_type ON agent_actions(agent_type);
CREATE INDEX idx_alerts_consumer ON proactive_alerts(consumer_id);
CREATE INDEX idx_conversation_session ON conversation_messages(session_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_medicines_updated_at BEFORE UPDATE ON medicines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_consumers_updated_at BEFORE UPDATE ON consumers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
