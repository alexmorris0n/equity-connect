// llm-slot-extractor.js
// LLM-powered slot extraction (upgrade from regex)
// Uses GPT-4o-mini with strict JSON schema for accurate slot parsing

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extract qualification slots from user text using LLM
 * More accurate than regex, handles variations naturally
 * 
 * @param {Object} params
 * @param {string} params.text - User's speech transcript
 * @param {Object} params.prior - Previously extracted slots (to merge)
 * @returns {Promise<Object>} Extracted slots
 */
export async function extractSlotsLLM({ text, prior = {} }) {
  const systemPrompt = `You extract six qualification slots about a homeowner's reverse mortgage situation.
Return ONLY JSON that conforms to the schema. Use null when unknown.

RULES:
1. age_62_plus and primary_residence must be strictly true/false/null
2. If mortgage_status = "paid_off", est_mortgage_balance MUST be null
3. Preserve exact user phrasing for amounts (e.g., "six hundred thousand" or "$600k")
4. If user mentions spouse, consider their age too for age_62_plus
5. Only update slots that are explicitly mentioned in the text
6. Keep prior values if text doesn't provide new information`;

  const userInput = {
    text,
    prior,
    schema: {
      purpose: "string|null (medical|home_repair|debt_consolidation|help_family|other)",
      age_62_plus: "true|false|null",
      primary_residence: "true|false|null",
      mortgage_status: "paid_off|has_balance|null",
      est_home_value: "string|null (verbatim from user, e.g., 'six hundred thousand' or '$600k')",
      est_mortgage_balance: "string|null (only if has_balance)"
    }
  };

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "slots_schema",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              purpose: {
                anyOf: [
                  { type: "string", enum: ["medical", "home_repair", "debt_consolidation", "help_family", "other"] },
                  { type: "null" }
                ]
              },
              age_62_plus: {
                anyOf: [
                  { type: "boolean" },
                  { type: "null" }
                ]
              },
              primary_residence: {
                anyOf: [
                  { type: "boolean" },
                  { type: "null" }
                ]
              },
              mortgage_status: {
                anyOf: [
                  { type: "string", enum: ["paid_off", "has_balance"] },
                  { type: "null" }
                ]
              },
              est_home_value: {
                anyOf: [
                  { type: "string" },
                  { type: "null" }
                ]
              },
              est_mortgage_balance: {
                anyOf: [
                  { type: "string" },
                  { type: "null" }
                ]
              }
            },
            required: [
              "purpose",
              "age_62_plus",
              "primary_residence",
              "mortgage_status",
              "est_home_value",
              "est_mortgage_balance"
            ]
          }
        }
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userInput) }
      ]
    });

    const jsonText = response.choices[0].message.content;
    return JSON.parse(jsonText);

  } catch (error) {
    console.error('LLM slot extraction error:', error);
    throw error;
  }
}

/**
 * Extract slots with retry and fallback
 * Tries LLM first, falls back to regex on failure
 * 
 * @param {Object} params - Same as extractSlotsLLM
 * @param {Function} regexFallback - Regex extraction function
 * @returns {Promise<Object>} Extracted slots
 */
export async function extractSlotsWithFallback({ text, prior }, regexFallback) {
  try {
    return await extractSlotsLLM({ text, prior });
  } catch (error) {
    console.warn('LLM extraction failed, using regex fallback:', error.message);
    return regexFallback(text);
  }
}

/**
 * Batch extract slots from multiple transcript chunks
 * Useful for processing conversation history
 * 
 * @param {string[]} transcripts - Array of transcript chunks
 * @returns {Promise<Object>} Merged slots
 */
export async function extractSlotsBatch(transcripts) {
  const combinedText = transcripts.join(' ');
  return extractSlotsLLM({ text: combinedText, prior: {} });
}

/**
 * Extract slots incrementally (for streaming ASR)
 * Merges new extractions with prior state
 * 
 * @param {string} newText - New transcript chunk
 * @param {Object} currentSlots - Current slot state
 * @returns {Promise<Object>} Updated slots
 */
export async function extractSlotsIncremental(newText, currentSlots) {
  const extracted = await extractSlotsLLM({ 
    text: newText, 
    prior: currentSlots 
  });

  // Merge: only update null slots with new non-null values
  const merged = { ...currentSlots };
  for (const key of Object.keys(extracted)) {
    if (merged[key] == null && extracted[key] != null) {
      merged[key] = extracted[key];
    }
  }

  return merged;
}

/**
 * Example: Realtime tool handler
 * Register this as a tool that the model can call
 */
export async function handleExtractSlotsTool(args) {
  return extractSlotsLLM({
    text: args.text,
    prior: args.prior || {}
  });
}

/**
 * Validate extracted slots
 * Ensures business rules are satisfied
 * 
 * @param {Object} slots - Extracted slots
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateSlots(slots) {
  const errors = [];

  // If paid off, balance must be null
  if (slots.mortgage_status === 'paid_off' && slots.est_mortgage_balance !== null) {
    errors.push('Mortgage balance should be null when paid off');
  }

  // If has balance, balance must be set
  if (slots.mortgage_status === 'has_balance' && !slots.est_mortgage_balance) {
    errors.push('Mortgage balance required when mortgage exists');
  }

  // Age must be boolean or null
  if (slots.age_62_plus !== null && typeof slots.age_62_plus !== 'boolean') {
    errors.push('age_62_plus must be true, false, or null');
  }

  // Primary residence must be boolean or null
  if (slots.primary_residence !== null && typeof slots.primary_residence !== 'boolean') {
    errors.push('primary_residence must be true, false, or null');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Example usage in bridge
 */
export async function exampleUsage() {
  // Simple extraction
  const slots1 = await extractSlotsLLM({
    text: "I'm 68 years old and need money for medical bills",
    prior: {}
  });
  console.log('Extracted:', slots1);
  // { purpose: 'medical', age_62_plus: true, ... }

  // Incremental extraction
  const slots2 = await extractSlotsIncremental(
    "Yes, I live there full time",
    slots1
  );
  console.log('Updated:', slots2);
  // { purpose: 'medical', age_62_plus: true, primary_residence: true, ... }

  // Validation
  const validation = validateSlots(slots2);
  console.log('Valid:', validation.valid);
}

