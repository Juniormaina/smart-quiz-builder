export const LEARNING_CONFIG = {
  startingRating: 1200,
  minimumRating: 600,
  maximumRating: 1800,
  standardKFactor: 32,
  calibrationKFactor: 48,
  calibrationAttempts: 10,
  targetCorrectness: 0.7,
  selectionTopCandidates: 5,
  weaknessBonus: 0.25,
  recentQuestionWindow: 6,
  recentQuestionPenalty: 0.2,
  confusionLookback: 12,
  confusionIncorrectThreshold: 3,
  teachBackMaxLength: 240,
  gradeRequestsPerMinute: 20,
  ratingLevelThresholds: {
    foundationMax: 1000,
    developingMax: 1200,
    proficientMax: 1450,
  },
} as const;

export const DIFFICULTY_ELO: Record<1 | 2 | 3, number> = {
  1: 1000,
  2: 1200,
  3: 1400,
};
