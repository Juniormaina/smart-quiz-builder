import { Attempt, Question } from '@/lib/types';

export function calculateAccuracy(attempts: Attempt[]) {
  if (!attempts.length) return 0;
  return (attempts.filter((attempt) => attempt.correct).length / attempts.length) * 100;
}

export function countAnsweredQuestions(attempts: Attempt[]) {
  return attempts.filter((attempt) => attempt.chosen.length > 0).length;
}

export function calculateStreak(attempts: Attempt[]) {
  let streak = 0;
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (attempts[index].correct) streak += 1;
    else break;
  }
  return streak;
}

export function getAccuracyTrend(attempts: Attempt[], nowOverride?: number) {
  const now = nowOverride ?? 0;
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now - (13 - index) * 86400000);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    return { key, label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) };
  });

  return days.map((day) => {
    const found = attempts.filter((attempt) => {
      const date = new Date(attempt.ts);
      const currentKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      return currentKey === day.key;
    });

    const accuracy = found.length ? (found.filter((attempt) => attempt.correct).length / found.length) * 100 : 0;
    return { ...day, accuracy: Number(accuracy.toFixed(0)) };
  });
}

export function getDomainBreakdown(questions: Question[], attempts: Attempt[]) {
  const domains = ['cloud-concepts', 'architecture-services', 'management-governance'] as const;
  return domains.map((domain) => {
    const relevant = questions.filter((question) => question.domain === domain);
    const answers = attempts.filter((attempt) => relevant.some((question) => question.id === attempt.qid));
    const correct = answers.filter((attempt) => attempt.correct).length;
    const accuracy = answers.length ? (correct / answers.length) * 100 : 0;
    return { domain, accuracy: Number(accuracy.toFixed(0)), total: answers.length };
  });
}

export function getWeakSubtopics(questions: Question[], attempts: Attempt[]) {
  const map = new Map<string, { score: number; attempts: number }>();

  for (const question of questions) {
    const related = attempts.filter((attempt) => attempt.qid === question.id);
    if (!related.length) continue;
    const score = related.filter((attempt) => attempt.correct).length / related.length;
    const current = map.get(question.subtopic) ?? { score: 0, attempts: 0 };
    current.score += score;
    current.attempts += 1;
    map.set(question.subtopic, current);
  }

  return Array.from(map.entries())
    .map(([subtopic, value]) => ({
      subtopic,
      score: Number(((value.score / value.attempts) * 100).toFixed(0)),
      attempts: value.attempts,
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
}

export function getExamResults(questions: Question[], answers: Record<string, string[]>) {
  const domains = ['cloud-concepts', 'architecture-services', 'management-governance'] as const;
  let correct = 0;
  const breakdown = domains.map((domain) => {
    const relevant = questions.filter((question) => question.domain === domain);
    const total = relevant.length;
    const scored = relevant.filter((question) => {
      const selection = answers[question.id] ?? [];
      const selected = [...selection].sort();
      const actual = [...question.correct].sort();
      const isCorrect = selected.length === actual.length && selected.every((value, index) => value === actual[index]);
      if (isCorrect) correct += 1;
      return isCorrect;
    }).length;
    const accuracy = total ? (scored / total) * 100 : 0;
    return { domain, accuracy: Number(accuracy.toFixed(0)), correct: scored, total };
  });

  const totalQuestions = questions.length;
  const score = totalQuestions ? (correct / totalQuestions) * 1000 : 0;
        return {
    totalQuestions,
    correct,
    score: Number(score.toFixed(0)),
    passMark: 700,
    accuracy: totalQuestions ? (correct / totalQuestions) * 100 : 0,
    breakdown,
  };
}
