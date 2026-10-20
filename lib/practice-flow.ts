import { Attempt, Confidence, Mode, PendingAnswer, PendingPhase, Question, TeachBackResult } from '@/lib/types';

export function isSelectionCorrect(question: Question, selection: string[]): boolean {
  const orderedSelected = [...selection].sort();
  const orderedCorrect = [...question.correct].sort();
  return orderedSelected.length === orderedCorrect.length && orderedSelected.every((value, index) => value === orderedCorrect[index]);
}

/**
 * Snapshot a submitted answer. Correctness is decided here, once, so that the
 * recorded attempt always matches what the learner actually submitted.
 */
export function captureSubmittedAnswer(
  question: Question,
  selectedAnswer: string[],
  phase: PendingPhase = 'awaiting-confidence',
): PendingAnswer {
  return {
    qid: question.id,
    chosen: [...selectedAnswer].sort(),
    correct: isSelectionCorrect(question, selectedAnswer),
    phase,
  };
}

export function withPhase(pending: PendingAnswer, phase: PendingPhase): PendingAnswer {
  return pending.phase === phase ? pending : { ...pending, phase };
}

/**
 * Attach a graded teach-back to a pending answer. The graded result is kept
 * on the pending answer so it survives the confidence step and still counts
 * towards the existing rating calculation.
 */
export function withTeachBack(pending: PendingAnswer, teachBack: TeachBackResult): PendingAnswer {
  return { ...pending, teachBack };
}

/**
 * True while the learner may still change their answer. A submitted answer is
 * frozen for the whole of the teach-back and confidence steps.
 */
export function canChangeSelection(options: { submitted: boolean; pending: PendingAnswer | null }): boolean {
  if (options.submitted) return false;
  const phase = options.pending?.phase;
  return phase !== 'awaiting-teach-back' && phase !== 'awaiting-confidence';
}

/**
 * True when an answer is still waiting to be recorded, which is the case
 * when the learner advances or finishes without choosing a confidence value.
 */
export function shouldRecordBeforeAdvance(pending: PendingAnswer | null): boolean {
  return pending !== null;
}

export type AttemptContext = {
  mode: Mode;
  ms: number;
  ts: number;
  ratingBefore: number;
  ratingAfter: number;
  pairId?: string;
};

/**
 * Build the attempt for a pending answer. `confidence` stays undefined when
 * the learner skipped the question, so a confidence value is never invented.
 */
export function buildAttempt(
  pending: PendingAnswer,
  context: AttemptContext,
  confidence?: Confidence,
): Attempt {
  return {
    qid: pending.qid,
    chosen: pending.chosen,
    correct: pending.correct,
    teachBack: pending.teachBack,
    confidence,
    mode: context.mode,
    ms: context.ms,
    ts: context.ts,
    ratingBefore: context.ratingBefore,
    ratingAfter: context.ratingAfter,
    pairId: context.pairId,
  };
}

/**
 * Turn a pending answer into the attempt that should be recorded.
 *
 * The resolved pending state is always null, so an answer can only be
 * recorded once: resolving again (for example when the learner advances
 * after already choosing a confidence value) produces no attempt.
 */
export function resolvePendingAnswer(
  pending: PendingAnswer | null,
  context: AttemptContext,
  confidence?: Confidence,
): { attempt: Attempt | null; pending: PendingAnswer | null } {
  if (!pending) return { attempt: null, pending: null };
  return { attempt: buildAttempt(pending, context, confidence), pending: null };
}
