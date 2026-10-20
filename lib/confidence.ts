import { Confidence, LearningSignal } from '@/lib/types';

/**
 * Exhaustive maps from a reported confidence value to a learning signal.
 *
 * Typing them as Record<Confidence, LearningSignal> keeps the classifier
 * honest: adding a confidence value to the Confidence union fails to compile
 * here until every combination has a deliberate signal, so a new value can
 * never silently produce an invalid classification.
 */
const CORRECT_SIGNALS: Record<Confidence, LearningSignal> = {
  confident: 'correct-confident',
  unsure: 'correct-unsure',
};

const INCORRECT_SIGNALS: Record<Confidence, LearningSignal> = {
  confident: 'incorrect-confident',
  unsure: 'incorrect-unsure',
};

/**
 * Classify a single answer into one of four learning signals.
 *
 * This is a deterministic, side-effect-free helper. It deliberately does NOT
 * measure mastery: it only reports the observed combination of correctness and
 * self-reported confidence. Callers must never treat a single signal as proof
 * of understanding or misunderstanding.
 *
 * Legacy attempts that predate confidence capture (confidence === undefined)
 * are reported as 'unknown' so existing progress renders without errors and
 * without inventing a confidence value.
 */
export function classifyLearningSignal(
  correct: boolean,
  confidence?: Confidence,
): LearningSignal | 'unknown' {
  if (confidence === undefined) return 'unknown';
  return correct ? CORRECT_SIGNALS[confidence] : INCORRECT_SIGNALS[confidence];
}

/**
 * Human-readable label for a learning signal, used by the feedback UI.
 */
export function signalLabel(signal: LearningSignal | 'unknown'): string {
  switch (signal) {
    case 'correct-confident':
      return 'Correct and confident';
    case 'correct-unsure':
      return 'Correct but unsure';
    case 'incorrect-confident':
      return 'Incorrect but confident';
    case 'incorrect-unsure':
      return 'Incorrect and unsure';
    default:
      return 'Confidence not captured';
  }
}

/**
 * Short guidance shown next to a learning signal. These are hints, not
 * diagnoses: they describe what the evidence supports and nothing more.
 */
export function signalGuidance(signal: LearningSignal | 'unknown'): string {
  switch (signal) {
    case 'correct-confident':
      return 'Evidence of understanding on this question.';
    case 'correct-unsure':
      return 'You got it right, but the answer may be fragile.';
    case 'incorrect-confident':
      return 'A possible misconception worth investigating.';
    case 'incorrect-unsure':
      return 'An area that needs explanation and practice.';
    default:
      return '';
  }
}