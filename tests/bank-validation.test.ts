import { describe, expect, it } from 'vitest';
import { questionBank } from '@/data/index';
import { confusionPairs } from '@/data/confusionPairs';
import { confusionPairSchema, questionSchema } from '@/lib/schemas';

describe('Question bank validation', () => {
  it('has a valid minimum bank size and all domains represented', () => {
    expect(questionBank.length).toBeGreaterThanOrEqual(60);
    expect(questionBank.filter((question) => question.domain === 'cloud-concepts').length).toBeGreaterThanOrEqual(15);
    expect(questionBank.filter((question) => question.domain === 'architecture-services').length).toBeGreaterThanOrEqual(25);
    expect(questionBank.filter((question) => question.domain === 'management-governance').length).toBeGreaterThanOrEqual(20);
  });

  it('has unique ids and valid option references', () => {
    const ids = questionBank.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const question of questionBank) {
      const optionIds = new Set(question.options.map((option) => option.id));
      expect(question.correct.every((id) => optionIds.has(id))).toBe(true);
      for (const option of question.options) {
        if (!question.correct.includes(option.id)) {
          expect(question.explanation.whyWrong[option.id]).toBeTruthy();
        }
      }
    }
  });

  it('validates confusion pair content and question references', () => {
    const questionIds = new Set(questionBank.map((question) => question.id));
    const pairIds = new Set(confusionPairs.map((pair) => pair.id));

    for (const pair of confusionPairs) {
      expect(confusionPairSchema.safeParse(pair).success).toBe(true);
      expect(pair.comparison.length).toBeGreaterThanOrEqual(4);
      expect(pair.comparison.length).toBeLessThanOrEqual(6);
      expect(pair.drillQuestionIds).toHaveLength(5);
      expect(pair.drillQuestionIds.every((id) => questionIds.has(id))).toBe(true);
    }
    for (const question of questionBank) {
      expect(questionSchema.safeParse(question).success).toBe(true);
      expect(question.explanation.keyConcepts?.length).toBeGreaterThanOrEqual(2);
      expect(question.explanation.keyConcepts?.length).toBeLessThanOrEqual(4);
      if (question.pairId) expect(pairIds.has(question.pairId)).toBe(true);
    }
  });
});
