import { describe, expect, it } from 'vitest';
import { createDemoProgress } from '@/lib/demo';
import { getPairStatus, pairTriggerCount } from '@/lib/pairs';

describe('demo profile', () => {
  it('seeds a seven-day progression, two mistakes toward a pair trigger, and a resolved pair', () => {
    const now = Date.now();
    const state = createDemoProgress(now);
    expect(state.attempts).toHaveLength(60);
    expect(state.attempts[0].ts).toBeLessThan(state.attempts.at(-1)!.ts);
    expect(state.attempts.slice(-2).every((attempt) => attempt.pairId === 'policy-vs-rbac' && !attempt.correct)).toBe(true);
    expect(pairTriggerCount(state.attempts, 'policy-vs-rbac')).toBe(2);
    expect(getPairStatus(
      state.attempts,
      'locks-vs-policy',
      state.sessions.pairDrills?.['locks-vs-policy'],
    )).toBe('Resolved');
  });
});
