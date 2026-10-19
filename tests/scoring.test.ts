import { describe, expect, it } from 'vitest';
import { countAnsweredQuestions } from '@/lib/scoring';
import { Attempt } from '@/lib/types';

describe('Scoring helpers', () => {
  it('counts submitted answers but excludes unanswered exam questions', () => {
    const attempts: Attempt[] = [
      { qid: 'q1', chosen: ['a'], correct: true, ms: 1200, ts: 1, mode: 'practice', ratingBefore: 1200, ratingAfter: 1200 },
      { qid: 'q2', chosen: [], correct: false, ms: 1000, ts: 2, mode: 'exam', ratingBefore: 1200, ratingAfter: 1200 },
      { qid: 'q3', chosen: ['b', 'c'], correct: false, ms: 1000, ts: 3, mode: 'exam', ratingBefore: 1200, ratingAfter: 1200 },
    ];

    expect(countAnsweredQuestions(attempts)).toBe(2);
  });
});
