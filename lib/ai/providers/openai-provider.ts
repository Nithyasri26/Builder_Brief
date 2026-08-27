import { OpenAICompatibleProvider } from './openai-compatible';
import { aiConfig } from '@/lib/config';

/**
 * Hosted OpenAI models. Selected with AI_PROVIDER=openai.
 * Nothing else in the application changes.
 */
export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor() {
    const config = aiConfig().openai;
    super({
      id: 'openai',
      label: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: config.apiKey,
      model: config.model,
      requiresKey: true,
    });
  }
}
