import type { AIContext, AIProvider, IntentResult } from '@/types/ai';

/**
 * Used when no model is configured. The product still works: the rule layer
 * resolves intents and the deterministic response writer produces the wording.
 * This is what keeps the prototype runnable with zero API keys.
 */
export class NullProvider implements AIProvider {
  readonly id = 'none';
  readonly label = 'No model configured';

  isConfigured(): boolean {
    return false;
  }

  async understandIntent(_input: string, _context: AIContext): Promise<IntentResult> {
    return { intent: 'UNKNOWN', confidence: 0, entities: {}, source: 'fallback' };
  }

  async generateResponse(_input: string, _context: AIContext): Promise<string> {
    return '';
  }
}
