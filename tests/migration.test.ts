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
  });
});
