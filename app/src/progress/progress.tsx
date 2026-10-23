import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'majlis.progress.v1';

export interface BookProgress {
  done: number[];
  last: number | null;
}

export interface LastVisited {
  bookId: string;
  number: number;
}

interface ProgressState {
  books: Record<string, BookProgress>;
  lastVisited: LastVisited | null;
}

interface ProgressContextValue {
  ready: boolean;
  isDone: (bookId: string, num: number) => boolean;
  toggleDone: (bookId: string, num: number) => void;
  markDone: (bookId: string, num: number) => void;
  markVisited: (bookId: string, num: number) => void;
  bookProgress: (bookId: string) => BookProgress;
  lastVisited: LastVisited | null;
}

const EMPTY_BOOK: BookProgress = { done: [], last: null };

const ProgressContext = createContext<ProgressContextValue>({
  ready: false,
  isDone: () => false,
  toggleDone: () => {},
  markDone: () => {},
  markVisited: () => {},
  bookProgress: () => EMPTY_BOOK,
  lastVisited: null,
});

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProgressState>({ books: {}, lastVisited: null });
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          stateRef.current = parsed;
          setState(parsed);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((updater: (prev: ProgressState) => ProgressState) => {
    const next = updater(stateRef.current);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const isDone = useCallback(
    (bookId: string, num: number) => (state.books[bookId]?.done ?? []).includes(num),
    [state]
  );

  const toggleDone = useCallback(
    (bookId: string, num: number) => {
      persist((prev) => {
        const book = prev.books[bookId] ?? EMPTY_BOOK;
        const done = book.done.includes(num)
          ? book.done.filter((n) => n !== num)
          : [...book.done, num].sort((a, b) => a - b);
        return { ...prev, books: { ...prev.books, [bookId]: { ...book, done } } };
      });
    },
    [persist]
  );

  const markDone = useCallback(
    (bookId: string, num: number) => {
      persist((prev) => {
        const book = prev.books[bookId] ?? EMPTY_BOOK;
        if (book.done.includes(num)) return prev;
        const done = [...book.done, num].sort((a, b) => a - b);
        return { ...prev, books: { ...prev.books, [bookId]: { ...book, done } } };
      });
    },
    [persist]
  );

  const markVisited = useCallback(
    (bookId: string, num: number) => {
      persist((prev) => {
        const book = prev.books[bookId] ?? EMPTY_BOOK;
        if (
          book.last === num &&
          prev.lastVisited?.bookId === bookId &&
          prev.lastVisited.number === num
        ) {
          return prev;
        }
        return {
          ...prev,
          books: { ...prev.books, [bookId]: { ...book, last: num } },
          lastVisited: { bookId, number: num },
        };
      });
    },
    [persist]
  );

  const bookProgress = useCallback(
    (bookId: string) => state.books[bookId] ?? EMPTY_BOOK,
    [state]
  );

  const value = useMemo(
    () => ({
      ready,
      isDone,
      toggleDone,
      markDone,
      markVisited,
      bookProgress,
      lastVisited: state.lastVisited,
    }),
    [ready, isDone, toggleDone, markDone, markVisited, bookProgress, state.lastVisited]
  );

  return (
    <ProgressContext.Provider value={value}>
      {/* Children must not write progress before the stored state is loaded. */}
      {ready ? children : null}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  return useContext(ProgressContext);
}

/** First hadith number not yet marked done; falls back to last visited, then 1. */
export function nextHadithNumber(progress: BookProgress, total: number): number {
  for (let n = 1; n <= total; n++) {
    if (!progress.done.includes(n)) return n;
  }
  return progress.last ?? 1;
}
