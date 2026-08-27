import { z } from 'zod';
import { INTENTS } from '@/types/ai';

/**
 * Model output is never trusted. Everything a provider returns is parsed
 * through these schemas before it reaches any workflow.
 */

export const intentEnum = z.enum(INTENTS);

// Unknown keys are stripped, not rejected: newer models often add extra fields,
// and one stray key must not throw away an otherwise-valid classification.
export const situationSchema = z.object({
  state: z.string().max(60).optional(),
  gender: z.enum(['female', 'male', 'other']).optional(),
  age: z.number().int().min(0).max(120).optional(),
  maritalStatus: z.enum(['single', 'married', 'widowed', 'divorced']).optional(),
  dependentChildren: z.number().int().min(0).max(20).optional(),
  youngestChildAge: z.number().int().min(0).max(40).optional(),
  employmentStatus: z.enum(['employed', 'self_employed', 'unemployed', 'retired']).optional(),
  annualHouseholdIncome: z.number().min(0).max(100000000).optional(),
  educationLevel: z.string().max(60).optional(),
  hasDisability: z.boolean().optional(),
});

export const entitiesSchema = z.object({
  service: z.string().max(40).optional(),
  amount: z.number().min(0).max(10000000).optional(),
  documentName: z.string().max(80).optional(),
  term: z.string().max(60).optional(),
  from: z.string().max(60).optional(),
  to: z.string().max(60).optional(),
  date: z.string().max(40).optional(),
  passengers: z.number().int().min(1).max(6).optional(),
  travelClass: z.string().max(40).optional(),
  complaintTopic: z.string().max(120).optional(),
  lastReceived: z.string().max(60).optional(),
  taskId: z.string().max(60).optional(),
  schemeId: z.string().max(60).optional(),
});

/** The exact shape a provider must return from understandIntent(). */
export const intentResponseSchema = z.object({
  intent: intentEnum,
  confidence: z.number().min(0).max(1),
  entities: entitiesSchema.default({}),
  situation: situationSchema.optional(),
  reply: z.string().max(600).optional(),
});

export type IntentResponse = z.infer<typeof intentResponseSchema>;

/** Pulls the first JSON object out of a model response and validates it. */
export function parseIntentJson(raw: string): IntentResponse | null {
  const cleaned = raw
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const result = intentResponseSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
