import { AgentTracer } from '../config/langfuse.js';
import { query } from '../config/database.js';
import { ChatGroq } from "@langchain/groq";

/**
 * Conversation Agent - Front-Facing AI
 * Handles messy, real human text and voice
 * Extracts intent and entities from natural language
 */
export class ConversationAgent {
  constructor() {
    this.model = new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      apiKey: process.env.GROQ_API_KEY, // Free at console.groq.com
    });
  }

  /**
   * Extract structured intent from user message
   */
  async extractIntent(userMessage, conversationHistory = [], sessionId) {
    // Ensure conversationHistory is an array
    if (!Array.isArray(conversationHistory)) {
      conversationHistory = [];
    }

    const historyContext = conversationHistory
      .slice(-5)
      .map(m => `${m.role}: ${m.content}`)
      .join('\n');

    const systemPrompt = `You are a pharmacy AI assistant. Extract the user's intent from their message.

Context from previous messages:
${historyContext}

Analyze the message and return JSON with:
{
  "intent": "order" | "refill" | "question" | "complaint" | "greeting" | "clarification",
  "medicines": [
    {
      "name": "medicine name",
      "quantity": number (if specified),
      "dosage_frequency": "how often" (if specified),
      "confidence": 0.0-1.0
    }
  ],
  "user_concern": "brief summary if complaint/question",
  "clarification_needed": ["list of missing info"],
  "next_action": "what to do next"
}

IMPORTANT: 
- Extract ALL medicines mentioned in the message
- If user says "and", "also", "plus", they want multiple medicines
- Examples:
  * "I need Aspirin and Paracetamol" → 2 medicines
  * "Order Metformin 30 tablets and Amlodipine 60 tablets" → 2 medicines
  * "Refill my BP meds and diabetes medication" → 2 medicines (but need clarification on names)
- Default quantity is 30 if not specified`;

    try {
      const response = await this.model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]);

      let content = response.content.trim();
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          intent: 'question',
          medicines: [],
          clarification_needed: [],
          user_concern: userMessage,
          next_action: 'respond conversationally'
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Ensure medicines is always an array
      if (!Array.isArray(parsed.medicines)) {
        parsed.medicines = [];
      }

      return parsed;
    } catch (error) {
      console.error('Error extracting intent:', error);
      return {
        intent: 'question',
        medicines: [],
        clarification_needed: [],
        user_concern: userMessage,
        next_action: 'respond conversationally'
      };
    }
  }

  /**
   * Fuzzy match medicine names from user input
   */
/**
 * Fuzzy match medicine names from user input
 */
async fuzzyMatchMedicine(medicineName, sessionId) {
  const tracer = new AgentTracer(sessionId, 'conversation');
  tracer.startTrace('fuzzy_match_medicine');

  try {
    // Get all medicines from database
    const result = await query(
      'SELECT * FROM medicines ORDER BY medicine_name'
    );

    const medicines = result.rows;
    
    if (medicines.length === 0) {
      console.log('No medicines in database');
      await tracer.end({ matched: null });
      return null;
    }
    
    // Use LLM to find best match
    const systemPrompt = `You are a medicine name matcher. Given a user's input and a list of available medicines, find the best match.

Consider:
- User might say just the base name (e.g., "Paracetamol" when database has "Paracetamol 500mg")
- Common misspellings (e.g., "Paracetemol" → "Paracetamol")
- Generic vs brand names
- Partial matches
- Common abbreviations (e.g., "BP meds" = blood pressure medications)

CRITICAL: Return ONLY valid JSON with the EXACT medicine_name from the list:
{
  "matched_medicine": "exact name from list",
  "confidence": 0.95
}

If no match found:
{
  "matched_medicine": null,
  "confidence": 0
}`;

    const prompt = `User mentioned: "${medicineName}"

Available medicines (select the EXACT name from this list):
${medicines.slice(0, 50).map(m => `- ${m.medicine_name}`).join('\n')}

Return ONLY the JSON object with the EXACT matched name:`;

    const response = await this.model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]);

    // Clean up response
    let jsonText = response.content.trim();
    
    // Remove markdown code blocks
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Extract JSON from text
    const jsonMatch = jsonText.match(/\{[\s\S]*?\}/);
    
    if (!jsonMatch) {
      console.error('No JSON found in LLM response');
      throw new Error('Invalid response format from LLM');
    }

    const match = JSON.parse(jsonMatch[0]);

    console.log('🔍 LLM Match Result:', match);

    // If we found a match, get full medicine details from database
    if (match.matched_medicine && match.confidence > 0.5) {
      // Find the medicine in our list by exact name match
      const foundMedicine = medicines.find(m => 
        m.medicine_name.toLowerCase() === match.matched_medicine.toLowerCase()
      );

      if (foundMedicine) {
        tracer.logDecision(
          `Matched: ${foundMedicine.medicine_name}`,
          `Confidence: ${match.confidence}`,
          foundMedicine
        );

        await tracer.end(foundMedicine);
        return foundMedicine;
      } else {
        console.log('LLM returned medicine not in database:', match.matched_medicine);
      }
    }

    // Fallback: Try direct database search with ILIKE
    console.log('Trying fallback database search...');
    const fallbackResult = await query(
      'SELECT * FROM medicines WHERE medicine_name ILIKE $1 OR generic_name ILIKE $1 LIMIT 1',
      [`%${medicineName}%`]
    );
    
    if (fallbackResult.rows.length > 0) {
      console.log('✅ Fallback found:', fallbackResult.rows[0].medicine_name);
      await tracer.end(fallbackResult.rows[0]);
      return fallbackResult.rows[0];
    }

    console.log('❌ No match found for:', medicineName);
    await tracer.end({ matched: null });
    return null;

  } catch (error) {
    console.error('Error in fuzzy matching:', error);
    await tracer.end({ error: error.message }, { status: 'error' });
    
    // Final fallback: Direct database search
    try {
      const result = await query(
        'SELECT * FROM medicines WHERE medicine_name ILIKE $1 OR generic_name ILIKE $1 LIMIT 1',
        [`%${medicineName}%`]
      );
      
      if (result.rows.length > 0) {
        console.log('✅ Emergency fallback found:', result.rows[0].medicine_name);
        return result.rows[0];
      }
    } catch (dbError) {
      console.error('Database fallback error:', dbError);
    }
    
    return null;
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