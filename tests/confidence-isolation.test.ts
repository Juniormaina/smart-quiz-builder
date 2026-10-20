import { describe, expect, it } from 'vitest';
import { getExamResults } from '@/lib/scoring';
import { getDomainRatingHistory, latestDomainRating, latestRating, scoreResponse, selectAdaptiveQuestion, updateRating } from '@/lib/adaptive';
import { LEARNING_CONFIG } from '@/lib/config';
import { questionBank } from '@/data/index';
import { Attempt, Confidence, PendingAnswer } from '@/lib/types';
import {
  buildAttempt,
  captureSubmittedAnswer,
  resolvePendingAnswer,
} from '@/lib/practice-flow';

const context = {
  mode: 'practice' as const,
  ms: 1200,
  ts: 1_700_000_000_000,
  ratingBefore: 1200,
  ratingAfter: 1210,
};

function attemptWith(confidence?: Confidence, overrides: Partial<Attempt> = {}): Attempt {
  return {
    qid: 'cc-001',
    chosen: ['a'],
    correct: true,
    ms: 1200,
    ts: 1_700_000_000_000,
    mode: 'practice',
    ratingBefore: 1200,
    ratingAfter: 1210,
    ...(confidence ? { confidence } : {}),
    ...overrides,
  };
}

describe('confidence isolation from scoring and adaptation', () => {
  it('gives the same Elo update for the same answer with or without confidence', () => {
    const question = questionBank[0];
    const confident = attemptWith('confident');
    const plain = attemptWith(undefined);

    expect(scoreResponse(question, confident.chosen, confident.teachBack?.score))
      .toBe(scoreResponse(question, plain.chosen, plain.teachBack?.score));

    const confidentRating = updateRating(1200, question, scoreResponse(question, confident.chosen), 3);
    const plainRating = updateRating(1200, question, scoreResponse(question, plain.chosen), 3);
    expect(confidentRating.after).toBe(plainRating.after);
  });

  it('does not change the rating derived from attempt history', () => {
    const confidentHistory = [attemptWith('confident')];
    const plainHistory = [attemptWith(undefined)];

    expect(latestRating(confidentHistory)).toBe(latestRating(plainHistory));
    expect(latestDomainRating(confidentHistory, questionBank[0].domain, questionBank))
      .toBe(latestDomainRating(plainHistory, questionBank[0].domain, questionBank));
    expect(getDomainRatingHistory(confidentHistory, questionBank))
      .toEqual(getDomainRatingHistory(plainHistory, questionBank));
  });

  it('does not change adaptive question selection', () => {
    const candidates = questionBank.filter((question) => question.domain === 'architecture-services');
    const pick = (history: Attempt[]) => selectAdaptiveQuestion(candidates, 1200, history, [], () => 0.5)?.id;

    expect(pick([attemptWith('confident')])).toBe(pick([attemptWith(undefined)]));
  });

  it('keeps exam scoring and exam attempts independent of confidence', () => {
    const questions = questionBank.slice(0, 3);
    const answers = Object.fromEntries(questions.map((question) => [question.id, question.correct]));
    const examAttempt = attemptWith(undefined, { mode: 'exam', ratingBefore: 1200, ratingAfter: 1200 });

    expect(examAttempt.confidence).toBeUndefined();
    expect(getExamResults(questions, answers).score).toBe(1000);
    expect(latestRating([examAttempt, { ...examAttempt, confidence: 'confident' }]))
      .toBe(LEARNING_CONFIG.startingRating);
  });

  it('buildAttempt produces equivalent correctness and rating regardless of confidence', () => {
    const question = questionBank.find((item) => item.type === 'single')!;
    const pending = captureSubmittedAnswer(question, [question.correct[0]]);

    const confidentAttempt = buildAttempt(pending, context, 'confident');
    const unsureAttempt = buildAttempt(pending, context, 'unsure');
    const skippedAttempt = buildAttempt(pending, context);

    expect(confidentAttempt.correct).toBe(skippedAttempt.correct);
    expect(confidentAttempt.chosen).toEqual(skippedAttempt.chosen);
    expect(confidentAttempt.ratingBefore).toBe(skippedAttempt.ratingBefore);
    expect(confidentAttempt.ratingAfter).toBe(skippedAttempt.ratingAfter);
    expect(confidentAttempt.qid).toBe(skippedAttempt.qid);

    expect(unsureAttempt.correct).toBe(skippedAttempt.correct);
    expect(unsureAttempt.chosen).toEqual(skippedAttempt.chosen);
    expect(unsureAttempt.ratingBefore).toBe(skippedAttempt.ratingBefore);
    expect(unsureAttempt.ratingAfter).toBe(skippedAttempt.ratingAfter);

    // Only the confidence field should differ.
    expect({ ...skippedAttempt, confidence: 'confident' }).toEqual(confidentAttempt);
    expect({ ...skippedAttempt, confidence: 'unsure' }).toEqual(unsureAttempt);
  });

  it('resolvePendingAnswer records the same attempt body regardless of confidence', () => {
    const question = questionBank.find((item) => item.type === 'single')!;
    const pending = captureSubmittedAnswer(question, [question.correct[0]]);

    const confident = resolvePendingAnswer(pending, context, 'confident').attempt!;
    const unsure = resolvePendingAnswer(pending, context, 'unsure').attempt!;
    const skipped = resolvePendingAnswer(pending, context).attempt!;

    expect(confident).not.toBeNull();
    expect(unsure).not.toBeNull();
    expect(skipped).not.toBeNull();

    expect(confident.qid).toBe(skipped.qid);
    expect(confident.chosen).toEqual(skipped.chosen);
    expect(confident.correct).toBe(skipped.correct);
    expect(confident.ratingBefore).toBe(skipped.ratingBefore);
    expect(confident.ratingAfter).toBe(skipped.ratingAfter);
    expect(confident.mode).toBe(skipped.mode);

    expect(unsure.qid).toBe(skipped.qid);
    expect(unsure.chosen).toEqual(skipped.chosen);
    expect(unsure.correct).toBe(skipped.correct);
    expect(unsure.ratingBefore).toBe(skipped.ratingBefore);
    expect(unsure.ratingAfter).toBe(skipped.ratingAfter);

    expect(confident.confidence).toBe('confident');
    expect(unsure.confidence).toBe('unsure');
    expect(skipped.confidence).toBeUndefined();
  });

  it('teach-back scoring is preserved through the confidence step', () => {
    const question = questionBank.find((item) => item.type === 'single')!;
    const teachBack = {
      text: 'Because the service manages identity.',
      score: 1 as const,
      feedback: 'Partly there.',
      source: 'fallback' as const,
      covered: ['identity'],
      missing: ['billing'],
    };

    const pending: PendingAnswer = {
      ...captureSubmittedAnswer(question, [question.correct[0]], 'awaiting-teach-back'),
      teachBack,
    };

    const withConfidence = buildAttempt(pending, context, 'unsure');
    const withoutConfidence = buildAttempt(pending, context);

    expect(withConfidence.teachBack).toEqual(teachBack);
    expect(withoutConfidence.teachBack).toEqual(teachBack);
    expect(withConfidence.teachBack).toEqual(withoutConfidence.teachBack);
  });
});