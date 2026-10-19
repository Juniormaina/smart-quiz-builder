import { z } from 'zod';

export const teachBackResultSchema = z.object({
  text: z.string().max(240),
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  feedback: z.string(),
  source: z.enum(['ai', 'fallback']),
  covered: z.array(z.string()).optional(),
  missing: z.array(z.string()).optional(),
});

export const confusionPairSchema = z.object({
  id: z.string(),
  a: z.object({ name: z.string(), oneLiner: z.string() }),
  b: z.object({ name: z.string(), oneLiner: z.string() }),
  comparison: z.array(z.object({
    dimension: z.string(),
    a: z.string(),
    b: z.string(),
  })).min(4).max(6),
  ruleOfThumb: z.string(),
  drillQuestionIds: z.array(z.string()).length(5),
});

export const pairDrillResultSchema = z.object({
  correct: z.number().int().min(0),
  total: z.number().int().positive(),
  completedAt: z.number().nonnegative(),
  beforeAccuracy: z.number().min(0).max(100),
  afterAccuracy: z.number().min(0).max(100),
});

export const ratingSchema = z.number().min(600).max(1800);

export const attemptSchema = z.object({
  qid: z.string(),
  chosen: z.array(z.string()),
  correct: z.boolean(),
  ms: z.number().nonnegative(),
  ts: z.number().nonnegative(),
  mode: z.enum(['practice', 'exam', 'remediation']),
  ratingBefore: ratingSchema,
  ratingAfter: ratingSchema,
  pairId: z.string().optional(),
  teachBack: teachBackResultSchema.optional(),
});

export const optionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const explanationSchema = z.object({
  summary: z.string(),
  whyCorrect: z.string(),
  whyWrong: z.record(z.string(), z.string()),
  memoryHook: z.string(),
  docsTopic: z.string(),
  keyConcepts: z.array(z.string()).min(2).max(4),
  keyConceptSynonyms: z.record(z.string(), z.array(z.string())).optional(),
});

export const questionSchema = z.object({
  id: z.string(),
  domain: z.enum(['cloud-concepts', 'architecture-services', 'management-governance']),
  subtopic: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  type: z.enum(['single', 'multi', 'yes-no-statements']),
  stem: z.string(),
  options: z.array(optionSchema).min(2),
  correct: z.array(z.string()).min(1),
  explanation: explanationSchema,
  tags: z.array(z.string()).default([]),
  pairId: z.string().optional(),
});

export const explainResponseSchema = z.object({
  mode: z.enum(['ELI5', 'Analogy', 'Deep Dive', 'Exam Tip']),
  headline: z.string(),
  explanation: z.string(),
  analogy: z.string().optional(),
  commonMistake: z.string(),
  checkYourself: z.object({
    question: z.string(),
    answer: z.string(),
  }),
});

export const explainRequestSchema = z.object({
  mode: z.enum(['ELI5', 'Analogy', 'Deep Dive', 'Exam Tip']),
  question: questionSchema,
  chosenAnswer: z.array(z.string()).optional(),
  followUp: z.string().max(300).optional(),
});

export const gradeExplanationRequestSchema = z.object({
  question: questionSchema,
  text: z.string().max(240),
});

export const gradeExplanationResponseSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  covered: z.array(z.string()),
  missing: z.array(z.string()),
  feedback: z.string(),
});
