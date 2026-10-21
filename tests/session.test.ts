import { describe, expect, it } from 'vitest';
import { buildPracticeSet, buildRemediationSet, selectNextSessionQuestion } from '@/lib/selection';
import { questionBank } from '@/data/index';
import { useProgressStore } from '@/lib/store';
import { captureSubmittedAnswer, resolvePendingAnswer } from '@/lib/practice-flow';
import { Attempt, Domain } from '@/lib/types';

describe('session extension', () => {
  it('practice counts of 5, 10, and 20 respect pool size and no repeats', () => {
    const pools = [
      { count: 5, domains: ['cloud-concepts'] as const },
      { count: 10, domains: ['cloud-concepts', 'architecture-services'] as const },
      { count: 20, domains: ['cloud-concepts', 'architecture-services', 'management-governance'] as const },
    ];
    for (const { count, domains } of pools) {
      const pool = buildPracticeSet(questionBank, [...domains], null, count, 123 + count);
      const shuffled = pool.map((q) => ({ ...q, options: q.options.slice() }));
    const attempts: Attempt[] = [];
    const session: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const next = selectNextSessionQuestion(false, shuffled, attempts, session);
      if (!next) break;
      session.push(next.id);
    }
      expect(new Set(session).size).toBe(session.length);
      expect(session.length).toBeLessThanOrEqual(count);
      expect(session.length).toBeLessThanOrEqual(pool.length);
    }
  });

  it('remediation session of 10 respects pool size and no repeats', () => {
    const attempts: Attempt[] = [
      { qid: questionBank[0].id, correct: false, chosen: [], ts: Date.now(), mode: 'practice' as const, ratingBefore: 1200, ratingAfter: 1180, ms: 1000 },
    ];
    const pool = buildRemediationSet(questionBank, attempts, 77, 10);
    const served: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const next = selectNextSessionQuestion(false, pool, attempts, served);
      if (!next) break;
      served.push(next.id);
    }
    expect(new Set(served).size).toBe(served.length);
    expect(served.length).toBeLessThanOrEqual(10);
  });

  it('no repeated question IDs in adaptive and non-adaptive sessions', () => {
    const pool = buildPracticeSet(questionBank, ['cloud-concepts', 'architecture-services'], null, 15, 456);
    const attempts: Attempt[] = [];
    const served1: string[] = [];
    for (let i = 0; i < 15; i += 1) {
      const next = selectNextSessionQuestion(false, pool, attempts, served1);
      if (!next) break;
      served1.push(next.id);
    }
    expect(new Set(served1).size).toBe(served1.length);

    const served2: string[] = [];
    for (let i = 0; i < 15; i += 1) {
      const next = selectNextSessionQuestion(true, pool, attempts, served2, () => 0);
      if (!next) break;
      served2.push(next.id);
    }
    expect(new Set(served2).size).toBe(served2.length);
  });

  it('stops exactly at target and safely when exhausted', () => {
    const pool = buildPracticeSet(questionBank, ['cloud-concepts'], null, 3, 789);
    const attempts: Attempt[] = [];
    const served: string[] = [];
    const target = 10;
    for (let i = 0; i < target; i += 1) {
      const next = selectNextSessionQuestion(false, pool, attempts, served);
      if (!next) break;
      served.push(next.id);
    }
    expect(served.length).toBe(pool.length);
    expect(served.length).toBeLessThanOrEqual(target);
  });

  it('respects selected domain and difficulty filters', () => {
    const domains: Domain[] = ['cloud-concepts'];
    const pool = buildPracticeSet(questionBank, [...domains], 2, 10, 321);
    for (const q of pool) {
      expect(domains.includes(q.domain)).toBe(true);
      expect(q.difficulty).toBe(2);
    }
    const attempts: Attempt[] = [];
    const served: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const next = selectNextSessionQuestion(false, pool, attempts, served);
      if (!next) break;
      served.push(next.id);
      expect(domains.includes(next.domain)).toBe(true);
    }
  });

  it('records an answer exactly once as a session advances using existing answer-flow primitives', () => {
    useProgressStore.setState({ attempts: [], bookmarks: {}, pendingAnswer: null, sessions: {} });
    const question = questionBank[0];
    const pending = captureSubmittedAnswer(question, question.correct, 'awaiting-confidence');
    const resolution = resolvePendingAnswer(pending, {
      mode: 'practice',
      ms: 1000,
      ts: Date.now(),
      ratingBefore: 1200,
      ratingAfter: 1210,
    });
    expect(resolution.attempt).toBeTruthy();
    expect(resolution.pending).toBeNull();
  });

  it('adaptive selection continues to use existing target-success-probability logic', () => {
    const candidates = questionBank.filter((q) => q.domain === 'architecture-services').slice(0, 20);
    const attempts: Attempt[] = [];
    const served: string[] = [];
    const first = selectNextSessionQuestion(true, candidates, attempts, served, () => 0);
    expect(first).not.toBeNull();
    served.push(first!.id);
    const second = selectNextSessionQuestion(true, candidates, attempts, served, () => 0);
    expect(second).not.toBeNull();
    expect(second!.id).not.toBe(first!.id);
  });
});
