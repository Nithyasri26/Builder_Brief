import type { AIContext, AIProvider, IntentResult } from '@/types/ai';
import { parseIntentJson } from '../schemas';
import { INTENT_SYSTEM_PROMPT, RESPONSE_SYSTEM_PROMPT, buildContextBlock } from '../prompts';

const TIMEOUT_MS = 15000;

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

export interface OpenAICompatibleOptions {
  id: string;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Local runtimes usually need no key. */
  requiresKey: boolean;
}

/**
 * Shared implementation for every OpenAI-compatible endpoint.
 *
 * The hosted OpenAI API, Ollama, vLLM, llama.cpp and most self-hosted Qwen /
 * Gemma / Llama servers speak the same /chat/completions shape, so one class
 * covers "swap in a smaller or self-hosted model" without touching business
 * logic anywhere else.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly id: string;
  readonly label: string;

  constructor(private readonly options: OpenAICompatibleOptions) {
    this.id = options.id;
    this.label = options.label;
  }

  isConfigured(): boolean {
    if (!this.options.baseUrl || !this.options.model) return false;
    return this.options.requiresKey ? Boolean(this.options.apiKey) : true;
  }

  private async call(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean,
    maxTokens: number,
  ): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.options.model,
          temperature: jsonMode ? 0.1 : 0.4,
          max_tokens: maxTokens,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`${this.label} request failed: ${res.status}`);
      const data = (await res.json()) as ChatCompletion;
      return data.choices?.[0]?.message?.content ?? '';
    } finally {
      clearTimeout(timer);
    }
  }

  async understandIntent(input: string, context: AIContext): Promise<IntentResult> {
    const raw = await this.call(
      INTENT_SYSTEM_PROMPT,
      `${buildContextBlock(context)}\n\nCitizen message: "${input}"\n\nJSON:`,
      true,
      400,
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
        300,
      )
    ).trim();
  }
}
