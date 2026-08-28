import type { AIContext, AIProvider, AIRoutingDecision, IntentResult } from '@/types/ai';
import { aiConfig } from '@/lib/config';
import { GeminiProvider } from './providers/gemini-provider';
import { OpenAIProvider } from './providers/openai-provider';
import { LocalModelProvider } from './providers/local-provider';
import { NullProvider } from './providers/null-provider';
import { FallbackProvider } from './providers/fallback-provider';
import { classifyByRules } from './rule-classifier';

let provider: AIProvider | null = null;

function buildProvider(name: string): AIProvider {
  switch (name) {
    case 'openai':
      return new OpenAIProvider();
    case 'local':
      return new LocalModelProvider();
    case 'gemini':
      return new GeminiProvider();
    default:
      return new NullProvider();
  }
}

/**
 * Resolves the provider chain once per process.
 *
 * The provider named by AI_PROVIDER goes first, and every OTHER configured
 * hosted provider is added behind it as an automatic fallback. So with
 * AI_PROVIDER=openai and a Gemini key also present, a failed OpenAI call (e.g.
 * a 429 quota error) transparently retries on Gemini before the app drops to
 * the deterministic rule engine. Set AI_PROVIDER=none to disable models.
 */
export function getAIProvider(): AIProvider {
  if (provider) return provider;
  const configured = aiConfig().provider;
  if (configured === 'none') {
    provider = new NullProvider();
    return provider;
  }

  // Primary first, then the remaining hosted providers as fallbacks, de-duped.
  const order = [configured, 'openai', 'gemini', 'local'].filter(
    (name, index, all) => all.indexOf(name) === index,
  );
  const chain = order.map(buildProvider).filter((candidate) => candidate.isConfigured());

  provider =
    chain.length === 0
      ? new NullProvider()
      : chain.length === 1
        ? chain[0]
        : new FallbackProvider(chain);
  return provider;
}

export interface ResolvedIntent {
  result: IntentResult;
  routing: AIRoutingDecision;
}

/**
 * Cost-optimised routing.
 *
 *   1. Rules      — a regex/entity pass that answers most real traffic for free.
 *   2. Model      — only for open-ended language the rules will not claim, or
 *                   for a life-situation message that deserves a human reply.
 *   3. Fallback   — no model configured and no rule matched: ask a clarifying
 *                   question instead of guessing.
 *
 * Whatever happens here, the workflow that runs afterwards is ordinary
 * TypeScript, so the citizen experience does not change with the model.
 */
export async function resolveIntent(input: string, context: AIContext): Promise<ResolvedIntent> {
  const ruleResult = classifyByRules(input);

  if (ruleResult && ruleResult.confidence >= 0.9) {
    return {
      result: ruleResult,
      routing: {
        layer: 'rules',
        reason: 'Matched a deterministic pattern — no model call was needed.',
        estimatedTokens: 0,
      },
    };
  }

  const ai = getAIProvider();
  if (ai.isConfigured()) {
    try {
      const modelResult = await ai.understandIntent(input, context);
      // The rule layer stays authoritative on intent when it had an opinion;
      // the model contributes entities, situation and wording.
      if (ruleResult) {
        return {
          result: {
            ...modelResult,
            intent: ruleResult.intent,
            confidence: Math.max(ruleResult.confidence, modelResult.confidence),
            entities: { ...modelResult.entities, ...ruleResult.entities },
            situation: { ...(modelResult.situation ?? {}), ...(ruleResult.situation ?? {}) },
            source: 'llm',
          },
          routing: {
            layer: 'llm',
            reason: 'Open-ended wording: the model supplied the phrasing and details.',
            estimatedTokens: 500,
          },
        };
      }
      if (modelResult.intent !== 'UNKNOWN') {
        return {
          result: modelResult,
          routing: {
            layer: 'llm',
            reason: 'No deterministic pattern matched, so the model classified the request.',
            estimatedTokens: 500,
          },
        };
      }
    } catch (error) {
      // Fall through to the deterministic fallback below, but surface the cause
      // so a broken key/model/quota is visible rather than silently degrading.
      console.error('[ai] model intent call failed:', (error as Error)?.message ?? error);
    }
  }

  if (ruleResult) {
    return {
      result: ruleResult,
      routing: {
        layer: 'rules',
        reason: 'Matched a deterministic pattern.',
        estimatedTokens: 0,
      },
    };
  }

  return {
    result: { intent: 'UNKNOWN', confidence: 0, entities: {}, source: 'fallback' },
    routing: {
      layer: 'deterministic',
      reason: 'Nothing matched. The assistant asks a clarifying question instead of guessing.',
      estimatedTokens: 0,
    },
  };
}

/**
 * Optional natural-language phrasing. Every caller must work without it —
 * the deterministic writer always supplies a usable sentence first.
 */
export async function embellish(
  input: string,
  context: AIContext,
  fallback: string,
): Promise<string> {
  const ai = getAIProvider();
  if (!ai.isConfigured()) return fallback;
  try {
    const text = await ai.generateResponse(input, context);
    return text.trim() ? text.trim() : fallback;
  } catch {
    return fallback;
  }
}

export { classifyByRules } from './rule-classifier';
