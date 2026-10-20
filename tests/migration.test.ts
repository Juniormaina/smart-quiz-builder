import { describe, expect, it } from 'vitest';
import { isValidPracticeSession, migrateProgressState } from '@/lib/store';
import { questionBank } from '@/data/index';
import { PracticeSessionState } from '@/lib/types';

const practiceSession: PracticeSessionState = {
  mode: 'practice',
  questions: [questionBank[0]],
  adaptivePool: [questionBank[0], questionBank[1]],
  currentIndex: 0,
  selectedAnswer: [questionBank[0].options[0].id],
  sessionTarget: 30,
  adaptiveEnabled: true,
  selectedDomains: ['cloud-concepts', 'architecture-services', 'management-governance'],
  difficulty: null,
  count: 30,
  submitted: false,
  feedbackOpen: false,
  teachBackText: '',
  teachBackResult: null,
  learningSignal: null,
  activePairId: null,
  pairDrillStartedAt: null,
  pairBaselineAccuracy: 0,
  ratingDelta: null,
  subtopicChange: null,
};

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

  it('validates a persisted practice session and rejects invalid positions', () => {
    expect(isValidPracticeSession(practiceSession)).toBe(true);
    expect(isValidPracticeSession({ ...practiceSession, currentIndex: 1 })).toBe(false);
  });

  it('preserves practice sessions while migrating v3 progress', () => {
    const state = migrateProgressState({
      attempts: [],
      bookmarks: {},
      pendingAnswer: null,
      sessions: { practice: practiceSession },
    }, 3);

    expect(state.sessions.practice).toEqual(practiceSession);
  });
});