import { z } from 'zod';

/** Input validation for every API route. Nothing reaches a service unvalidated. */

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().max(80).optional(),
});

export const chatActionSchema = z.object({
  action: z.string().min(1).max(60),
  conversationId: z.string().max(80),
  payload: z.record(z.unknown()).default({}),
});

export const documentUploadSchema = z.object({
  name: z.string().max(120).optional(),
  category: z
    .enum(['identity', 'education', 'employment', 'bank', 'family', 'government'])
    .default('government'),
  purposes: z
    .array(
      z.enum([
        'identity_proof',
        'address_proof',
        'dob_proof',
        'income_proof',
        'bank_proof',
        'child_birth_proof',
        'education_proof',
        'employment_proof',
        'aadhaar_document',
        'birth_certificate',
      ]),
    )
    .default([]),
});

export const eligibilityRequestSchema = z.object({
  situation: z
    .object({
      state: z.string().max(60).optional(),
      age: z.number().int().min(0).max(120).optional(),
      maritalStatus: z.enum(['single', 'married', 'widowed', 'divorced']).optional(),
      dependentChildren: z.number().int().min(0).max(20).optional(),
      youngestChildAge: z.number().int().min(0).max(40).optional(),
      employmentStatus: z.enum(['employed', 'self_employed', 'unemployed', 'retired']).optional(),
      annualHouseholdIncome: z.number().min(0).optional(),
      hasDisability: z.boolean().optional(),
    })
    .default({}),
});

export const schemeApplySchema = z.object({
  schemeId: z.string().min(1).max(80),
});

export const withdrawalSchema = z.object({
  amount: z.number().min(1).max(1000000),
});

export const complaintUpdateSchema = z.object({
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(4000),
});

export const digilockerImportSchema = z.object({
  documentId: z.string().min(1).max(80),
});

export const emailDocumentSchema = z.object({
  downloadId: z.string().min(1).max(80).optional(),
  documentId: z.string().min(1).max(80).optional(),
});
