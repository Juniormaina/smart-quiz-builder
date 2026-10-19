import { describe, expect, it } from 'vitest';
import { expectedCorrectness, selectAdaptiveQuestion, scoreResponse, updateRating } from '@/lib/adaptive';
import { questionBank } from '@/data/index';
import { LEARNING_CONFIG } from '@/lib/config';

describe('adaptive learning', () => {
  it('calculates the Elo expected score', () => {
    expect(expectedCorrectness(1200, 1200)).toBeCloseTo(0.5);
    expect(expectedCorrectness(1000, 1200)).toBeGreaterThan(0.5);
  });

  it('uses partial credit and fragile teach-back adjustment', () => {
    const single = questionBank.find((question) => question.type === 'single')!;
    expect(scoreResponse(single, single.correct, 0)).toBe(0.6);
    const multi = questionBank.find((question) => question.type === 'multi')!;
    expect(scoreResponse(multi, [multi.correct[0]])).toBeCloseTo(1 / multi.correct.length);
  });

  it('selects calibration K early and clamps ratings', () => {
    const question = questionBank[0];
    expect(updateRating(1200, question, 1, 0).kFactor).toBe(LEARNING_CONFIG.calibrationKFactor);
    expect(updateRating(1200, question, 1, 10).kFactor).toBe(LEARNING_CONFIG.standardKFactor);
    expect(updateRating(1799, question, 1, 10).after).toBeLessThanOrEqual(1800);
    expect(updateRating(601, question, 0, 10).after).toBeGreaterThanOrEqual(600);
  });

  it('adapts toward target difficulty and excludes questions already in the session', () => {
    const candidates = questionBank.filter((question) => question.domain === 'architecture-services');
    const selected = selectAdaptiveQuestion(candidates, 1200, [], [], () => 0);
    expect(selected).not.toBeNull();
    expect(Math.abs(expectedCorrectness(selected ? 1000 + (selected.difficulty - 1) * 200 : 1000, 1200) - 0.7)).toBeLessThan(0.3);
    expect(selectAdaptiveQuestion(candidates, 1200, [], candidates.map((question) => question.id))).toBeNull();
  });
});
