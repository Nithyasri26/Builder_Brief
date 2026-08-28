import type { AIContext, AIProvider, IntentResult } from '@/types/ai';

/**
 * Tries several providers in order, moving to the next one when a call fails.
 *
 * This is what makes "if OpenAI is down or out of quota, use Gemini" work: the
 * primary provider is attempted first, and any thrown error (a 429 quota error,
 * a timeout, a 5xx) transparently falls through to the next configured provider.
 * A *successful* call is returned as-is — even an UNKNOWN result — so we only
 * switch providers on real failures, never to second-guess a valid answer.
 *
 * If every provider fails, the last error is re-thrown, which lets the caller
 * (resolveIntent / embellish) fall back to the deterministic rule engine.
 */
export class FallbackProvider implements AIProvider {
  readonly id = 'fallback';
  readonly label: string;

  constructor(private readonly providers: AIProvider[]) {
    this.label = providers.map((p) => p.label).join(' → ');
  }

  isConfigured(): boolean {
    return this.providers.some((p) => p.isConfigured());
  }

  async understandIntent(input: string, context: AIContext): Promise<IntentResult> {
    let lastError: unknown;
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      try {
        return await provider.understandIntent(input, context);
      } catch (error) {
        lastError = error;
        console.warn(
          `[ai] ${provider.label} intent call failed (${(error as Error)?.message ?? error}); trying next provider`,
        );
      }
    }
    throw lastError ?? new Error('No AI provider is configured.');
  }

  async generateResponse(input: string, context: AIContext): Promise<string> {
    let lastError: unknown;
    for (const provider of this.providers) {
      if (!provider.isConfigured()) continue;
      try {
        return await provider.generateResponse(input, context);
      } catch (error) {
        lastError = error;
        console.warn(
          `[ai] ${provider.label} response call failed (${(error as Error)?.message ?? error}); trying next provider`,
        );
      }
    }
    throw lastError ?? new Error('No AI provider is configured.');
  }
}
