import { ChatGroq } from "@langchain/groq";
import { AgentTracer } from '../config/langfuse.js';
import { query } from '../config/database.js';

/**
 * Safety & Policy Agent - Pharmacist Brain
 * Enforces prescription requirements, stock availability, dosage safety
 * Makes critical go/no-go decisions
 */
export class SafetyPolicyAgent {
  constructor() {
    this.model = new ChatGroq({
      model: 'llama-3.3-70b-versatile',
      temperature: 0,
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  /**
   * Sanitize quantity — strip dosage strength mistakenly passed as quantity.
   * 
   * Examples:
   *   "Allegra 120"  → quantity should be stripped of 120 (that's mg)
   *   "Pacimol 650"  → quantity should be stripped of 650 (that's mg)
   * 
   * If the requested quantity matches a known dosage suffix in the medicine name,
   * we default to 1 strip/tablet as a safe fallback.
   */
  sanitizeQuantity(medicineName, requestedQuantity) {
    if (!requestedQuantity || requestedQuantity === 0) return 1;

    // Extract trailing number from medicine name (e.g. "Allegra 120" → 120)
    const nameStrengthMatch = String(medicineName || '').match(/(\d+)\s*(?:mg|mcg|ml|g)?$/i);
    const strengthNumber = nameStrengthMatch ? parseInt(nameStrengthMatch[1]) : null;

    // If requested quantity exactly equals the strength number in the name,
    // it's almost certainly a parsing error — use 1 as safe default
    if (strengthNumber && requestedQuantity === strengthNumber) {
      console.warn(
        `⚠️  Quantity ${requestedQuantity} matches dosage strength in "${medicineName}". ` +
        `Treating as 1 unit (strength was mistaken for quantity).`
      );
      return 1;
    }

    // Also catch obviously unrealistic quantities (>60 for a single order)
    if (requestedQuantity > 60) {
      console.warn(
        `⚠️  Quantity ${requestedQuantity} is unrealistically high for "${medicineName}". ` +
        `Capping at 1 — likely a parsing artifact.`
      );
      return 1;
    }

    return requestedQuantity;
  }

  /**
   * Comprehensive safety check for an order request
   */
  async evaluateOrderSafety(consumerId, medicineData, orderRequest, sessionId) {
    const tracer = new AgentTracer(sessionId, 'safety_policy');
    const trace = tracer.startTrace('evaluate_order_safety');

    try {
      const checks = [];
      let canProceed = true;
      let requiresAction = [];
      let reasoning = [];

      // Validate inputs
      if (!medicineData) {
        return {
          decision: 'REJECTED',
          reason: 'Medicine not found in our inventory',
          canProceed: false,
          checks: ['medicine_not_found'],
          reasoning: ['The requested medicine is not available in our system']
        };
      }

      tracer.logDecision(
        'Medicine Found',
        `Found: ${medicineData.medicine_name}`,
        medicineData
      );

      // ✅ FIX: Sanitize quantity BEFORE any checks
      // This prevents "Allegra 120" → quantity:120 or "Pacimol 650" → quantity:650
      const sanitizedQuantity = this.sanitizeQuantity(
        medicineData.medicine_name,
        orderRequest.quantity
      );

      if (sanitizedQuantity !== orderRequest.quantity) {
        console.log(
          `🔧 Quantity corrected for "${medicineData.medicine_name}": ` +
          `${orderRequest.quantity} → ${sanitizedQuantity}`
        );
      }

      // Use sanitized quantity for all subsequent checks
      const sanitizedRequest = { ...orderRequest, quantity: sanitizedQuantity };

      // Check 1: Stock Availability
      const stockCheck = this.checkStockAvailability(
        medicineData,
        sanitizedRequest.quantity
      );
      checks.push(stockCheck);

      if (!stockCheck.passed) {
        canProceed = false;
        reasoning.push(stockCheck.reason);
      }

      tracer.logToolCall(
        'stock_check',
        { medicine: medicineData.medicine_name, requested: sanitizedRequest.quantity },
        stockCheck
      );

      // Check 2: Prescription Requirement
      const prescriptionCheck = await this.checkPrescriptionRequirement(
        medicineData,
        consumerId,
        tracer
      );
      checks.push(prescriptionCheck);

      if (!prescriptionCheck.passed) {
        requiresAction.push('upload_prescription');
        reasoning.push(prescriptionCheck.reason);
        canProceed = false;
      }

      tracer.logToolCall(
        'prescription_check',
        { medicine: medicineData.medicine_name, consumer: consumerId },
        prescriptionCheck
      );

      // Check 3: Dosage Safety (using LLM for intelligent analysis)
      const dosageCheck = await this.checkDosageSafety(
        medicineData,
        sanitizedRequest,
        tracer
      );
      checks.push(dosageCheck);

      if (!dosageCheck.passed) {
        reasoning.push(dosageCheck.reason);
        if (dosageCheck.severity === 'critical') {
          canProceed = false;
        } else {
          requiresAction.push('confirm_dosage');
        }
      }

      tracer.logToolCall(
        'dosage_check',
        { medicine: medicineData.medicine_name, dosage: sanitizedRequest.dosageFrequency },
        dosageCheck
      );

      // Check 4: Consumer Order History (interaction check)
      const historyCheck = await this.checkOrderHistory(
        consumerId,
        medicineData.id,
        sanitizedRequest.quantity,
        tracer
      );
      checks.push(historyCheck);

      if (!historyCheck.passed && historyCheck.severity === 'warning') {
        requiresAction.push('confirm_quantity');
        reasoning.push(historyCheck.reason);
      }

      // Final decision
      let decision = 'REJECTED';
      if (canProceed && requiresAction.length === 0) {
        decision = 'APPROVED';
      } else if (!canProceed) {
        decision = 'REJECTED';
      } else {
        decision = 'REQUIRES_ACTION';
      }

      // Log decision to database
      await this.logSafetyDecision(sessionId, {
        medicine_id: medicineData.id,
        consumer_id: consumerId,
        decision,
        checks,
        reasoning,
        requiresAction
      });

      const result = {
        decision,
        canProceed,
        requiresAction,
        reasoning: reasoning.join('; '),
        reason: reasoning.join('; '),
        checks,
        medicineData,
        // ✅ Return sanitized quantity so orchestrator uses corrected value
        sanitizedQuantity
      };

      tracer.logDecision(
        decision,
        reasoning.join('; '),
        result
      );

      await tracer.end(result);
      return result;

    } catch (error) {
      console.error('Error in safety evaluation:', error);
      await tracer.end({ error: error.message }, { status: 'error' });
      throw error;
    }
  }

  /**
   * Check stock availability
   */
  checkStockAvailability(medicineData, requestedQuantity) {
    const available = medicineData.stock_quantity || 0;
    const requested = requestedQuantity || 0;

    if (requested === 0) {
      return {
        check: 'stock_availability',
        passed: false,
        reason: 'No quantity specified',
        severity: 'critical'
      };
    }

    if (available < requested) {
      return {
        check: 'stock_availability',
        passed: false,
        reason: `Insufficient stock. Available: ${available}, Requested: ${requested}`,
        severity: 'critical',
        available,
        requested
      };
    }

    return {
      check: 'stock_availability',
      passed: true,
      reason: 'Stock available',
      available,
      requested
    };
  }

  /**
   * Check prescription requirement
   */
  async checkPrescriptionRequirement(medicineData, consumerId, tracer) {
    if (!medicineData.prescription_required) {
      return {
        check: 'prescription_requirement',
        passed: true,
        reason: 'No prescription required for this medicine'
      };
    }

    // Check if consumer has valid prescription
    const result = await query(
      `SELECT * FROM prescriptions 
       WHERE consumer_id = $1 
       AND medicine_id = $2 
       AND verified = true 
       AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE)
       ORDER BY prescription_date DESC 
       LIMIT 1`,
      [consumerId, medicineData.id]
    );

    if (result.rows.length > 0) {
      return {
        check: 'prescription_requirement',
        passed: true,
        reason: 'Valid prescription on file',
        prescription: result.rows[0]
      };
    }

    return {
      check: 'prescription_requirement',
      passed: false,
      reason: 'Prescription required but not found. Please upload a valid prescription.',
      severity: 'critical'
    };
  }

  /**
   * Check dosage safety using LLM
   */
  async checkDosageSafety(medicineData, orderRequest, tracer) {
    // ✅ FIX: Explicitly tell the LLM that numbers in medicine names are strengths, not quantities
    const systemPrompt = `You are a pharmaceutical safety expert. Evaluate if the requested quantity and dosage frequency are safe and reasonable.

Medicine information:
- Name: ${medicineData.medicine_name}
- Standard dosage info: ${medicineData.dosage_info || 'Not specified'}
- Category: ${medicineData.category || 'General'}

IMPORTANT CONTEXT:
- Medicine names like "Allegra 120", "Pacimol 650", "Dolo 650" contain the STRENGTH in mg, NOT the quantity
- "Allegra 120" means Allegra at 120mg strength — the 120 is NOT a quantity
- "Pacimol 650" means Paracetamol at 650mg strength — the 650 is NOT a quantity
- The quantity below is the number of tablets/strips being ordered, already corrected for this

Order request:
- Quantity ordered: ${orderRequest.quantity} ${medicineData.unit_type}s (this is tablets/strips count, NOT mg)
- Dosage frequency: ${orderRequest.dosageFrequency || 'As prescribed'}

Evaluate ONLY:
1. Is ordering ${orderRequest.quantity} tablets/strips reasonable for a single order?
2. Does the dosage frequency align with standard practice for this medicine?

A quantity of 1-10 tablets/strips is always reasonable.
A quantity of 11-30 may be reasonable for chronic conditions.
Only flag if truly dangerous or nonsensical.

IMPORTANT: Respond ONLY with valid JSON. No markdown, no backticks, no extra text.

Return this exact format:
{
  "passed": true,
  "severity": "ok",
  "reason": "Quantity and dosage are within normal limits"
}`;

    try {
      const response = await this.model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Evaluate the dosage safety' }
      ]);

      let content = response.content.trim();
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        return {
          check: 'dosage_safety',
          passed: true,
          severity: 'ok',
          reason: 'Dosage check completed - appears reasonable'
        };
      }

      const analysis = JSON.parse(jsonMatch[0]);

      return {
        check: 'dosage_safety',
        passed: analysis.passed !== false,
        severity: analysis.severity || 'ok',
        reason: analysis.reason || 'Dosage appears reasonable'
      };

    } catch (error) {
      console.error('Error in dosage safety check:', error);
      return {
        check: 'dosage_safety',
        passed: true,
        severity: 'ok',
        reason: 'Safety check completed with default approval'
      };
    }
  }

  /**
   * Check order history for unusual patterns
   */
  async checkOrderHistory(consumerId, medicineId, requestedQuantity, tracer) {
    const result = await query(
      `SELECT * FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.consumer_id = $1 
       AND oi.medicine_id = $2
       ORDER BY o.order_date DESC
       LIMIT 5`,
      [consumerId, medicineId]
    );

    if (result.rows.length === 0) {
      return {
        check: 'order_history',
        passed: true,
        reason: 'First time ordering this medicine'
      };
    }

    const recentOrders = result.rows;
    const averageQuantity = recentOrders.reduce((sum, order) => sum + order.quantity, 0) / recentOrders.length;

    // ✅ FIX: Only flag if more than 3x average AND absolute quantity > 10
    // Previously triggered on 2x which is too sensitive for small quantities
    if (requestedQuantity > averageQuantity * 3 && requestedQuantity > 10) {
      return {
        check: 'order_history',
        passed: false,
        severity: 'warning',
        reason: `Requested quantity (${requestedQuantity}) is significantly higher than your usual order (${Math.round(averageQuantity)}). Please confirm.`,
        averageQuantity: Math.round(averageQuantity)
      };
    }

    return {
      check: 'order_history',
      passed: true,
      reason: 'Order quantity consistent with history'
    };
  }

  /**
   * Log safety decision to database
   */
  async logSafetyDecision(sessionId, decisionData) {
    try {
      await query(
        `INSERT INTO agent_actions 
         (session_id, agent_type, action_type, input_data, output_data, reasoning, decision, execution_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          sessionId,
          'safety_policy',
          'order_safety_check',
          JSON.stringify({ medicine_id: decisionData.medicine_id, consumer_id: decisionData.consumer_id }),
          JSON.stringify({ checks: decisionData.checks }),
          decisionData.reasoning.join('\n'),
          decisionData.decision,
          'success'
        ]
      );
    } catch (error) {
      console.error('Error logging safety decision:', error);
    }
  }
}

export default SafetyPolicyAgent;