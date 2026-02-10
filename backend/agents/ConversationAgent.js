import { ChatOpenAI } from '@langchain/openai';
import { AgentTracer } from '../config/langfuse.js';
import { query } from '../config/database.js';

/**
 * Conversation Agent - Front-Facing AI
 * Handles messy, real human text and voice
 * Extracts intent and entities from natural language
 */
export class ConversationAgent {
  constructor() {
    this.model = new ChatOpenAI({
      modelName: 'gpt-4-turbo-preview',
      temperature: 0.3,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Extract structured intent from user message
   */
  async extractIntent(userMessage, conversationHistory = [], sessionId) {
    const tracer = new AgentTracer(sessionId, 'conversation');
    const trace = tracer.startTrace('extract_intent');

    const systemPrompt = `You are a helpful pharmacy assistant AI. Your job is to understand what customers want and extract key information.

Extract from the user's message:
1. Intent: order, refill, question, complaint, greeting, other
2. Medicine names (allow fuzzy matching, common misspellings)
3. Quantity (if mentioned)
4. Dosage/frequency (if mentioned)
5. Any concerns or questions

Be conversational and friendly. If information is unclear, identify what clarification is needed.

Return your analysis as JSON:
{
  "intent": "order|refill|question|complaint|greeting|other",
  "medicines": [{"name": "medicine name", "confidence": 0.9}],
  "quantity": number or null,
  "dosage_frequency": "string or null",
  "clarification_needed": ["list of questions to ask"],
  "user_concern": "string or null",
  "next_action": "what should happen next"
}`;

    const conversationContext = conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = `Previous conversation:
${conversationContext}

Current user message: "${userMessage}"

Analyze and extract intent:`;

    try {
      const generation = tracer.addGeneration(
        'llm_intent_extraction',
        { systemPrompt, prompt },
        'gpt-4-turbo-preview'
      );

      const response = await this.model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]);

      const content = response.content;
      generation.end({ output: content });

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      let extracted = {};
      
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback parsing
        extracted = {
          intent: 'question',
          clarification_needed: ['Could you please clarify what you need?'],
          next_action: 'ask_clarification'
        };
      }

      tracer.logDecision(
        `Intent: ${extracted.intent}`,
        `Extracted from user message: ${userMessage}`,
        { extracted }
      );

      await tracer.end(extracted);
      return extracted;

    } catch (error) {
      console.error('Error in intent extraction:', error);
      await tracer.end({ error: error.message }, { status: 'error' });
      throw error;
    }
  }

  /**
   * Fuzzy match medicine names from user input
   */
  async fuzzyMatchMedicine(medicineName, sessionId) {
    const tracer = new AgentTracer(sessionId, 'conversation');
    tracer.startTrace('fuzzy_match_medicine');

    try {
      // Get all medicines from database
      const result = await query(
        'SELECT medicine_name, generic_name FROM medicines'
      );

      const medicines = result.rows;
      
      // Use LLM to find best match
      const systemPrompt = `You are a medicine name matcher. Given a user's input and a list of available medicines, find the best match.
Consider:
- Common misspellings
- Generic vs brand names
- Partial matches
- Common abbreviations (e.g., "BP meds" = blood pressure medications)

Return JSON:
{
  "matched_medicine": "exact medicine name from list or null",
  "confidence": 0.0 to 1.0,
  "alternatives": ["other possible matches"]
}`;

      const prompt = `User mentioned: "${medicineName}"

Available medicines:
${medicines.map(m => `- ${m.medicine_name} (${m.generic_name})`).join('\n')}

Find the best match:`;

      const response = await this.model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]);

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      const match = jsonMatch ? JSON.parse(jsonMatch[0]) : { matched_medicine: null, confidence: 0 };

      tracer.logDecision(
        `Matched: ${match.matched_medicine}`,
        `Confidence: ${match.confidence}`,
        match
      );

      await tracer.end(match);
      return match;

    } catch (error) {
      console.error('Error in fuzzy matching:', error);
      await tracer.end({ error: error.message }, { status: 'error' });
      throw error;
    }
  }

  /**
   * Generate conversational response
   */
  async generateResponse(context, sessionId) {
    const tracer = new AgentTracer(sessionId, 'conversation');
    tracer.startTrace('generate_response');

    const systemPrompt = `You are a friendly, helpful pharmacy assistant. 
You help customers order medications, answer questions, and provide helpful information.

Guidelines:
- Be warm and conversational
- Never provide medical advice - always recommend consulting a doctor
- Ask clarifying questions when needed
- Confirm orders clearly before proceeding
- Explain safety rules politely if an order cannot be fulfilled

Keep responses concise and natural.`;

    try {
      const response = await this.model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(context) }
      ]);

      const responseText = response.content;
      
      tracer.logDecision(
        'Generated response',
        'Created user-friendly message',
        { context, response: responseText }
      );

      await tracer.end({ response: responseText });
      return responseText;

    } catch (error) {
      console.error('Error generating response:', error);
      await tracer.end({ error: error.message }, { status: 'error' });
      throw error;
    }
  }
}

export default ConversationAgent;
