import type { AIContext, AIProvider, IntentResult } from '@/types/ai';
import { parseIntentJson } from '../schemas';
import { INTENT_SYSTEM_PROMPT, RESPONSE_SYSTEM_PROMPT, buildContextBlock } from '../prompts';
import { aiConfig } from '@/lib/config';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 12000;

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

/**
 * Gemini implementation of the AIProvider contract.
 * Uses the REST API directly so no vendor SDK is pulled into the bundle.
 */
export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly label = 'Google Gemini';

  private get config() {
    return aiConfig().gemini;
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey);
  }

  private async call(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean,
    maxOutputTokens: number,
  ): Promise<string> {
    const { apiKey, model } = this.config;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: jsonMode ? 0.1 : 0.4,
            maxOutputTokens,
            ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      });
      if (!res.ok) throw new Error(`Gemini request failed: ${res.status}`);
      const data = (await res.json()) as GeminiResponse;
      return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    } finally {
      clearTimeout(timer);
    }
  }

  async understandIntent(input: string, context: AIContext): Promise<IntentResult> {
    // gemini-3.6-flash is a thinking model: reasoning tokens are spent before
    // the JSON is written, so the budget must cover both or the output truncates
    // mid-thought (finishReason MAX_TOKENS) and no JSON is produced.
    const raw = await this.call(
      INTENT_SYSTEM_PROMPT,
      `${buildContextBlock(context)}\n\nCitizen message: "${input}"\n\nJSON:`,
      true,
      2048,
    );
    const parsed = parseIntentJson(raw);
    if (!parsed) {
      return { intent: 'UNKNOWN', confidence: 0, entities: {}, source: 'llm' };
    }
    return {
      intent: parsed.intent,
      confidence: parsed.confidence,
      entities: parsed.entities,
      situation: parsed.situation,
      reply: parsed.reply,
      source: 'llm',
    };
  }

  async generateResponse(input: string, context: AIContext): Promise<string> {
    return (
      await this.call(
        RESPONSE_SYSTEM_PROMPT,
        `${buildContextBlock(context)}\n\nCitizen message: "${input}"\n\nReply in at most 3 short sentences.`,
        false,
        1024,
      )
    ).trim();
  }
}
