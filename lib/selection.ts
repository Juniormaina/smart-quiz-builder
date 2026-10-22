import { Attempt, Domain, Question } from '@/lib/types';
import { selectAdaptiveQuestion, latestDomainRating, latestRating } from '@/lib/adaptive';

const DAY_MS = 1000 * 60 * 60 * 24;

export function shuffleSeeded<T>(items: T[], seed: number): T[] {
  const next = [...items];
  let value = seed >>> 0;
  for (let i = next.length - 1; i > 0; i -= 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const j = value % (i + 1);
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function shuffleOptions(question: Question, seed: number): Question {
  const options = shuffleSeeded(question.options, seed);
  return {
    ...question,
    options,
  };
}

export function buildPracticeSet(questions: Question[], domains: Domain[], difficulty: number | null, count: number, seed: number): Question[] {
  let filtered = questions.filter((question) => domains.includes(question.domain));
  if (difficulty !== null) {
    filtered = filtered.filter((question) => question.difficulty === difficulty);
  }
  return shuffleSeeded(filtered, seed).slice(0, Math.min(count, filtered.length));
}

export function masteryForAttempts(attempts: Attempt[], questions: Question[], nowOverride?: number) {
  const bySubtopic = new Map<string, { total: number; weighted: number; attempts: number }>();
  const now = nowOverride ?? 0;

  for (const attempt of attempts) {
    const q = questions.find((item) => item.id === attempt.qid);
    if (!q) continue;
    const key = q.subtopic;
    const deltaDays = Math.max((now - attempt.ts) / DAY_MS, 0.1);
    const weight = Math.exp(-deltaDays / 7);
    const existing = bySubtopic.get(key) ?? { total: 0, weighted: 0, attempts: 0 };
    existing.total += attempt.correct ? 1 : 0;
    existing.weighted += (attempt.correct ? 1 : 0) * weight;
    existing.attempts += 1;
    bySubtopic.set(key, existing);
  }

  return Array.from(bySubtopic.entries()).map(([subtopic, value]) => ({
    subtopic,
    accuracy: value.attempts > 0 ? value.weighted / value.attempts : 0,
    attempts: value.attempts,
    confident: value.attempts >= 3,
    score: value.total / value.attempts,
  }));
}

export function buildWeakSpotSet(questions: Question[], attempts: Attempt[], seed: number) {
  const weaknesses = masteryForAttempts(attempts, questions)
    .filter((entry) => entry.attempts > 0)
    .sort((a, b) => a.accuracy - b.accuracy || a.attempts - b.attempts);

  const weakSubset = weaknesses.slice(0, 3).flatMap((entry) =>
    questions.filter((question) => question.subtopic === entry.subtopic),
  );

  const missed = questions.filter((question) => {
    const itemAttempts = attempts.filter((attempt) => attempt.qid === question.id && !attempt.correct);
    return itemAttempts.length > 0;
  });

  const fresh = questions.filter((question) => !attempts.some((attempt) => attempt.qid === question.id));

  const selection = [...weakSubset, ...missed, ...fresh];
  return shuffleSeeded(selection, seed).slice(0, 10);
}

export function getLeitnerPriority(question: Question, attempts: Attempt[]) {
  const relevantAttempts = attempts
    .filter((attempt) => attempt.qid === question.id)
    .sort((a, b) => a.ts - b.ts);

  if (!relevantAttempts.length) return 3;

  let box = 1;
  for (const attempt of relevantAttempts) {
    if (!attempt.correct) {
      box = Math.min(4, box + 1);
    } else {
      box = Math.max(1, box - 1);
    }
  }
  return box;
}

export function buildRemediationSet(questions: Question[], attempts: Attempt[], seed: number, count = 10): Question[] {
  const weakByTopic = masteryForAttempts(attempts, questions)
    .filter((entry) => entry.attempts > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
    .map((entry) => entry.subtopic);

  const weakPool = weakByTopic.flatMap((subtopic) =>
    questions.filter((question) => question.subtopic === subtopic),
  );

  const missedPool = questions.filter((question) => attempts.some((attempt) => attempt.qid === question.id && !attempt.correct));
  const freshPool = questions.filter((question) => !attempts.some((attempt) => attempt.qid === question.id));

  const rankedWeak = shuffleSeeded(
    weakPool
      .map((question) => ({ question, priority: getLeitnerPriority(question, attempts) }))
      .sort((a, b) => b.priority - a.priority || a.question.difficulty - b.question.difficulty)
      .map(({ question }) => question),
    seed,
  );

  const rankedMissed = shuffleSeeded(
    missedPool
      .map((question) => ({ question, priority: getLeitnerPriority(question, attempts) }))
      .sort((a, b) => b.priority - a.priority || a.question.difficulty - b.question.difficulty)
      .map(({ question }) => question),
    seed + 11,
  );

  const rankedFresh = shuffleSeeded(
    freshPool
      .map((question) => ({ question, priority: getLeitnerPriority(question, attempts) }))
      .sort((a, b) => b.priority - a.priority || a.question.difficulty - b.question.difficulty)
      .map(({ question }) => question),
    seed + 37,
  );

  const weakTarget = Math.round(count * 0.6);
  const missedTarget = Math.round(count * 0.25);
  const freshTarget = count - weakTarget - missedTarget;

  const selected = new Map<string, Question>();
  for (const question of [...rankedWeak, ...rankedMissed, ...rankedFresh]) {
    if (selected.size >= count) break;
    if (selected.has(question.id)) continue;
    selected.set(question.id, question);
  }

  const finalSelection: Question[] = [];
  for (const pool of [rankedWeak, rankedMissed, rankedFresh]) {
    for (const question of pool) {
      if (finalSelection.length >= count) break;
      if (finalSelection.some((item) => item.id === question.id)) continue;
      if (
        (pool === rankedWeak && finalSelection.filter((item) => rankedWeak.includes(item)).length >= weakTarget) ||
        (pool === rankedMissed && finalSelection.filter((item) => rankedMissed.includes(item)).length >= missedTarget) ||
        (pool === rankedFresh && finalSelection.filter((item) => rankedFresh.includes(item)).length >= freshTarget)
      ) {
        continue;
      }
      finalSelection.push(question);
    }
  }

  if (finalSelection.length < count) {
    for (const question of questions) {
      if (!finalSelection.some((item) => item.id === question.id)) {
        finalSelection.push(question);
      }
      if (finalSelection.length >= count) break;
    }
  }

  return shuffleSeeded(finalSelection.slice(0, count), seed + 99);
}

export function buildExamSet(questions: Question[], seed: number, count = 50): Question[] {
  const domainWeights: Record<Domain, number> = {
    'cloud-concepts': 0.28,
    'architecture-services': 0.38,
    'management-governance': 0.34,
  };

  const targetByDomain = {
    'cloud-concepts': Math.round(count * domainWeights['cloud-concepts']),
    'architecture-services': Math.round(count * domainWeights['architecture-services']),
    'management-governance': count - Math.round(count * domainWeights['cloud-concepts']) - Math.round(count * domainWeights['architecture-services']),
  };

  const pool = DOMAINS.flatMap((domain) => {
    const items = questions.filter((question) => question.domain === domain);
    return shuffleSeeded(items, seed + domain.length).slice(0, targetByDomain[domain]);
  });

  return shuffleSeeded(pool, seed).slice(0, count);
}

export function selectNextSessionQuestion(
  adaptiveEnabled: boolean,
  adaptivePool: Question[],
  attempts: Attempt[],
  servedQuestionIds: string[],
  random: () => number = Math.random,
  ratingForQuestion?: (question: Question) => number,
): Question | null {
  if (adaptiveEnabled) {
    const rating = latestRating(attempts);
    return selectAdaptiveQuestion(
      adaptivePool,
      rating,
      attempts,
      servedQuestionIds,
      random,
      ratingForQuestion ?? ((question: Question) => latestDomainRating(attempts, question.domain, adaptivePool)),
    );
  }

  for (const question of adaptivePool) {
    if (!servedQuestionIds.includes(question.id)) {
      return question;
    }
  }
  return null;
}

const DOMAINS: Domain[] = ['cloud-concepts', 'architecture-services', 'management-governance'];
