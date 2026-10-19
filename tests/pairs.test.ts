import { describe, expect, it } from 'vitest';
import { getPairStatus, pairTriggerCount } from '@/lib/pairs';
import { Attempt } from '@/lib/types';

const attempt = (qid: string, correct: boolean, ts: number): Attempt => ({
  qid,
  chosen: correct ? ['a'] : ['b'],
  correct,
  ms: 1000,
  ts,
  mode: 'practice',
  ratingBefore: 1200,
  ratingAfter: 1200,
  pairId: 'policy-vs-rbac',
});

describe('confusion pair detection', () => {
  it('triggers after three incorrect answers within the recent window', () => {
    const attempts = [attempt('1', false, 1), attempt('2', true, 2), attempt('3', false, 3), attempt('4', false, 4)];
    expect(pairTriggerCount(attempts, 'policy-vs-rbac')).toBe(3);
    expect(getPairStatus(attempts, 'policy-vs-rbac')).toBe('Triggered');
  });

  it('allows a resolved pair to trigger again after new mistakes', () => {
    const result = { correct: 4, total: 5, completedAt: 5, beforeAccuracy: 0, afterAccuracy: 80 };
    const attempts = [attempt('1', false, 6), attempt('2', false, 7), attempt('3', false, 8)];
    expect(getPairStatus(attempts, 'policy-vs-rbac', result)).toBe('Triggered');
  });

  it('marks a completed drill recovering at three and resolved at four', () => {
    expect(getPairStatus([], 'policy-vs-rbac', { correct: 3, total: 5, completedAt: 10, beforeAccuracy: 20, afterAccuracy: 60 })).toBe('Recovering');
    expect(getPairStatus([], 'policy-vs-rbac', { correct: 4, total: 5, completedAt: 10, beforeAccuracy: 20, afterAccuracy: 80 })).toBe('Resolved');
  });
});
