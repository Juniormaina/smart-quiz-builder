import { Attempt, Domain, Question, TeachBackScore } from '@/lib/types';
import { DIFFICULTY_ELO, LEARNING_CONFIG } from '@/lib/config';

export function itemRating(question: Question) {
  return DIFFICULTY_ELO[question.difficulty];
}

export function ratingLevel(rating: number) {
  const { foundationMax, developingMax, proficientMax } = LEARNING_CONFIG.ratingLevelThresholds;
  if (rating < foundationMax) return 'Foundation';
  if (rating < developingMax) return 'Developing';
  if (rating < proficientMax) return 'Proficient';
  return 'Advanced';
}

export function formatRating(rating: number) {
  return Math.round(rating).toString();
}

export function expectedCorrectness(itemElo: number, userRating: number) {
  return 1 / (1 + 10 ** ((itemElo - userRating) / 400));
}

export function scoreResponse(question: Question, chosen: string[], teachBackScore?: TeachBackScore) {
  if (question.type === 'single') {
    const correct = chosen.length === question.correct.length
      && chosen.every((id) => question.correct.includes(id));
    return correct ? (teachBackScore === 0 ? 0.6 : 1) : 0;
  }
  const hits = chosen.filter((id) => question.correct.includes(id)).length;
  return Math.max(0, Math.min(1, hits / question.correct.length));
}

export function updateRating(
  rating: number,
  question: Question,
  score: number,
  priorDomainAttempts: number,
) {
  const expected = expectedCorrectness(itemRating(question), rating);
  const kFactor = priorDomainAttempts < LEARNING_CONFIG.calibrationAttempts
    ? LEARNING_CONFIG.calibrationKFactor
    : LEARNING_CONFIG.standardKFactor;
  const unclamped = rating + kFactor * (score - expected);
  const after = Math.max(LEARNING_CONFIG.minimumRating, Math.min(LEARNING_CONFIG.maximumRating, unclamped));
  return { before: rating, after, expected, score, kFactor, delta: after - rating };
}

export function latestRating(attempts: Attempt[]) {
  return attempts.filter((attempt) => attempt.mode !== 'exam').at(-1)?.ratingAfter ?? LEARNING_CONFIG.startingRating;
}

export function latestDomainRating(attempts: Attempt[], domain: Domain, questions: Question[]) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const domainAttempts = attempts.filter((attempt) => attempt.mode !== 'exam' && questionById.get(attempt.qid)?.domain === domain);
  return domainAttempts.reduce<number>((rating, attempt, index) => {
    const question = questionById.get(attempt.qid);
    if (!question) return rating;
    return updateRating(rating, question, scoreResponse(question, attempt.chosen, attempt.teachBack?.score), index).after;
  }, LEARNING_CONFIG.startingRating);
}

export function getDomainRatingHistory(attempts: Attempt[], questions: Question[]) {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const ratings: Record<Domain, number> = {
    'cloud-concepts': LEARNING_CONFIG.startingRating,
    'architecture-services': LEARNING_CONFIG.startingRating,
    'management-governance': LEARNING_CONFIG.startingRating,
  };
  const domainCounts: Record<Domain, number> = {
    'cloud-concepts': 0,
    'architecture-services': 0,
    'management-governance': 0,
  };
  return attempts.filter((attempt) => attempt.mode !== 'exam').map((attempt) => {
    const question = questionById.get(attempt.qid);
    if (question && attempt.mode !== 'exam') {
      const domain = question.domain;
      const score = scoreResponse(question, attempt.chosen, attempt.teachBack?.score);
      ratings[domain] = updateRating(ratings[domain], question, score, domainCounts[domain]).after;
      domainCounts[domain] += 1;
    }
    return {
      label: new Date(attempt.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      ...ratings,
    };
  });
}

export function selectAdaptiveQuestion(
  candidates: Question[],
  rating: number,
  attempts: Attempt[],
  sessionQuestionIds: string[] = [],
  random: () => number = Math.random,
  ratingForQuestion: (question: Question) => number = () => rating,
) {
  const excluded = new Set(sessionQuestionIds);
  const recentIds = new Set(attempts.slice(-LEARNING_CONFIG.recentQuestionWindow).map((attempt) => attempt.qid));
  const subtopicPerformance = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts) {
    const question = candidates.find((candidate) => candidate.id === attempt.qid);
    if (!question) continue;
    const current = subtopicPerformance.get(question.subtopic) ?? { correct: 0, total: 0 };
    current.total += 1;
    current.correct += Number(attempt.correct);
    subtopicPerformance.set(question.subtopic, current);
  }

  const scored = candidates.filter((question) => !excluded.has(question.id)).map((question) => {
    const probability = expectedCorrectness(itemRating(question), ratingForQuestion(question));
    const closeness = 1 - Math.abs(probability - LEARNING_CONFIG.targetCorrectness);
    const mastery = subtopicPerformance.get(question.subtopic);
    const weakness = mastery ? 1 - mastery.correct / mastery.total : 0;
    const score = closeness + weakness * LEARNING_CONFIG.weaknessBonus
      - (recentIds.has(question.id) ? LEARNING_CONFIG.recentQuestionPenalty : 0);
    return { question, score };
  }).sort((a, b) => b.score - a.score).slice(0, LEARNING_CONFIG.selectionTopCandidates);

  if (!scored.length) return null;
  const weights = scored.map(({ score }) => Math.max(0.01, score));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let selected = Math.min(0.999999, Math.max(0, random())) * totalWeight;
  for (let index = 0; index < scored.length; index += 1) {
    selected -= weights[index];
    if (selected < 0) return scored[index].question;
  }
  return scored[scored.length - 1].question;
}
