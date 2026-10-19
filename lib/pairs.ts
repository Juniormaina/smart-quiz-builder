import { Attempt, ConfusionPair, PairDrillResult } from '@/lib/types';
import { LEARNING_CONFIG } from '@/lib/config';

export type PairStatus = 'Not seen' | 'Triggered' | 'Recovering' | 'Resolved';

export function pairTriggerCount(attempts: Attempt[], pairId: string) {
  return attempts
    .filter((attempt) => attempt.pairId === pairId && attempt.mode !== 'exam' && attempt.chosen.length > 0)
    .slice(-LEARNING_CONFIG.confusionLookback)
    .filter((attempt) => !attempt.correct)
    .length;
}

export function getPairStatus(
  attempts: Attempt[],
  pairId: string,
  lastResult?: PairDrillResult,
): PairStatus {
  const laterAttempts = lastResult
    ? attempts.filter((attempt) => attempt.pairId === pairId && attempt.ts > lastResult.completedAt)
    : attempts;
  if (pairTriggerCount(laterAttempts, pairId) >= LEARNING_CONFIG.confusionIncorrectThreshold) return 'Triggered';
  if (lastResult) return lastResult.correct >= 4 ? 'Resolved' : lastResult.correct >= 3 ? 'Recovering' : 'Not seen';
  return 'Not seen';
}

export function findTriggeredPair(
  pairs: ConfusionPair[],
  attempts: Attempt[],
  results: Record<string, PairDrillResult>,
) {
  return pairs.find((pair) => getPairStatus(attempts, pair.id, results[pair.id]) === 'Triggered') ?? null;
}
