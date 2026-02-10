import { Langfuse } from 'langfuse';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Langfuse for agent observability
export const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
  flushAt: 1, // Flush immediately for development
  flushInterval: 1000,
});

// Trace wrapper for agent actions
export class AgentTracer {
  constructor(sessionId, agentType) {
    this.sessionId = sessionId;
    this.agentType = agentType;
    this.trace = null;
  }

  startTrace(name, metadata = {}) {
    this.trace = langfuse.trace({
      name,
      sessionId: this.sessionId,
      metadata: {
        agentType: this.agentType,
        ...metadata
      }
    });
    return this.trace;
  }

  addSpan(name, input, metadata = {}) {
    if (!this.trace) {
      throw new Error('Trace not started. Call startTrace() first.');
    }
    
    return this.trace.span({
      name,
      input,
      metadata: {
        agentType: this.agentType,
        ...metadata
      }
    });
  }

  addGeneration(name, input, model, metadata = {}) {
    if (!this.trace) {
      throw new Error('Trace not started. Call startTrace() first.');
    }

    return this.trace.generation({
      name,
      input,
      model,
      metadata: {
        agentType: this.agentType,
        ...metadata
      }
    });
  }

  logDecision(decision, reasoning, metadata = {}) {
    if (!this.trace) {
      throw new Error('Trace not started. Call startTrace() first.');
    }

    this.trace.event({
      name: 'agent_decision',
      input: { decision, reasoning },
      metadata: {
        agentType: this.agentType,
        ...metadata
      }
    });
  }

  logToolCall(toolName, input, output, metadata = {}) {
    if (!this.trace) {
      throw new Error('Trace not started. Call startTrace() first.');
    }

    this.trace.event({
      name: 'tool_call',
      input: { toolName, input, output },
      metadata: {
        agentType: this.agentType,
        ...metadata
      }
    });
  }

  async end(output, metadata = {}) {
    if (this.trace) {
      this.trace.update({
        output,
        metadata: {
          agentType: this.agentType,
          ...metadata
        }
      });
    }
    await langfuse.flushAsync();
  }
}

// Helper to create traced agent execution
export async function traceAgentExecution(sessionId, agentType, actionName, execution) {
  const tracer = new AgentTracer(sessionId, agentType);
  tracer.startTrace(actionName);

  try {
    const result = await execution(tracer);
    await tracer.end(result);
    return result;
  } catch (error) {
    await tracer.end({ error: error.message }, { status: 'error' });
    throw error;
  }
}

export default langfuse;
