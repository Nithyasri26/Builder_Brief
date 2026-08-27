import { OpenAICompatibleProvider } from './openai-compatible';
import { aiConfig } from '@/lib/config';

/**
 * Small or self-hosted models (Qwen, Gemma, Llama, Phi) served through any
 * OpenAI-compatible runtime such as Ollama, vLLM or llama.cpp.
 *
 * This is the cost end-state for the product: the deterministic layers below
 * handle most traffic, and a small local model handles the rest.
 */
export class LocalModelProvider extends OpenAICompatibleProvider {
  constructor() {
    const config = aiConfig().local;
    super({
      id: 'local',
      label: 'Local model',
      baseUrl: config.baseUrl,
      apiKey: '',
      model: config.model,
      requiresKey: false,
    });
  }
}
