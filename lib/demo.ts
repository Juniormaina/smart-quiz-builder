import { questionBank } from '@/data/index';
import { LEARNING_CONFIG } from '@/lib/config';
import { Confidence, ProgressState } from '@/lib/types';

const DAY = 24 * 60 * 60 * 1000;

export function createDemoProgress(now: number): ProgressState {
  const history = questionBank.filter((question) => !question.id.startsWith('pair-'));
  const attempts = Array.from({ length: 58 }, (_, index) => {
    const question = history[(index * 7 + 3) % history.length];
    const isTrackedPair = question.pairId === 'policy-vs-rbac' || question.pairId === 'locks-vs-policy';
    const isCorrect = isTrackedPair || index % 6 !== 1;
    const wrongOption = question.options.find((option) => !question.correct.includes(option.id));
    const chosen = isCorrect ? question.correct : [wrongOption?.id ?? question.options[0].id];
    const ratingBefore = 990 + index * 5;
    // Confidence is a learning signal, not a knowledge score. The demo
    // includes a mix of the four signals so the feedback drawer has examples
    // of fragile-correct and confident-incorrect answers to inspect.
    const confidence: Confidence = isCorrect
      ? (index % 7 === 0 ? 'unsure' : 'confident')
      : (index % 5 === 0 ? 'confident' : 'unsure');
    return {
      qid: question.id,
      chosen,
      correct: isCorrect,
      ms: 900 + (index % 5) * 170,
      ts: now - 7 * DAY + index * (7 * DAY / 60),
      mode: 'practice' as const,
      ratingBefore,
      ratingAfter: ratingBefore + (isCorrect ? 5 : -4),
      pairId: question.pairId,
      confidence,
    };
  });

  for (const [index, qid] of ['pair-policy-vs-rbac-01', 'pair-policy-vs-rbac-02'].entries()) {
    const question = questionBank.find((item) => item.id === qid);
    if (!question) continue;
    const incorrectChoice = question.options.find((option) => !question.correct.includes(option.id));
    attempts.push({
      qid,
      chosen: [incorrectChoice?.id ?? 'b'],
      correct: false,
      ms: 1400,
      ts: now - (2 - index) * 1000,
      mode: 'practice',
      ratingBefore: 1290 + index * 3,
      ratingAfter: 1278 + index * 3,
      pairId: 'policy-vs-rbac',
      confidence: 'confident',
    });
  }

  return {
    attempts,
    bookmarks: {},
    pendingAnswer: null,
    sessions: {
      pairDrills: {
        'locks-vs-policy': {
          correct: 4,
          total: 5,
          completedAt: now - DAY,
          beforeAccuracy: 40,
          afterAccuracy: 80,
        },
      },
      demo: { enabled: true, startingRating: LEARNING_CONFIG.startingRating },
    },
  };
}
