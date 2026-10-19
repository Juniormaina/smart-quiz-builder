import { gradeExplanationResponseSchema } from '@/lib/schemas';
import { Question } from '@/lib/types';

function normalize(value: string) {
  return value.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function gradeExplanationFallback(question: Question, text: string) {
  const concepts = question.explanation.keyConcepts;
  const normalizedText = normalize(text);
  const covered = concepts.filter((concept) => {
    const synonyms = question.explanation.keyConceptSynonyms?.[concept] ?? [];
    return [concept, ...synonyms].some((term) => {
      const normalizedTerm = normalize(term);
      return normalizedTerm.length > 1 && ` ${normalizedText} `.includes(` ${normalizedTerm} `);
    });
  });
  const missing = concepts.filter((concept) => !covered.includes(concept));
  const score = covered.length === 0 ? 0 : covered.length >= Math.ceil(concepts.length * 0.7) ? 2 : 1;
  const feedback = score === 2
    ? 'You explained the key idea clearly.'
    : score === 1
      ? 'You have part of the idea; include the missing concept to make the explanation complete.'
      : 'Try again by naming the Azure concept and what it is responsible for.';
  return { score: score as 0 | 1 | 2, covered, missing, feedback, source: 'fallback' as const };
}

export function parseGradeResponse(value: unknown, question: Question) {
  const parsed = gradeExplanationResponseSchema.safeParse(value);
  if (!parsed.success) return null;
  const allowedConcepts = new Set(question.explanation.keyConcepts);
  if ([...parsed.data.covered, ...parsed.data.missing].some((concept) => !allowedConcepts.has(concept))) return null;
  if (parsed.data.covered.some((concept) => parsed.data.missing.includes(concept))) return null;
  return parsed.data;
}
