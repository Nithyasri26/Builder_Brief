import type {
  DocumentAvailability,
  EligibilityRule,
  MatchLevel,
  RuleOutcome,
  Scheme,
  SchemeMatch,
} from '@/types/scheme';
import type { CitizenSituation } from '@/types/user';
import type { CitizenDocument } from '@/types/document';

/**
 * Deterministic eligibility engine.
 *
 * The AI produces a structured CitizenSituation. This engine — plain
 * TypeScript, no model involved — decides what can be said about a scheme.
 * The result is always framed as POTENTIAL eligibility; the official
 * authority decides the real outcome.
 */

function valueOf(situation: CitizenSituation, field: keyof CitizenSituation): unknown {
  return situation[field];
}

function compare(rule: EligibilityRule, value: unknown): 'met' | 'unknown' | 'not_met' {
  if (rule.operator === 'exists') {
    return value === undefined || value === null ? 'unknown' : 'met';
  }
  if (value === undefined || value === null || value === '') return 'unknown';

  switch (rule.operator) {
    case 'equals':
      return String(value).toLowerCase() === String(rule.value).toLowerCase() ? 'met' : 'not_met';
    case 'not_equals':
      return String(value).toLowerCase() !== String(rule.value).toLowerCase() ? 'met' : 'not_met';
    case 'in': {
      const list = Array.isArray(rule.value) ? rule.value : [];
      return list.map((item) => String(item).toLowerCase()).includes(String(value).toLowerCase())
        ? 'met'
        : 'not_met';
    }
    case 'lte':
      return Number(value) <= Number(rule.value) ? 'met' : 'not_met';
    case 'gte':
      return Number(value) >= Number(rule.value) ? 'met' : 'not_met';
    case 'is_true':
      return value === true ? 'met' : 'not_met';
    default:
      return 'unknown';
  }
}

function levelFrom(outcomes: RuleOutcome[]): MatchLevel {
  if (outcomes.some((outcome) => outcome.result === 'not_met')) return 'not_matching';
  if (outcomes.some((outcome) => outcome.result === 'unknown')) return 'more_information_required';
  return 'potential_match';
}

/** Which of the scheme's documents the citizen already holds. */
export function documentAvailability(
  scheme: Scheme,
  documents: CitizenDocument[],
): DocumentAvailability[] {
  return scheme.requiredDocuments.map((requirement) => {
    const match = documents.find((doc) => doc.purposes.includes(requirement.purpose));
    return {
      key: requirement.key,
      label: requirement.label,
      why: requirement.why,
      available: Boolean(match),
      documentId: match?.id,
      documentName: match?.name,
    };
  });
}

export function checkPotentialEligibility(
  scheme: Scheme,
  situation: CitizenSituation,
  documents: CitizenDocument[] = [],
): SchemeMatch {
  // Official programmes carry no encoded rules on purpose: this prototype
  // must not decide, or appear to decide, official eligibility.
  if (scheme.eligibilityRules.length === 0) {
    return {
      schemeId: scheme.id,
      scheme,
      level: 'more_information_required',
      outcomes: [],
      missingInformation: ['The government decides who can get this one.'],
      documents: documentAvailability(scheme, documents),
      explanation: [
        'This is a government programme, shown for your reference.',
        'Check the rules on their website before you apply.',
      ],
    };
  }

  const outcomes: RuleOutcome[] = scheme.eligibilityRules.map((rule) => ({
    ruleId: rule.id,
    label: rule.label,
    explanation: rule.explanation,
    result: compare(rule, valueOf(situation, rule.field)),
  }));

  const level = levelFrom(outcomes);
  const missingInformation = outcomes
    .filter((outcome) => outcome.result === 'unknown')
    .map((outcome) => outcome.label);

  const explanation = outcomes
    .filter((outcome) => outcome.result === 'met')
    .map((outcome) => outcome.label);

  return {
    schemeId: scheme.id,
    scheme,
    level,
    outcomes,
    missingInformation,
    documents: documentAvailability(scheme, documents),
    explanation:
      explanation.length > 0
        ? explanation
        : ['Shown because it is offered in your state.'],
  };
}

const LEVEL_ORDER: Record<MatchLevel, number> = {
  potential_match: 0,
  more_information_required: 1,
  not_matching: 2,
};

export function rankMatches(matches: SchemeMatch[]): SchemeMatch[] {
  return [...matches].sort((a, b) => {
    const byLevel = LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level];
    if (byLevel !== 0) return byLevel;
    // Demo schemes surface above information-only cards within a level.
    if (a.scheme.isDemoScheme !== b.scheme.isDemoScheme) {
      return a.scheme.isDemoScheme ? -1 : 1;
    }
    return a.scheme.name.localeCompare(b.scheme.name);
  });
}

export const ELIGIBILITY_DISCLAIMER =
  'This is what it looks like from your details. The government office decides for certain.';
