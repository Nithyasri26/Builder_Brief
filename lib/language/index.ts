/**
 * Language handling is kept separate from the workflow layer on purpose.
 *
 * The prototype ships English only. Everything the citizen sees is produced
 * as structured content (blocks, labels, steps), so adding a language later
 * means translating a surface, not rewriting a workflow.
 */

export type SupportedLanguage = 'en';

export const PLANNED_LANGUAGES = [
  { code: 'en', label: 'English', available: true },
  { code: 'kn', label: 'Kannada', available: false },
  { code: 'hi', label: 'Hindi', available: false },
  { code: 'ta', label: 'Tamil', available: false },
  { code: 'te', label: 'Telugu', available: false },
  { code: 'ml', label: 'Malayalam', available: false },
  { code: 'bn', label: 'Bengali', available: false },
  { code: 'mr', label: 'Marathi', available: false },
] as const;

export interface LanguageService {
  detectLanguage(text: string): Promise<SupportedLanguage>;
  translate(text: string, target: SupportedLanguage): Promise<string>;
  /** The language the citizen should be answered in. */
  resolvePreferred(requested?: string): SupportedLanguage;
}

/**
 * English-only implementation. A translating implementation would sit behind
 * this same interface and would not touch the workflow engine.
 */
export class EnglishLanguageService implements LanguageService {
  async detectLanguage(): Promise<SupportedLanguage> {
    return 'en';
  }

  async translate(text: string): Promise<string> {
    return text;
  }

  resolvePreferred(): SupportedLanguage {
    return 'en';
  }
}

let service: LanguageService | null = null;

export function getLanguageService(): LanguageService {
  if (!service) service = new EnglishLanguageService();
  return service;
}
