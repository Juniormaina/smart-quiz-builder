import { describe, expect, it } from 'vitest';
import {
  buildAttempt,
  canChangeSelection,
  captureSubmittedAnswer,
  getCorrectAnswerDisplay,
  isSelectionCorrect,
  resolvePendingAnswer,
  shouldRecordBeforeAdvance,
  withPhase,
  withTeachBack,
} from '@/lib/practice-flow';
import { questionBank } from '@/data/index';
import { shuffleOptions } from '@/lib/selection';
import { TeachBackResult } from '@/lib/types';

const question = questionBank.find((item) => item.type === 'single')!;

const context = {
  mode: 'practice' as const,
  ms: 1200,
  ts: 1_700_000_000_000,
  ratingBefore: 1200,
  ratingAfter: 1210,
  pairId: question.pairId,
};

const teachBack: TeachBackResult = {
  text: 'Because the service manages identity.',
  score: 1,
  feedback: 'Partly there.',
  source: 'fallback',
  covered: ['identity'],
  missing: ['billing'],
};

describe('practice answer lifecycle', () => {
  it('captures the submitted answer and its correctness once', () => {
    const pending = captureSubmittedAnswer(question, [question.correct[0]]);

    expect(pending.qid).toBe(question.id);
    expect(pending.chosen).toEqual([question.correct[0]]);
    expect(pending.correct).toBe(true);
    expect(isSelectionCorrect(question, question.correct)).toBe(true);
    expect(isSelectionCorrect(question, ['not-an-option'])).toBe(false);
  });

  it('records the answer that was submitted, not a later selection', () => {
    const pending = captureSubmittedAnswer(question, [question.correct[0]]);
    const attempt = buildAttempt(pending, context, 'confident');

    expect(attempt.qid).toBe(question.id);
    expect(attempt.chosen).toEqual([question.correct[0]]);
    expect(attempt.correct).toBe(true);
  });

  it('reports correct answer positions from the displayed shuffled options', () => {
    const shuffled = shuffleOptions(question, 4);
    const correctOption = shuffled.options.find((option) => shuffled.correct.includes(option.id));
    const correctPosition = shuffled.options.findIndex((option) => shuffled.correct.includes(option.id)) + 1;

    expect(correctOption).toBeDefined();
    expect(getCorrectAnswerDisplay(shuffled)).toBe(`${correctPosition}. ${correctOption?.text}`);
  });

  it('keeps the graded teach-back when a confidence value is chosen', () => {
    const pending = withTeachBack(
      withPhase(captureSubmittedAnswer(question, [question.correct[0]], 'awaiting-teach-back'), 'awaiting-confidence'),
      teachBack,
    );

    const attempt = buildAttempt(pending, context, 'unsure');

    expect(attempt.teachBack).toEqual(teachBack);
    expect(attempt.confidence).toBe('unsure');
  });

  it('keeps the graded teach-back when confidence is skipped', () => {
    const pending = withTeachBack(
      captureSubmittedAnswer(question, [question.correct[0]], 'awaiting-teach-back'),
      teachBack,
    );

    const attempt = buildAttempt(pending, context);

    expect(attempt.teachBack).toEqual(teachBack);
    expect(attempt.confidence).toBeUndefined();
  });

  it('never fabricates a confidence value when the learner skips', () => {
    const attempt = buildAttempt(captureSubmittedAnswer(question, [question.correct[0]]), context);

    expect(attempt.confidence).toBeUndefined();
    expect(JSON.parse(JSON.stringify(attempt))).not.toHaveProperty('confidence');
  });

  it('locks the selection while an answer is pending', () => {
    const pending = captureSubmittedAnswer(question, []);

    expect(canChangeSelection({ submitted: false, pending })).toBe(false);
    expect(canChangeSelection({ submitted: false, pending: withPhase(pending, 'awaiting-teach-back') })).toBe(false);
    expect(canChangeSelection({ submitted: false, pending: null })).toBe(true);
    expect(canChangeSelection({ submitted: true, pending: null })).toBe(false);
  });

  it('records a pending answer exactly once', () => {
    const pending = captureSubmittedAnswer(question, [question.correct[0]]);
    expect(shouldRecordBeforeAdvance(pending)).toBe(true);

    const first = resolvePendingAnswer(pending, context, 'confident');
    expect(first.attempt).not.toBeNull();
    expect(first.pending).toBeNull();

    // Advancing again after the answer was recorded must not record it twice.
    expect(shouldRecordBeforeAdvance(first.pending)).toBe(false);
    const second = resolvePendingAnswer(first.pending, context, 'confident');
    expect(second.attempt).toBeNull();
  });

  it('records an unanswered-for confidence answer without inventing confidence', () => {
    const pending = captureSubmittedAnswer(question, [question.correct[0]]);
    const resolution = resolvePendingAnswer(pending, context);

    expect(resolution.attempt).not.toBeNull();
    expect(resolution.attempt?.chosen).toEqual([question.correct[0]]);
    expect(resolution.attempt?.correct).toBe(true);
    expect(resolution.attempt?.confidence).toBeUndefined();
  });
});
