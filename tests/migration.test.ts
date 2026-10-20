import { describe, expect, it } from 'vitest';
import { migrateProgressState } from '@/lib/store';

describe('progress migration', () => {
  it('preserves v1 attempts and adds v2 tracking defaults', () => {
    const state = migrateProgressState({
      attempts: [{ qid: 'q1', chosen: ['a'], correct: true, ms: 500, ts: 10, mode: 'practice' }],
      bookmarks: { q1: true },
      sessions: { exam: null },
    }, 1);

    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0]).toMatchObject({ qid: 'q1', correct: true, ratingBefore: 1200, ratingAfter: 1200 });
    expect(state.bookmarks.q1).toBe(true);
    expect(state.sessions.exam).toBeNull();
    expect(state.pendingAnswer).toBeNull();
  });

  it('keeps attempts with and without confidence intact', () => {
    const state = migrateProgressState({
      attempts: [
        { qid: 'q1', chosen: ['a'], correct: true, ms: 500, ts: 10, mode: 'practice', ratingBefore: 1200, ratingAfter: 1210, confidence: 'unsure' },
        { qid: 'q2', chosen: ['b'], correct: false, ms: 500, ts: 20, mode: 'practice', ratingBefore: 1200, ratingAfter: 1200 },
      ],
      bookmarks: {},
      sessions: {},
    }, 2);

    expect(state.attempts[0].confidence).toBe('unsure');
    expect(state.attempts[1].confidence).toBeUndefined();
    expect(state.pendingAnswer).toBeNull();
  });

  it('preserves a pending answer from a v3 export', () => {
    const pending = {
      qid: 'q1',
      chosen: ['a'],
      correct: true,
      phase: 'awaiting-confidence',
    };

    const state = migrateProgressState({
      attempts: [],
      bookmarks: {},
      pendingAnswer: pending,
      sessions: {},
    }, 3);

    expect(state.pendingAnswer).toEqual(pending);
  });

  it('drops an invalid pending answer from a v3 export', () => {
    const state = migrateProgressState({
      attempts: [],
      bookmarks: {},
      pendingAnswer: { qid: 123, chosen: 'not-array', correct: 'yes', phase: 'bogus' },
      sessions: {},
    }, 3);

    expect(state.pendingAnswer).toBeNull();
  });
});