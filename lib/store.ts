import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PendingAnswer, PracticeSessionState, ProgressState } from '@/lib/types';

const initialState: ProgressState = {
  attempts: [],
  bookmarks: {},
  pendingAnswer: null,
  sessions: {},
};

function isValidPendingAnswer(value: unknown): value is PendingAnswer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.qid !== 'string' || !candidate.qid) return false;
  if (!Array.isArray(candidate.chosen)) return false;
  if (typeof candidate.correct !== 'boolean') return false;
  if (candidate.phase !== 'awaiting-teach-back' && candidate.phase !== 'awaiting-confidence') return false;
  return true;
}

export function isValidPracticeSession(value: unknown): value is PracticeSessionState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (!['practice', 'remediation', 'pair-drill'].includes(candidate.mode as string)) return false;
  if (!Array.isArray(candidate.questions) || candidate.questions.length === 0) return false;
  if (!Array.isArray(candidate.adaptivePool) || !Array.isArray(candidate.selectedAnswer)) return false;
  if (!Number.isInteger(candidate.currentIndex) || (candidate.currentIndex as number) < 0 || (candidate.currentIndex as number) >= candidate.questions.length) return false;
  if (!Number.isInteger(candidate.sessionTarget) || (candidate.sessionTarget as number) < candidate.questions.length) return false;
  if (!Array.isArray(candidate.selectedDomains) || typeof candidate.adaptiveEnabled !== 'boolean') return false;
  if (typeof candidate.submitted !== 'boolean' || typeof candidate.feedbackOpen !== 'boolean') return false;
  return true;
}

export function migrateProgressState(persistedState: unknown, version: number): ProgressState {
  const oldState = persistedState as Partial<ProgressState> | undefined;
  const migratedAttempts = (oldState?.attempts ?? []).map((attempt) => ({
    ...attempt,
    ratingBefore: attempt.ratingBefore ?? 1200,
    ratingAfter: attempt.ratingAfter ?? 1200,
    teachBack: attempt.teachBack ?? undefined,
    pairId: attempt.pairId ?? undefined,
  }));

  if (version < 3) {
    return {
      attempts: migratedAttempts,
      bookmarks: oldState?.bookmarks ?? {},
      pendingAnswer: null,
      sessions: oldState?.sessions ?? {},
    };
  }

  return {
    attempts: migratedAttempts,
    bookmarks: oldState?.bookmarks ?? {},
    pendingAnswer: isValidPendingAnswer(oldState?.pendingAnswer) ? oldState.pendingAnswer : null,
    sessions: oldState?.sessions ?? {},
  };
}

export const useProgressStore = create<ProgressState>()(
  persist(
    () => initialState,
    {
      name: 'az900-practice-progress-v1',
      version: 3,
      migrate: migrateProgressState,
    },
  ),
);

export function addAttempt(attempt: ProgressState['attempts'][number]) {
  const current = useProgressStore.getState();
  useProgressStore.setState({
    attempts: [...current.attempts, attempt],
  });
}

export function setPendingAnswer(pending: PendingAnswer | null | ((current: PendingAnswer | null) => PendingAnswer | null)) {
  const resolved = typeof pending === 'function' ? pending(useProgressStore.getState().pendingAnswer) : pending;
  useProgressStore.setState({ pendingAnswer: resolved });
}

export function toggleBookmark(qid: string) {
  const current = useProgressStore.getState();
  useProgressStore.setState({
    bookmarks: {
      ...current.bookmarks,
      [qid]: !Boolean(current.bookmarks[qid]),
    },
  });
}
