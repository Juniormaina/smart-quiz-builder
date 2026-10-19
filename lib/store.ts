import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProgressState } from '@/lib/types';

const initialState: ProgressState = {
  attempts: [],
  bookmarks: {},
  sessions: {},
};

export function migrateProgressState(persistedState: unknown, version: number): ProgressState {
  const oldState = persistedState as Partial<ProgressState> | undefined;
  if (version < 2) {
    return {
      attempts: (oldState?.attempts ?? []).map((attempt) => ({
        ...attempt,
        ratingBefore: attempt.ratingBefore ?? 1200,
        ratingAfter: attempt.ratingAfter ?? 1200,
        teachBack: attempt.teachBack ?? undefined,
        pairId: attempt.pairId ?? undefined,
      })),
      bookmarks: oldState?.bookmarks ?? {},
      sessions: oldState?.sessions ?? {},
    };
  }
  return {
    attempts: oldState?.attempts ?? [],
    bookmarks: oldState?.bookmarks ?? {},
    sessions: oldState?.sessions ?? {},
  };
}

export const useProgressStore = create<ProgressState>()(
  persist(
    () => initialState,
    {
      name: 'az900-practice-progress-v1',
      version: 2,
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

export function toggleBookmark(qid: string) {
  const current = useProgressStore.getState();
  useProgressStore.setState({
    bookmarks: {
      ...current.bookmarks,
      [qid]: !Boolean(current.bookmarks[qid]),
    },
  });
}
