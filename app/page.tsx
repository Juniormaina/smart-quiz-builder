"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { questionBank } from "@/data/index";
import {
  buildExamSet,
  buildPracticeSet,
  buildRemediationSet,
  shuffleOptions,
} from "@/lib/selection";
import {
  calculateAccuracy,
  calculateStreak,
  countAnsweredQuestions,
  getAccuracyTrend,
  getDomainBreakdown,
  getExamResults,
  getWeakSubtopics,
} from "@/lib/scoring";
import {
  addAttempt,
  isValidPracticeSession,
  setPendingAnswer,
  toggleBookmark,
  useProgressStore,
} from "@/lib/store";
import {
  Domain,
  Confidence,
  ExplainResponse,
  LearningSignal,
  PairDrillResult,
  PracticeSessionState,
  Question,
  TeachBackResult,
} from "@/lib/types";
import {
  formatRating,
  getDomainRatingHistory,
  latestDomainRating,
  latestRating,
  ratingLevel,
  scoreResponse,
  selectAdaptiveQuestion,
  updateRating,
} from "@/lib/adaptive";
import { confusionPairs } from "@/data/confusionPairs";
import {
  findTriggeredPair,
  getPairStatus,
  pairTriggerCount,
} from "@/lib/pairs";
import { gradeExplanationFallback, parseGradeResponse } from "@/lib/teachback";
import {
  classifyLearningSignal,
  signalGuidance,
  signalLabel,
} from "@/lib/confidence";
import {
  captureSubmittedAnswer,
  canChangeSelection,
  getCorrectAnswerDisplay,
  isSelectionCorrect,
  resolvePendingAnswer,
  shouldRecordBeforeAdvance,
  withPhase,
  withTeachBack,
} from "@/lib/practice-flow";
import { parseProgress, serializeProgress } from "@/lib/progress-io";
import { createDemoProgress } from "@/lib/demo";

import {
  LENS_OPTIONS,
  AfricanContextLens,
  applyAfricanContextPrompt,
} from "@/lib/africanPrompts";
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { Bar, BarChart, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { questionBank } from '@/data/index';
import { buildExamSet, buildPracticeSet, buildRemediationSet, shuffleOptions, selectNextSessionQuestion } from '@/lib/selection';
import { calculateAccuracy, calculateStreak, countAnsweredQuestions, getAccuracyTrend, getDomainBreakdown, getExamResults, getWeakSubtopics } from '@/lib/scoring';
import { addAttempt, isValidPracticeSession, setPendingAnswer, toggleBookmark, useProgressStore } from '@/lib/store';
import { Domain, Confidence, ExplainResponse, LearningSignal, PairDrillResult, PracticeSessionState, Question, TeachBackResult } from '@/lib/types';
import { formatRating, getDomainRatingHistory, latestDomainRating, latestRating, ratingLevel, scoreResponse, selectAdaptiveQuestion, updateRating } from '@/lib/adaptive';
import { confusionPairs } from '@/data/confusionPairs';
import { findTriggeredPair, getPairStatus, pairTriggerCount } from '@/lib/pairs';
import { gradeExplanationFallback, parseGradeResponse } from '@/lib/teachback';
import { classifyLearningSignal, signalGuidance, signalLabel } from '@/lib/confidence';
import { captureSubmittedAnswer, canChangeSelection, getCorrectAnswerDisplay, isSelectionCorrect, resolvePendingAnswer, shouldRecordBeforeAdvance, withPhase, withTeachBack } from '@/lib/practice-flow';
import { parseProgress, serializeProgress } from '@/lib/progress-io';
import { createDemoProgress } from '@/lib/demo';

type ExamResult = ReturnType<typeof getExamResults>;
type ExamSessionState = {
  questions?: Question[];
  currentIndex?: number;
  answers?: Record<string, string[]>;
  flagged?: string[];
  timeLeft?: number;
  startedAt?: number;
};

const DOMAINS = [
  "cloud-concepts",
  "architecture-services",
  "management-governance",
] as const;
const DOMAIN_LABELS: Record<Domain, string> = {
  "cloud-concepts": "Cloud concepts",
  "architecture-services": "Architecture & services",
  "management-governance": "Management & governance",
};

const DASH_COLORS: Record<Domain, string> = {
  "cloud-concepts": "#3b82f6",
  "architecture-services": "#10b981",
  "management-governance": "#f59e0b",
};

export default function HomePage() {
  const attempts = useProgressStore((state) => state.attempts);
  const bookmarks = useProgressStore((state) => state.bookmarks);
  const pendingAnswer = useProgressStore((state) => state.pendingAnswer);
  const [selectedDomains, setSelectedDomains] = useState<Domain[]>([
    ...DOMAINS,
  ]);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [count, setCount] = useState(30);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState(true);
  const [teachBackEnabled, setTeachBackEnabled] = useState(false);
  const [teachBackText, setTeachBackText] = useState("");
  const [teachBackResult, setTeachBackResult] =
    useState<TeachBackResult | null>(null);
  const [learningSignal, setLearningSignal] = useState<
    LearningSignal | "unknown" | null
  >(null);
  const [activeLens, setActiveLens] = useState<AfricanContextLens>("standard");
  // The pending answer is the single source of truth for the answer steps:
  // while it exists the answer is frozen and not yet recorded. It lives in
  // the progress store so it survives navigation, refresh and page unload.
  const awaitingTeachBack = pendingAnswer?.phase === "awaiting-teach-back";
  const awaitingConfidence = pendingAnswer?.phase === "awaiting-confidence";
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeInitialized, setThemeInitialized] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [adaptivePool, setAdaptivePool] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [isExamMode, setIsExamMode] = useState(false);
  const [examAnswers, setExamAnswers] = useState<Record<string, string[]>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(45 * 60);
  const [examStartedAt, setExamStartedAt] = useState<number | null>(null);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [reviewFilter, setReviewFilter] = useState<
    "all" | "incorrect" | "flagged"
  >("incorrect");
  const [aiMode, setAiMode] = useState<
    "ELI5" | "Analogy" | "Deep Dive" | "Exam Tip"
  >("ELI5");
  const [aiFollowUp, setAiFollowUp] = useState("");
  const [aiResponse, setAiResponse] = useState<ExplainResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [ratingDelta, setRatingDelta] = useState<{
    before: number;
    after: number;
    delta: number;
    reason: string;
    score: number;
    expected: number;
    kFactor: number;
  } | null>(null);
  const [levelNotice, setLevelNotice] = useState("");
  const [sessionTarget, setSessionTarget] = useState(0);
  const [subtopicChange, setSubtopicChange] = useState<{
    before: number;
    after: number;
  } | null>(null);
  const [showRatingMath, setShowRatingMath] = useState(false);
  const [activePairId, setActivePairId] = useState<string | null>(null);
  const [practiceSessionMode, setPracticeSessionMode] =
    useState<PracticeSessionState["mode"]>("practice");
  const [pairDrillStartedAt, setPairDrillStartedAt] = useState<number | null>(
    null,
  );
  const [pairBaselineAccuracy, setPairBaselineAccuracy] = useState(0);
  const [pairDrillResult, setPairDrillResult] =
    useState<PairDrillResult | null>(null);
  const [dismissedPairId, setDismissedPairId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex] ?? null;
  const accuracy = calculateAccuracy(attempts);
  const streak = calculateStreak(attempts);
  useEffect(() => {
    const savedTheme = window.localStorage.getItem("az900-theme");
    const nextTheme =
      savedTheme === "dark" ||
      (savedTheme === null &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(nextTheme);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeInitialized(true);
  }, []);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const demoState = useProgressStore.getState().sessions.demo as
      | { enabled?: boolean }
      | undefined;
    const isDemoQuery = query.get("demo") === "1";
    if (isDemoQuery) {
      useProgressStore.setState(createDemoProgress(Date.now()));
    }
    if (isDemoQuery || demoState?.enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeachBackEnabled(true);
    }
    const pairId = new URLSearchParams(window.location.search).get("drill");
    const pair = confusionPairs.find((item) => item.id === pairId);
    if (!pair) return;
    const drillQuestions = pair.drillQuestionIds
      .map((id) => questionBank.find((question) => question.id === id))
      .filter((question): question is Question => Boolean(question));
    if (drillQuestions.length !== 5) return;
    const existingPairAttempts = useProgressStore
      .getState()
      .attempts.filter((attempt) => attempt.pairId === pair.id);
    const priorAccuracy = existingPairAttempts.length
      ? Math.round(
          (existingPairAttempts.filter((attempt) => attempt.correct).length /
            existingPairAttempts.length) *
            100,
        )
      : 0;
    const sessions = useProgressStore.getState().sessions;
    useProgressStore.setState({
      sessions: { ...sessions, practice: null, exam: null },
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuestions(drillQuestions);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdaptivePool([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentIndex(0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedAnswer([]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubmitted(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFeedbackOpen(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsExamMode(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActivePairId(pair.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPracticeSessionMode("pair-drill");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPairDrillStartedAt(Date.now());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPairBaselineAccuracy(priorAccuracy);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPairDrillResult(null);
    setRatingDelta(null);
    setSubtopicChange(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionTarget(5);
    window.history.replaceState(null, "", "/");
  }, []);

  useEffect(() => {
    // Keep the clock client-only so static generation does not freeze a server timestamp.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
  }, []);
  const trend = getAccuracyTrend(attempts, now ?? 0);
  const domainBreakdown = getDomainBreakdown(questionBank, attempts);
  const radarData = domainBreakdown.map((entry) => ({
    subject: DOMAIN_LABELS[entry.domain],
    score: entry.accuracy,
  }));
  const weaknessList = getWeakSubtopics(questionBank, attempts);
  const currentRating = latestRating(attempts);
  const ratingHistory = getDomainRatingHistory(attempts, questionBank);
  const currentLevel = ratingLevel(currentRating);
  const pairResults = (useProgressStore((state) => state.sessions.pairDrills) ??
    {}) as Record<string, PairDrillResult>;
  const triggeredPair = findTriggeredPair(
    confusionPairs,
    attempts,
    pairResults,
  );

  const reviewQuestions = useMemo(() => {
    if (!questions.length) return [];
    return questions.filter((question) => {
      const selected = [...(examAnswers[question.id] ?? [])].sort();
      const isCorrect = isSelectionCorrect(question, selected);
      const isIncorrect = !isCorrect || !selected.length;
      const flaggedThis = flagged.includes(question.id);
      if (reviewFilter === "incorrect") return isIncorrect;
      if (reviewFilter === "flagged") return flaggedThis;
      return isIncorrect || flaggedThis;
    });
  }, [questions, examAnswers, flagged, reviewFilter]);

  useEffect(() => {
    if (!themeInitialized) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("az900-theme", theme);
  }, [theme, themeInitialized]);

  useEffect(() => {
    const savedExam = useProgressStore.getState().sessions as
      | Record<string, ExamSessionState | undefined>
      | undefined;
    const activeExam = savedExam?.exam as ExamSessionState | undefined;
    if (
      activeExam &&
      Array.isArray(activeExam.questions) &&
      activeExam.questions.length
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuestions(activeExam.questions);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentIndex(activeExam.currentIndex ?? 0);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAnswer(
        activeExam.answers?.[
          activeExam.questions[activeExam.currentIndex ?? 0]?.id
        ] ?? [],
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExamAnswers(activeExam.answers ?? {});
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFlagged(activeExam.flagged ?? []);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeLeft(activeExam.timeLeft ?? 45 * 60);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExamStartedAt(activeExam.startedAt ?? Date.now());
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsExamMode(true);
    } else if (!new URLSearchParams(window.location.search).has("drill")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionTarget(activeExam.questions.length);
    } else if (!new URLSearchParams(window.location.search).has('drill')) {
      const activePractice = savedExam?.practice;
      if (!isValidPracticeSession(activePractice)) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuestions(activePractice.questions);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdaptivePool(activePractice.adaptivePool);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentIndex(activePractice.currentIndex);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAnswer(activePractice.selectedAnswer);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionTarget(activePractice.sessionTarget);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAdaptiveEnabled(activePractice.adaptiveEnabled);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedDomains(activePractice.selectedDomains);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDifficulty(activePractice.difficulty);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCount(activePractice.count);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubmitted(activePractice.submitted);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFeedbackOpen(activePractice.feedbackOpen);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeachBackText(activePractice.teachBackText);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTeachBackResult(activePractice.teachBackResult);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLearningSignal(activePractice.learningSignal);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePairId(activePractice.activePairId);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPracticeSessionMode(activePractice.mode);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPairDrillStartedAt(activePractice.pairDrillStartedAt);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPairBaselineAccuracy(activePractice.pairBaselineAccuracy);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRatingDelta(activePractice.ratingDelta);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSubtopicChange(activePractice.subtopicChange);
    } else {
      return;
    }

    // Sync local UI state from a restored pending answer. The pending answer
    // lives in the progress store so it survives navigation, refresh and
    // page unload; when it is restored we must bring the teach-back text and
    // result back into component state so the UI shows the same thing.
    const restored = useProgressStore.getState().pendingAnswer;
    if (restored) {
      if (restored.phase === "awaiting-teach-back") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTeachBackResult(null);
      } else if (restored.teachBack) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTeachBackResult(restored.teachBack);
      }
    }
  }, []);

  useEffect(() => {
    if (isExamMode || !questions.length || examResult) return;
    const session: PracticeSessionState = {
      mode: practiceSessionMode,
      questions,
      adaptivePool,
      currentIndex,
      selectedAnswer,
      sessionTarget,
      adaptiveEnabled,
      selectedDomains,
      difficulty,
      count,
      submitted,
      feedbackOpen,
      teachBackText,
      teachBackResult,
      learningSignal,
      activePairId,
      pairDrillStartedAt,
      pairBaselineAccuracy,
      ratingDelta,
      subtopicChange,
    };
    const saveSession = () => {
      useProgressStore.setState({
        sessions: {
          ...useProgressStore.getState().sessions,
          practice: session,
        },
      });
    };
    saveSession();
    window.addEventListener("pagehide", saveSession);
    return () => window.removeEventListener("pagehide", saveSession);
  }, [
    isExamMode,
    questions,
    examResult,
    adaptivePool,
    currentIndex,
    selectedAnswer,
    sessionTarget,
    adaptiveEnabled,
    selectedDomains,
    difficulty,
    count,
    submitted,
    feedbackOpen,
    teachBackText,
    teachBackResult,
    learningSignal,
    activePairId,
    pairDrillStartedAt,
    pairBaselineAccuracy,
    ratingDelta,
    subtopicChange,
  ]);

  useEffect(() => {
    if (!isExamMode || !questions.length || examResult) return;
    const payload = {
      questions,
      currentIndex,
      answers: examAnswers,
      flagged,
      startedAt: examStartedAt ?? Date.now(),
      timeLeft,
    };
    useProgressStore.setState({
      sessions: {
        ...(useProgressStore.getState().sessions ?? {}),
        exam: payload,
      },
    });
  }, [
    isExamMode,
    questions,
    currentIndex,
    examAnswers,
    flagged,
    timeLeft,
    examStartedAt,
    examResult,
  ]);

  useEffect(() => {
    if (!isExamMode || examResult || !examStartedAt) return;
    const id = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(id);
          finishExam(true);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [isExamMode, examStartedAt, examResult]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!currentQuestion || submitted) return;
      const key = Number(event.key);
      if (key >= 1 && key <= 4) {
        const option = currentQuestion.options[key - 1];
        // A submitted answer is frozen while the learner is asked for a
        // teach-back or for their confidence.
        if (option && canChangeSelection({ submitted, pending: pendingAnswer }))
          handleChoice(option.id);
      }
      if (event.key === "Enter") {
        if (selectedAnswer.length > 0 || currentQuestion.type === "single") {
          handleSubmit();
        }
      }
      if (event.key.toLowerCase() === "b") {
        toggleBookmark(currentQuestion.id);
      }
      if (event.key.toLowerCase() === "e") {
        handleExplain();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentQuestion, selectedAnswer, submitted, pendingAnswer]);

  function levelForRating(rating: number) {
    return ratingLevel(rating);
  }

  function handleChoice(optionId: string) {
    if (
      !currentQuestion ||
      !canChangeSelection({ submitted, pending: pendingAnswer })
    )
      return;
    if (currentQuestion.type === "single") {
      setSelectedAnswer([optionId]);
      return;
    }
    setSelectedAnswer((current) =>
      current.includes(optionId)
        ? current.filter((value) => value !== optionId)
        : [...current, optionId],
    );
  }

  function clearStoredSession(name: "exam" | "practice") {
    const sessions = useProgressStore.getState().sessions;
    useProgressStore.setState({ sessions: { ...sessions, [name]: null } });
  }

  function startPairDrill(pairId: string) {
    const pair = confusionPairs.find((item) => item.id === pairId);
    if (!pair) return;
    const drillQuestions = pair.drillQuestionIds
      .map((id) => questionBank.find((question) => question.id === id))
      .filter((question): question is Question => Boolean(question));
    if (drillQuestions.length !== 5) return;
    const previous = attempts.filter((attempt) => attempt.pairId === pairId);
    clearStoredSession("practice");
    setPairBaselineAccuracy(
      previous.length
        ? Math.round(
            (previous.filter((attempt) => attempt.correct).length /
              previous.length) *
              100,
          )
        : 0,
    );
    flushPendingAnswer();
    setQuestions(drillQuestions);
    setAdaptivePool([]);
    setCurrentIndex(0);
    setSelectedAnswer([]);
    setSubmitted(false);
    setFeedbackOpen(false);
    setPendingAnswer(null);
    setLearningSignal(null);
    setTeachBackText("");
    setTeachBackResult(null);
    setIsExamMode(false);
    setExamResult(null);
    setExamAnswers({});
    setFlagged([]);
    setSessionTarget(5);
    setActivePairId(pairId);
    setPracticeSessionMode("pair-drill");
    clearStoredSession("exam");
    setPairDrillStartedAt(Date.now());
    setPairDrillResult(null);
    setRatingDelta(null);
    setAiResponse(null);
  }

  function startPractice() {
    flushPendingAnswer();
    clearStoredSession("exam");
    clearStoredSession("practice");
    setPracticeSessionMode("practice");
    const pool = buildPracticeSet(
      questionBank,
      selectedDomains,
      difficulty,
      count,
      Date.now(),
    );
    const next = pool.map((question, index) =>
      shuffleOptions(question, index + 1),
    );
    const firstQuestion = adaptiveEnabled
      ? selectAdaptiveQuestion(
          next,
          currentRating,
          attempts,
          [],
          Math.random,
          (question) =>
            latestDomainRating(attempts, question.domain, questionBank),
        )
      : next[0];
    const target = Math.min(count, next.length);
    setAdaptivePool(next);
    setQuestions(firstQuestion ? [firstQuestion] : []);
    setSessionTarget(target);
    setCurrentIndex(0);
    setSelectedAnswer([]);
    setSubmitted(false);
    setFeedbackOpen(false);
    setPendingAnswer(null);
    setLearningSignal(null);
    setTeachBackText("");
    setTeachBackResult(null);
    setAiResponse(null);
    setIsExamMode(false);
    setExamResult(null);
    setExamAnswers({});
    setFlagged([]);
    setTimeLeft(45 * 60);
    setExamStartedAt(null);
    setActivePairId(null);
    setPairDrillStartedAt(null);
    setRatingDelta(null);
    setSubtopicChange(null);
    setPairDrillResult(null);
  }

  function startExam() {
    flushPendingAnswer();
    clearStoredSession("practice");
    const examPool = buildExamSet(questionBank, Date.now(), 50);
    const next = examPool.map((question, index) =>
      shuffleOptions(question, index + 7),
    );
    setQuestions(next);
    setAdaptivePool([]);
    setSessionTarget(next.length);
    setCurrentIndex(0);
    setSelectedAnswer([]);
    setSubmitted(false);
    setFeedbackOpen(false);
    setPendingAnswer(null);
    setLearningSignal(null);
    setTeachBackText("");
    setTeachBackResult(null);
    setIsExamMode(true);
    setExamAnswers({});
    setFlagged([]);
    setTimeLeft(45 * 60);
    setExamStartedAt(Date.now());
    setExamResult(null);
    setAiResponse(null);
    setActivePairId(null);
    setPairDrillStartedAt(null);
    setRatingDelta(null);
    setSubtopicChange(null);
  }

  function startRemediation() {
    flushPendingAnswer();
    clearStoredSession("exam");
    clearStoredSession("practice");
    setPracticeSessionMode("remediation");
    const pool = buildRemediationSet(questionBank, attempts, Date.now(), 10);
    const next = pool.map((question, index) =>
      shuffleOptions(question, index + 3),
    );
    const firstQuestion = adaptiveEnabled
      ? selectAdaptiveQuestion(
          next,
          currentRating,
          attempts,
          [],
          Math.random,
          (question) =>
            latestDomainRating(attempts, question.domain, questionBank),
        )
      : next[0];
    setAdaptivePool(next);
    setSessionTarget(next.length);
    setQuestions(firstQuestion ? [firstQuestion] : []);
    setCurrentIndex(0);
    setSelectedAnswer([]);
    setSubmitted(false);
    setFeedbackOpen(false);
    setPendingAnswer(null);
    setLearningSignal(null);
    setTeachBackText("");
    setTeachBackResult(null);
    setIsExamMode(false);
    setExamResult(null);
    setExamAnswers({});
    setFlagged([]);
    setTimeLeft(45 * 60);
    setExamStartedAt(null);
    setAiResponse(null);
    setActivePairId(null);
    setPairDrillStartedAt(null);
  }

  function finishExam(
    answerMapOrForceSubmit: Record<string, string[]> | boolean = examAnswers,
    forceSubmit = false,
  ) {
    if (!questions.length) return;
    const answerMap =
      typeof answerMapOrForceSubmit === "boolean"
        ? examAnswers
        : answerMapOrForceSubmit;
    const shouldForceSubmit =
      typeof answerMapOrForceSubmit === "boolean"
        ? answerMapOrForceSubmit
        : forceSubmit;
    const result = getExamResults(questions, answerMap);
    setExamResult(result);
    setSubmitted(false);
    setFeedbackOpen(false);
    setIsExamMode(shouldForceSubmit ? true : false);
    useProgressStore.setState({
      sessions: {
        ...useProgressStore.getState().sessions,
        exam: null,
        practice: null,
      },
    });
    const scoredAttempts = questions.map((question) => {
      const chosen = [...(answerMap[question.id] ?? [])].sort();
      const isCorrect = isSelectionCorrect(question, chosen);
      return {
        qid: question.id,
        chosen,
        correct: isCorrect,
        ms: 1000,
        ts: Date.now(),
        mode: "exam" as const,
        ratingBefore: 1200,
        ratingAfter: 1200,
      };
    });
    scoredAttempts.forEach((attempt) => addAttempt(attempt));
  }

  function handleSubmit() {
    if (!currentQuestion || awaitingTeachBack || awaitingConfidence) return;

    if (isExamMode) {
      const orderedSelected = [...selectedAnswer].sort();
      const nextAnswers = {
        ...examAnswers,
        [currentQuestion.id]: orderedSelected,
      };
      setExamAnswers(nextAnswers);
      if (currentIndex >= questions.length - 1) {
        finishExam(nextAnswers, true);
        return;
      }
      const nextQuestion = questions[currentIndex + 1];
      setCurrentIndex((value) => value + 1);
      setSelectedAnswer(nextAnswers[nextQuestion.id] ?? []);
      setSubmitted(false);
      setFeedbackOpen(false);
      return;
    }

    // Capture the submitted answer now. Everything that follows (teach-back,
    // confidence, advancing) works from this snapshot, so the recorded answer
    // always matches what the learner actually submitted.
    setPendingAnswer(
      captureSubmittedAnswer(
        currentQuestion,
        selectedAnswer,
        teachBackEnabled ? "awaiting-teach-back" : "awaiting-confidence",
      ),
    );
    setLearningSignal(null);
    if (teachBackEnabled) {
      setTeachBackText("");
      setTeachBackResult(null);
    }
  }

  function recordPracticeAnswer(
    gradedConfidence?: Confidence,
    openFeedback = true,
  ) {
    const pending = pendingAnswer;
    if (!pending) return;
    const question = questionBank.find((item) => item.id === pending.qid);
    if (!question) {
      setPendingAnswer(null);
      return;
    }
    const orderedSelected = pending.chosen;
    const isCorrect = pending.correct;
    const gradedTeachBack = pending.teachBack;
    const currentAttempts = useProgressStore.getState().attempts;
    const before = latestRating(currentAttempts);
    const domainAttempts = useProgressStore
      .getState()
      .attempts.filter(
        (attempt) =>
          questionBank.find((item) => item.id === attempt.qid)?.domain ===
          question.domain,
      ).length;
    const responseScore = scoreResponse(
      question,
      orderedSelected,
      gradedTeachBack?.score,
    );
    const ratingUpdate = updateRating(
      before,
      question,
      responseScore,
      domainAttempts,
    );
    const subtopicQuestionIds = new Set(
      questionBank
        .filter((item) => item.subtopic === question.subtopic)
        .map((item) => item.id),
    );
    const priorSubtopicAttempts = useProgressStore
      .getState()
      .attempts.filter((attempt) => subtopicQuestionIds.has(attempt.qid));
    const priorSubtopicAccuracy = priorSubtopicAttempts.length
      ? priorSubtopicAttempts.filter((attempt) => attempt.correct).length /
        priorSubtopicAttempts.length
      : 0;
    const nextSubtopicAccuracy =
      (priorSubtopicAttempts.filter((attempt) => attempt.correct).length +
        Number(isCorrect)) /
      (priorSubtopicAttempts.length + 1);
    setSubtopicChange({
      before: Math.round(priorSubtopicAccuracy * 100),
      after: Math.round(nextSubtopicAccuracy * 100),
    });
    // Confidence is a learning signal only. It is recorded for feedback and
    // future remediation hints; it must never influence the Elo rating,
    // adaptive selection, exam scoring, or any mastery claim.
    const signal = classifyLearningSignal(isCorrect, gradedConfidence);
    setLearningSignal(signal);
    const resolution = resolvePendingAnswer(
      pending,
      {
        mode: "practice",
        ms: 1200,
        ts: Date.now(),
        ratingBefore: ratingUpdate.before,
        ratingAfter: ratingUpdate.after,
        pairId: question.pairId,
      },
      gradedConfidence,
    );
    if (!resolution.attempt) return;
    // Clearing the pending answer is what guarantees an answer is recorded
    // exactly once: a later advance finds nothing left to record.
    setPendingAnswer(resolution.pending);
    addAttempt(resolution.attempt);
    if (adaptiveEnabled) {
      setRatingDelta({
        before: ratingUpdate.before,
        after: ratingUpdate.after,
        delta: ratingUpdate.delta,
        score: ratingUpdate.score,
        expected: ratingUpdate.expected,
        kFactor: ratingUpdate.kFactor,
        reason: isCorrect
          ? `${["Easy", "Medium", "Hard"][question.difficulty - 1]} question, answered correctly${question.type === "single" && responseScore < 1 ? " but teach-back was fragile" : ""}.`
          : "This question was harder than your current rating predicts.",
      });
      if (levelForRating(before) !== levelForRating(ratingUpdate.after)) {
        const notice =
          ratingUpdate.after > before
            ? "Leveling up: expect harder scenarios."
            : "Level adjustment: expect more foundational scenarios.";
        setLevelNotice(notice);
        window.setTimeout(() => setLevelNotice(""), 3500);
      }
    }

    if (openFeedback) {
      if (isCorrect) {
        confetti({ particleCount: 80, spread: 90, origin: { y: 0.7 } });
      }
      setSubmitted(true);
      setFeedbackOpen(true);
      setTeachBackResult(gradedTeachBack ?? null);
      setShowModelAnswer(false);
    }
  }

  /**
   * Record an answer the learner submitted but never confirmed, for example
   * when they advance or finish while the confidence prompt is still open.
   * The answer is stored without a confidence value: nothing is invented.
   * The feedback drawer is opened so the learner can see whether the answer
   * was correct before the next question appears.
   */
  function flushPendingAnswer() {
    if (!shouldRecordBeforeAdvance(pendingAnswer)) return;
    recordPracticeAnswer(undefined, true);
  }

  async function submitTeachBack() {
    if (!currentQuestion) return;
    const text = teachBackText.trim().slice(0, 240);
    // Capture the question identity before awaiting the grader. If the learner
    // advances or changes mode while grading is in flight, a late result must
    // not be attached to an answer that has already been recorded.
    const expectedQid = currentQuestion.id;
    let graded: Omit<TeachBackResult, "text"> = gradeExplanationFallback(
      currentQuestion,
      text,
    );
    try {
      let sessionId = window.sessionStorage.getItem("az900-learning-session");
      if (!sessionId) {
        sessionId = window.crypto.randomUUID();
        window.sessionStorage.setItem("az900-learning-session", sessionId);
      }
      const response = await fetch("/api/grade-explanation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-learning-session": sessionId,
        },
        body: JSON.stringify({ question: currentQuestion, text }),
      });
      if (response.ok) {
        const payload = await response.json();
        const valid = parseGradeResponse(payload, currentQuestion);
        if (
          valid &&
          (payload.source === "ai" || payload.source === "fallback")
        ) {
          graded = { ...valid, source: payload.source };
        }
      } else {
        console.error(
          `Teach-back grader returned HTTP ${response.status}; using deterministic fallback.`,
        );
      }
    } catch (error) {
      console.error(
        "Teach-back grader could not be reached; using deterministic fallback.",
        error,
      );
    }
    // Discard the result if the learner moved on while grading was in flight.
    const current = useProgressStore.getState().pendingAnswer;
    if (!current || current.qid !== expectedQid) return;
    setTeachBackResult({ ...graded, text });
    // Keep the graded result on the pending answer: it must survive the
    // confidence step and still count towards the rating calculation.
    setPendingAnswer((previous) =>
      previous
        ? withTeachBack(withPhase(previous, "awaiting-confidence"), {
            ...graded,
            text,
          })
        : previous,
    );
    setLearningSignal(null);
  }

  function skipTeachBack() {
    setTeachBackText("");
    setTeachBackResult(null);
    setPendingAnswer((previous) =>
      previous ? withPhase(previous, "awaiting-confidence") : previous,
    );
    setLearningSignal(null);
  }

  function submitConfidence(nextConfidence: Confidence) {
    if (!currentQuestion || awaitingTeachBack) return;
    recordPracticeAnswer(nextConfidence);
  }

  function skipConfidence() {
    if (!currentQuestion || awaitingTeachBack) return;
    setLearningSignal(null);
    recordPracticeAnswer();
  }

  function handleNext() {
    // An answer that was submitted but never confirmed is recorded here, so
    // advancing or finishing can never lose it.
    flushPendingAnswer();
    if (isExamMode) {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex((value) => value + 1);
        setSelectedAnswer(examAnswers[questions[currentIndex + 1].id] ?? []);
        return;
      }
      finishExam(true);
      return;
    }
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((value) => value + 1);
      setSelectedAnswer([]);
      setSubmitted(false);
      setFeedbackOpen(false);
      setPendingAnswer(null);
      setLearningSignal(null);
      setTeachBackText("");
      setTeachBackResult(null);
      setAiResponse(null);
      setRatingDelta(null);
      setSubtopicChange(null);
      return;
    }
    if (adaptiveEnabled && questions.length < sessionTarget) {
      const currentAttempts = useProgressStore.getState().attempts;
      const nextQuestion = selectAdaptiveQuestion(
        adaptivePool,
        latestRating(currentAttempts),
        currentAttempts,
        questions.map((question) => question.id),
        Math.random,
        (question) =>
          latestDomainRating(currentAttempts, question.domain, questionBank),
      );
      if (nextQuestion) {
        setQuestions((current) => [...current, nextQuestion]);
        setCurrentIndex((index) => index + 1);
        setSelectedAnswer([]);
        setSubmitted(false);
        setFeedbackOpen(false);
        setPendingAnswer(null);
        setLearningSignal(null);
        setTeachBackText("");
        setTeachBackResult(null);
        setAiResponse(null);
        setRatingDelta(null);
        setSubtopicChange(null);
        return;
      }
    }
    if (activePairId && pairDrillStartedAt !== null) {
      const drillAttempts = useProgressStore
        .getState()
        .attempts.filter(
          (attempt) =>
            attempt.pairId === activePairId && attempt.ts >= pairDrillStartedAt,
        );
      const result: PairDrillResult = {
        correct: drillAttempts.filter((attempt) => attempt.correct).length,
        total: 5,
        completedAt: Date.now(),
        beforeAccuracy: pairBaselineAccuracy,
        afterAccuracy: Math.round(
          (drillAttempts.filter((attempt) => attempt.correct).length / 5) * 100,
        ),
      };
      const sessions = useProgressStore.getState().sessions;
      const previousRuns = (sessions.pairDrills ?? {}) as Record<
        string,
        PairDrillResult
      >;
      useProgressStore.setState({
        sessions: {
          ...sessions,
          pairDrills: { ...previousRuns, [activePairId]: result },
        },
      });
      setPairDrillResult(result);
      setPairDrillStartedAt(null);
    }
    clearStoredSession("practice");
    if (!activePairId && questions.length < sessionTarget) {
      const nextQuestion = selectNextSessionQuestion(
        adaptiveEnabled,
        adaptivePool,
        useProgressStore.getState().attempts,
        questions.map((question) => question.id),
        Math.random,
      );
      if (nextQuestion) {
        setQuestions((current) => [...current, nextQuestion]);
        setCurrentIndex((index) => index + 1);
        setSelectedAnswer([]);
        setSubmitted(false);
        setFeedbackOpen(false);
        setPendingAnswer(null);
        setLearningSignal(null);
        setTeachBackText('');
        setTeachBackResult(null);
        setAiResponse(null);
        setRatingDelta(null);
        setSubtopicChange(null);
        return;
      }
    }
    clearStoredSession('practice');
    setCurrentIndex(0);
    setQuestions([]);
    setSelectedAnswer([]);
    setSubmitted(false);
    setFeedbackOpen(false);
    setAiResponse(null);
  }

  async function handleExplain() {
    if (!currentQuestion) return;
    setAiLoading(true);

    const promptToSubmit = applyAfricanContextPrompt(aiFollowUp, activeLens);
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: aiMode,
          question: currentQuestion,
          chosenAnswer: selectedAnswer,
          followUp: promptToSubmit,
        }),
      });

      const json = await response.json();
      setAiResponse(json);
    } catch {
      setAiResponse({
        mode: aiMode,
        headline: "Here is the core idea in plain English.",
        explanation: currentQuestion.explanation.summary,
        commonMistake: currentQuestion.explanation.whyCorrect,
        checkYourself: {
          question: "What is the main Azure concept behind this question?",
          answer: currentQuestion.explanation.docsTopic,
        },
      });
    } finally {
      setAiLoading(false);
    }
  }

  function exportProgress() {
    const payload = serializeProgress({
      attempts,
      bookmarks,
      pendingAnswer,
    });
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "az900-progress.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function loadDemoData() {
    useProgressStore.setState(createDemoProgress(Date.now()));
    clearStoredSession("practice");
    clearStoredSession("exam");
    setTeachBackEnabled(true);
    setAdaptiveEnabled(true);
    setQuestions([]);
    setCurrentIndex(0);
    setActivePairId(null);
    setPairDrillResult(null);
    setRatingDelta(null);
  }

  function resetDemoData() {
    loadDemoData();
  }

  function importProgress() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setImportError(null);
      const text = await file.text();
      // A file that cannot be read leaves the existing progress untouched.
      const parsed = parseProgress(text);
      if (!parsed) {
        setImportError(
          "That file could not be imported. Check that it is a valid AZ-900 progress export.",
        );
        return;
      }
      useProgressStore.setState({
        attempts: parsed.attempts,
        bookmarks: parsed.bookmarks,
        pendingAnswer: parsed.pendingAnswer,
      });
    };
    input.click();
  }

  function resetData() {
    const confirmed = window.confirm("Reset local progress and bookmarks?");
    if (!confirmed) return;
    useProgressStore.setState({
      attempts: [],
      bookmarks: {},
      pendingAnswer: null,
      sessions: {},
    });
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-sky-600">
                Unofficial AZ-900 Practice Tool
              </p>
              <h1 className="mt-2 text-3xl font-semibold">
                Build the habit of understanding why the answer is right.
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setTheme((current) => (current === "dark" ? "light" : "dark"))
                }
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium dark:border-slate-700"
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
              <div className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-200">
                Not affiliated with or endorsed by Microsoft.
              </div>
            </div>
          </div>
        </header>

        {examResult && (
          <section className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                  Exam results
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Score: {examResult.score}/1000
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {examResult.correct} of {examResult.totalQuestions} correct •
                  illustrative pass mark: {examResult.passMark}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={startRemediation}
                  className="rounded-full bg-emerald-700 px-3 py-2 text-sm font-medium text-white"
                >
                  Fix my weak spots
                </button>
                <button
                  onClick={() => {
                    setExamResult(null);
                    setQuestions([]);
                    setCurrentIndex(0);
                    setSelectedAnswer([]);
                  }}
                  className="rounded-full border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
                >
                  Review later
                </button>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {examResult.breakdown.map((item) => (
                <div
                  key={item.domain}
                  className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/60"
                >
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span>{DOMAIN_LABELS[item.domain]}</span>
                    <span>{item.accuracy}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: `${item.accuracy}%`,
                        background: DASH_COLORS[item.domain],
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.correct}/{item.total} correct
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-slate-200 bg-white/60 p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Review mode</h3>
                <div className="flex gap-2 text-xs">
                  {(["all", "incorrect", "flagged"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setReviewFilter(filter)}
                      className={`rounded-full px-2 py-1 ${reviewFilter === filter ? "bg-sky-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
              {reviewQuestions.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {reviewQuestions.map((question) => (
                    <button
                      key={question.id}
                      onClick={() => {
                        const targetIndex = questions.findIndex(
                          (item) => item.id === question.id,
                        );
                        if (targetIndex >= 0) {
                          setCurrentIndex(targetIndex);
                          setSelectedAnswer(examAnswers[question.id] ?? []);
                        }
                      }}
                      className="rounded-lg border border-slate-200 p-3 text-left text-sm dark:border-slate-700"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium">{question.subtopic}</span>
                        {flagged.includes(question.id) && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-200">
                            Flagged
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">
                        {question.stem}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No flagged or incorrect questions in this review set.
                </p>
              )}
            </div>
          </section>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Accuracy</p>
            <p className="mt-2 text-3xl font-bold">
              {Number(accuracy).toFixed(0)}%
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Current streak</p>
            <p className="mt-2 text-3xl font-bold">{streak}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-500">Questions answered</p>
            <p className="mt-2 text-3xl font-bold">
              {countAnsweredQuestions(attempts)}
            </p>
          </div>
        </section>
        {pairDrillResult && activePairId && (
          <section
            className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30"
            role="status"
          >
            <h2 className="font-semibold">
              {confusionPairs.find((pair) => pair.id === activePairId)?.a.name}{" "}
              vs{" "}
              {confusionPairs.find((pair) => pair.id === activePairId)?.b.name}:{" "}
              {getPairStatus(attempts, activePairId, pairDrillResult)}
            </h2>
            <p className="mt-1 text-sm">
              {pairDrillResult.correct} of {pairDrillResult.total} correct ·
              pair accuracy {pairDrillResult.beforeAccuracy}% →{" "}
              {pairDrillResult.afterAccuracy}%.
            </p>
          </section>
        )}
        <div className="mb-5 flex flex-wrap gap-2">
          <Link
            href="/pairs"
            className="rounded-full border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
          >
            Confusion-pair drills
          </Link>
          <Link
            href="/how-it-works"
            className="rounded-full border border-slate-300 px-3 py-2 text-sm dark:border-slate-700"
          >
            How learning adapts
          </Link>
        </div>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500">Adaptive learning rating</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                {formatRating(currentRating)}{" "}
                <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                  {currentLevel}
                </span>
              </p>
            </div>
            <p className="max-w-xl text-sm text-slate-600 dark:text-slate-300">
              The app selects practice questions near a 70% predicted success
              chance, then adjusts difficulty using your answers.
            </p>
          </div>
          <div
            className="mt-4 h-48"
            aria-label="Adaptive rating over time by exam domain"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ratingHistory}>
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis domain={[600, 1800]} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number" ? formatRating(value) : value
                  }
                />
                <Line
                  type="monotone"
                  dataKey="cloud-concepts"
                  name="Cloud concepts"
                  stroke={DASH_COLORS["cloud-concepts"]}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="architecture-services"
                  name="Architecture & services"
                  stroke={DASH_COLORS["architecture-services"]}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="management-governance"
                  name="Management & governance"
                  stroke={DASH_COLORS["management-governance"]}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {isExamMode ? "Exam simulation" : "Practice setup"}
              </h2>
              <div className="flex gap-2">
                <button
                  className="rounded-full border px-3 py-2 text-sm"
                  onClick={startPractice}
                >
                  Practice
                </button>
                <button
                  className="rounded-full bg-sky-600 px-3 py-2 text-sm text-white"
                  onClick={startExam}
                >
                  Exam
                </button>
                <button
                  className="rounded-full border border-violet-300 px-3 py-2 text-sm text-violet-800 dark:border-violet-800 dark:text-violet-200"
                  onClick={loadDemoData}
                >
                  Load demo data
                </button>
              </div>
            </div>

            {isExamMode && (
              <div className="mb-5 flex flex-col gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Time remaining</span>
                  <span className="font-mono text-lg font-semibold">
                    {Math.floor(timeLeft / 60)}:
                    {String(timeLeft % 60).padStart(2, "0")}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((question, index) => (
                    <button
                      key={question.id}
                      onClick={() => setCurrentIndex(index)}
                      className={`flex h-9 items-center justify-center rounded-lg text-xs font-medium ${currentIndex === index ? "bg-sky-600 text-white" : flagged.includes(question.id) ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200" : examAnswers[question.id] ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" : "bg-slate-100 dark:bg-slate-800"}`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5 space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">Domains</p>
                <div className="flex flex-wrap gap-2">
                  {DOMAINS.map((domain) => (
                    <button
                      key={domain}
                      onClick={() => {
                        setSelectedDomains((current) =>
                          current.includes(domain)
                            ? current.filter((value) => value !== domain)
                            : [...current, domain],
                        );
                      }}
                      className={`rounded-full border px-3 py-2 text-sm ${selectedDomains.includes(domain) ? "border-sky-600 bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200" : "border-slate-200 dark:border-slate-700"}`}
                    >
                      {DOMAIN_LABELS[domain]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <span>
                    <span className="block text-sm font-medium">
                      Adaptive difficulty
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Adjust practice to your rating
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={!isExamMode && adaptiveEnabled}
                    onChange={(event) =>
                      setAdaptiveEnabled(event.target.checked)
                    }
                    aria-label="Enable adaptive difficulty"
                    className="h-4 w-4 accent-sky-600"
                    disabled={isExamMode || questions.length > 0}
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <span>
                    <span className="block text-sm font-medium">
                      Teach-back mode
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Explain your choice in one sentence
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={teachBackEnabled}
                    onChange={(event) =>
                      setTeachBackEnabled(event.target.checked)
                    }
                    aria-label="Enable teach-back mode"
                    className="h-4 w-4 accent-violet-600"
                    disabled={isExamMode || questions.length > 0}
                  />
                </label>
                <label className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <span className="mb-2 block text-sm font-medium">
                    Difficulty
                  </span>
                  <select
                    className="w-full bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                    value={difficulty ?? "all"}
                    onChange={(event) =>
                      setDifficulty(
                        event.target.value === "all"
                          ? null
                          : Number(event.target.value),
                      )
                    }
                  >
                    <option value="all">All</option>
                    <option value="1">Easy</option>
                    <option value="2">Medium</option>
                    <option value="3">Hard</option>
                  </select>
                </label>
                <label className="rounded-xl border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                  <span className="mb-2 block text-sm font-medium">
                    Question count
                  </span>
                  <select
                    className="w-full bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={30}>30</option>
                  </select>
                </label>
              </div>
            </div>

            {questions.length > 0 && currentQuestion ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-2">
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-200">
                      {DOMAIN_LABELS[currentQuestion.domain]}
                    </span>
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs dark:bg-slate-800">
                      {currentQuestion.subtopic}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {isExamMode && (
                      <button
                        onClick={() =>
                          setFlagged((current) =>
                            current.includes(currentQuestion.id)
                              ? current.filter(
                                  (value) => value !== currentQuestion.id,
                                )
                              : [...current, currentQuestion.id],
                          )
                        }
                        className={`rounded-full border px-3 py-2 text-sm ${flagged.includes(currentQuestion.id) ? "border-amber-500 bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200" : ""}`}
                      >
                        {flagged.includes(currentQuestion.id)
                          ? "Flagged"
                          : "Flag for review"}
                      </button>
                    )}
                    <button
                      onClick={() => toggleBookmark(currentQuestion.id)}
                      className="rounded-full border px-3 py-2 text-sm"
                    >
                      {bookmarks[currentQuestion.id]
                        ? "★ Bookmarked"
                        : "☆ Bookmark"}
                    </button>
                  </div>
                </div>

                <p className="text-lg font-medium">
                  {currentIndex + 1}. {currentQuestion.stem}
                </p>
                <p className="text-xs text-slate-500">
                  Question {currentIndex + 1} of {sessionTarget}
                </p>
                {activePairId &&
                  confusionPairs.find((pair) => pair.id === activePairId) && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
                      <div className="grid gap-3 md:grid-cols-2">
                        {[
                          confusionPairs.find(
                            (pair) => pair.id === activePairId,
                          )!.a,
                          confusionPairs.find(
                            (pair) => pair.id === activePairId,
                          )!.b,
                        ].map((concept) => (
                          <div
                            key={concept.name}
                            className="rounded-lg bg-white/70 p-3 dark:bg-slate-900/60"
                          >
                            <h3 className="font-semibold">{concept.name}</h3>
                            <p className="mt-1 text-sm">{concept.oneLiner}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 space-y-2 text-xs">
                        {confusionPairs
                          .find((pair) => pair.id === activePairId)!
                          .comparison.map((row) => (
                            <p key={row.dimension}>
                              <strong>{row.dimension}:</strong> {row.a}{" "}
                              <span className="px-1 text-slate-500">vs</span>{" "}
                              {row.b}
                            </p>
                          ))}
                      </div>
                      <p className="mt-3 text-sm">
                        <strong>Rule of thumb:</strong>{" "}
                        {
                          confusionPairs.find(
                            (pair) => pair.id === activePairId,
                          )!.ruleOfThumb
                        }
                      </p>
                    </div>
                  )}
                {!isExamMode && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">
                        Difficulty meter · {currentLevel}
                      </span>
                      <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                        {
                          ["Easy", "Medium", "Hard"][
                            currentQuestion.difficulty - 1
                          ]
                        }{" "}
                        question
                      </span>
                    </div>
                    <div
                      className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500"
                      role="meter"
                      aria-label="Current learning rating"
                      aria-valuemin={600}
                      aria-valuemax={1800}
                      aria-valuenow={currentRating}
                    >
                      <motion.span
                        className="absolute -top-1.5 h-5 w-1 rounded-full bg-slate-900 dark:bg-white"
                        animate={{
                          left: `${((currentRating - 600) / 1200) * 100}%`,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 160,
                          damping: 20,
                        }}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-slate-500">
                      <span>Foundation</span>
                      <span>Advanced</span>
                    </div>
                  </div>
                )}
                {levelNotice && (
                  <p
                    className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800"
                    role="status"
                  >
                    {levelNotice}
                  </p>
                )}

                <div className="space-y-3">
                  {currentQuestion.options.map((option, index) => {
                    const isSelected = selectedAnswer.includes(option.id);
                    const isCorrectOption = currentQuestion.correct.includes(
                      option.id,
                    );
                    const isCorrect = submitted && isCorrectOption;
                    const isWrong = submitted && isSelected && !isCorrectOption;
                    const isMissedCorrect =
                      submitted &&
                      !isSelected &&
                      isCorrectOption &&
                      !isSelectionCorrect(currentQuestion, selectedAnswer);

                    return (
                      <button
                        key={option.id}
                        onClick={() => handleChoice(option.id)}
                        disabled={
                          !canChangeSelection({
                            submitted,
                            pending: pendingAnswer,
                          })
                        }
                        className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                          isCorrect
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                            : isWrong
                              ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                              : isMissedCorrect
                                ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                                : isSelected
                                  ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30"
                                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
                        }`}
                      >
                        <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold">
                          {index + 1}
                        </span>
                        <span className="flex-1">{option.text}</span>
                      </button>
                    );
                  })}
                </div>

                {awaitingConfidence && !isExamMode && (
                  <section
                    className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30"
                    aria-label="Rate your confidence"
                  >
                    <h3 className="text-sm font-semibold">
                      How confident are you in this answer?
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      This is a learning signal, not a test of knowledge. It is
                      recorded with your answer and never changes your rating or
                      the questions you get.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => submitConfidence("confident")}
                        className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
                      >
                        Confident
                      </button>
                      <button
                        onClick={() => submitConfidence("unsure")}
                        className="rounded-full bg-amber-700 px-4 py-2 text-sm font-medium text-white"
                      >
                        Unsure
                      </button>
                      <button
                        onClick={skipConfidence}
                        className="rounded-full border px-4 py-2 text-sm dark:border-slate-600"
                      >
                        Skip
                      </button>
                    </div>
                  </section>
                )}

                {awaitingTeachBack && (
                  <section className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900 dark:bg-violet-950/30">
                    <label
                      htmlFor="teach-back-answer"
                      className="block text-sm font-semibold"
                    >
                      In one sentence, why is that the answer?
                    </label>
                    <textarea
                      id="teach-back-answer"
                      value={teachBackText}
                      onChange={(event) =>
                        setTeachBackText(event.target.value.slice(0, 240))
                      }
                      maxLength={240}
                      className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      aria-describedby="teach-back-count"
                      autoFocus
                    />
                    <p
                      id="teach-back-count"
                      className="mt-1 text-right text-xs text-slate-500"
                      aria-live="polite"
                    >
                      {teachBackText.length}/240
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={submitTeachBack}
                        className="rounded-full bg-violet-700 px-3 py-2 text-sm font-medium text-white"
                      >
                        Submit teach-back
                      </button>
                      <button
                        onClick={skipTeachBack}
                        className="rounded-full border px-3 py-2 text-sm dark:border-slate-600"
                      >
                        Skip
                      </button>
                    </div>
                  </section>
                )}

                {submitted && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <span className="font-medium">
                      {isSelectionCorrect(currentQuestion, selectedAnswer)
                        ? "Correct."
                        : "Not quite."}
                    </span>
                    <span className="ml-2">
                      Correct answer: {getCorrectAnswerDisplay(currentQuestion)}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={handleSubmit}
                    className="rounded-full bg-sky-600 px-4 py-2 text-white"
                    disabled={
                      submitted || awaitingTeachBack || awaitingConfidence
                    }
                  >
                    {submitted ? "Answered" : "Submit"}
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={awaitingTeachBack}
                    className="rounded-full border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {currentIndex === questions.length - 1 &&
                    (isExamMode ||
                      !adaptiveEnabled ||
                      questions.length >= sessionTarget)
                      ? "Finish"
                      : "Next"}
                  <button onClick={handleNext} disabled={awaitingTeachBack} className="rounded-full border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">
                    {(isExamMode
                      ? (currentIndex < questions.length - 1 || (adaptiveEnabled && questions.length < sessionTarget))
                      : (currentIndex < questions.length - 1 || (!activePairId && sessionTarget > 0 && questions.length < sessionTarget)))
                      ? 'Next'
                      : 'Finish'}
                  </button>
                  <button
                    onClick={handleExplain}
                    className="rounded-full border px-4 py-2"
                  >
                    Explain
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Choose a practice set and start answering.
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-4 text-lg font-semibold">Weakness radar</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis domain={[0, 100]} />
                    <Radar
                      dataKey="score"
                      stroke="#38bdf8"
                      fill="#38bdf8"
                      fillOpacity={0.5}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 space-y-2">
                {weaknessList.length ? (
                  weaknessList.map((item) => (
                    <li
                      key={item.subtopic}
                      className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800"
                    >
                      <span>{item.subtopic}</span>
                      <span className="font-medium">{item.score}%</span>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-slate-500">
                    No weak spots yet. Start a quiz.
                  </li>
                )}
              </ul>
              <button
                onClick={startRemediation}
                className="mt-4 w-full rounded-full bg-sky-600 px-3 py-2 text-sm font-medium text-white"
              >
                Fix my weak spots
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-4 text-lg font-semibold">Accuracy trend</h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend}>
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip />
                    <Bar
                      dataKey="accuracy"
                      fill="#38bdf8"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-lg font-semibold">Progress details</h3>
            <div className="space-y-4">
              {domainBreakdown.map((item) => (
                <div key={item.domain}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{DOMAIN_LABELS[item.domain]}</span>
                    <span>{item.accuracy}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-2.5 rounded-full"
                      style={{
                        width: `${item.accuracy}%`,
                        background: DASH_COLORS[item.domain],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-lg font-semibold">Bookmarks</h3>
            <div className="space-y-2">
              {Object.entries(bookmarks).filter(([, active]) => active)
                .length ? (
                Object.entries(bookmarks)
                  .filter(([, active]) => active)
                  .map(([qid]) => (
                    <p
                      key={qid}
                      className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800"
                    >
                      {qid}
                    </p>
                  ))
              ) : (
                <p className="text-sm text-slate-500">No bookmarks yet.</p>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={exportProgress}
                className="rounded-full border px-3 py-2 text-sm"
              >
                Export
              </button>
              <button
                onClick={importProgress}
                className="rounded-full border px-3 py-2 text-sm"
              >
                Import
              </button>
              <button
                onClick={resetDemoData}
                className="rounded-full border border-violet-300 px-3 py-2 text-sm text-violet-800 dark:border-violet-800 dark:text-violet-200"
              >
                Reset demo
              </button>
              <button
                onClick={resetData}
                className="rounded-full border border-red-300 px-3 py-2 text-sm text-red-600"
              >
                Reset data
              </button>
            </div>
            {importError && (
              <p
                className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-200"
                role="alert"
              >
                {importError}
              </p>
            )}
          </div>
        </section>

        <AnimatePresence>
          {feedbackOpen && currentQuestion && (
            <motion.aside
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="fixed right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-semibold">Answer feedback</h3>
                <button
                  onClick={() => setFeedbackOpen(false)}
                  className="rounded-full border px-2 py-1 text-sm"
                >
                  Close
                </button>
              </div>
              <div className="space-y-4">
                {triggeredPair &&
                  currentQuestion.pairId === triggeredPair.id &&
                  dismissedPairId !== triggeredPair.id && (
                    <div
                      className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                      role="status"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p>
                          You&apos;ve mixed up {triggeredPair.a.name} and{" "}
                          {triggeredPair.b.name}{" "}
                          {pairTriggerCount(attempts, triggeredPair.id)} times
                          recently. Want a 2-minute fix?
                        </p>
                        <button
                          onClick={() => setDismissedPairId(triggeredPair.id)}
                          className="rounded border px-2 py-1 text-xs"
                          aria-label="Dismiss confusion-pair suggestion"
                        >
                          Dismiss
                        </button>
                      </div>
                      <button
                        onClick={() => startPairDrill(triggeredPair.id)}
                        className="mt-2 rounded-full bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white dark:bg-amber-200 dark:text-amber-950"
                      >
                        Start pair drill
                      </button>
                    </div>
                  )}
                <ol
                  className="grid gap-2 text-xs sm:grid-cols-3"
                  aria-label="Learning loop trace"
                  aria-live="polite"
                >
                  <motion.li
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0 }}
                    className="rounded-lg border border-sky-200 bg-sky-50 p-2 dark:border-sky-900 dark:bg-sky-950/40"
                  >
                    <span className="block font-semibold">1 · Answered</span>
                    <span>
                      {isSelectionCorrect(currentQuestion, selectedAnswer)
                        ? "✓ Correct"
                        : "✗ Needs another look"}
                    </span>
                    {teachBackResult && (
                      <span className="block">
                        Teach-back: {teachBackResult.score}/2
                        {isSelectionCorrect(currentQuestion, selectedAnswer) &&
                        teachBackResult.score === 0
                          ? " · Fragile understanding"
                          : ""}
                      </span>
                    )}
                  </motion.li>
                  <motion.li
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                  >
                    <span className="block font-semibold">2 · Tracked</span>
                    {ratingDelta ? (
                      <span>
                        Rating {formatRating(ratingDelta.before)} →{" "}
                        {formatRating(ratingDelta.after)} (
                        {ratingDelta.delta >= 0 ? "+" : ""}
                        {ratingDelta.delta.toFixed(0)})
                      </span>
                    ) : (
                      <span>Answer recorded</span>
                    )}
                    {subtopicChange && (
                      <span className="block">
                        Subtopic accuracy {subtopicChange.before}% →{" "}
                        {subtopicChange.after}%
                      </span>
                    )}
                  </motion.li>
                  <motion.li
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
                  >
                    <span className="block font-semibold">3 · Next up</span>
                    <span>
                      {triggeredPair &&
                      currentQuestion.pairId === triggeredPair.id
                        ? `Pair drill unlocked: ${triggeredPair.a.name} vs ${triggeredPair.b.name}`
                        : adaptiveEnabled && !isExamMode
                          ? "Selecting a practice item near 70% predicted success"
                          : "Continue with your selected question set"}
                    </span>
                  </motion.li>
                </ol>
                {learningSignal && learningSignal !== "unknown" && (
                  <div
                    className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30"
                    aria-label="Learning signal"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {signalLabel(learningSignal)}
                      </span>
                      <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 dark:bg-violet-950 dark:text-violet-200">
                        Learning signal
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {signalGuidance(learningSignal)}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      Confidence is a signal about this one answer, not a
                      measure of mastery.
                    </p>
                  </div>
                )}
                {ratingDelta && (
                  <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {ratingDelta.reason}{" "}
                    <button
                      onClick={() => setShowRatingMath((visible) => !visible)}
                      aria-expanded={showRatingMath}
                      className="font-medium underline"
                    >
                      Show the math
                    </button>
                    {showRatingMath && (
                      <span className="mt-1 block">
                        Rating {formatRating(ratingDelta.before)} +{" "}
                        {ratingDelta.kFactor} × ({ratingDelta.score.toFixed(2)}{" "}
                        − {ratingDelta.expected.toFixed(2)}) ={" "}
                        {formatRating(ratingDelta.after)}. Item rating is
                        1000/1200/1400 for easy/medium/hard questions.
                      </span>
                    )}
                  </p>
                )}
                {teachBackResult && (
                  <section
                    className="rounded-xl border border-violet-200 p-3 dark:border-violet-900"
                    aria-label="Teach-back score"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold">Teach-back</h4>
                      <span className="text-xs text-slate-500">
                        Graded with{" "}
                        {teachBackResult.source === "ai"
                          ? "AI"
                          : "offline matching"}
                      </span>
                    </div>
                    <div
                      className="mt-2 grid grid-cols-3 gap-1 text-center text-xs"
                      role="meter"
                      aria-label={`Teach-back: ${teachBackResult.score} out of 2`}
                      aria-valuemin={0}
                      aria-valuemax={2}
                      aria-valuenow={teachBackResult.score}
                    >
                      {(["Not yet", "Partly", "Got it"] as const).map(
                        (label, index) => (
                          <span
                            key={label}
                            className={`rounded-md px-2 py-1 ${index === teachBackResult.score ? "bg-violet-700 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}
                          >
                            {label}
                          </span>
                        ),
                      )}
                    </div>
                    <p className="mt-2 text-sm">{teachBackResult.feedback}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {teachBackResult.covered?.map((concept) => (
                        <span
                          key={concept}
                          className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                        >
                          ✓ {concept}
                        </span>
                      ))}
                      {teachBackResult.missing?.map((concept) => (
                        <span
                          key={concept}
                          className="rounded-full border border-dashed border-slate-400 px-2 py-1 text-xs text-slate-600 dark:text-slate-300"
                        >
                          {concept}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowModelAnswer((visible) => !visible)}
                      className="mt-3 text-xs font-medium text-violet-700 underline dark:text-violet-300"
                      aria-expanded={showModelAnswer}
                    >
                      {showModelAnswer
                        ? "Hide model answer"
                        : "Show model answer"}
                    </button>
                    {showModelAnswer && (
                      <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800">
                        {currentQuestion.explanation.whyCorrect}
                      </p>
                    )}
                  </section>
                )}
                <div
                  className={`rounded-xl p-3 ${isSelectionCorrect(currentQuestion, selectedAnswer) ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
                >
                  {isSelectionCorrect(currentQuestion, selectedAnswer)
                    ? "Correct — you matched the Azure concept."
                    : `Not quite — the correct answer is ${getCorrectAnswerDisplay(currentQuestion)}.`}
                </div>

                <div>
                  <p className="text-sm font-semibold">Summary</p>
                  <p className="mt-1 text-sm">
                    {currentQuestion.explanation.summary}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold">Why this is right</p>
                  <p className="mt-1 text-sm">
                    {currentQuestion.explanation.whyCorrect}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-semibold">
                    Why the distractors are wrong
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {Object.entries(currentQuestion.explanation.whyWrong).map(
                      ([key, value]) => (
                        <li
                          key={key}
                          className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800"
                        >
                          {value}
                        </li>
                      ),
                    )}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-semibold">Memory hook</p>
                  <p className="mt-1 text-sm">
                    {currentQuestion.explanation.memoryHook}
                  </p>
                </div>

                <div>
                  <span className="inline-flex rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-200">
                    {currentQuestion.explanation.docsTopic}
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="mb-3 flex flex-wrap gap-2">
                  {(["ELI5", "Analogy", "Deep Dive", "Exam Tip"] as const).map(
                    (mode) => (
                      <button
                        key={mode}
                        onClick={() => setAiMode(mode)}
                        className={`rounded-full px-2 py-1 text-xs ${aiMode === mode ? "bg-sky-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
                      >
                        {mode}
                      </button>
                    ),
                  )}
                </div>
                <textarea
                  value={aiFollowUp}
                  onChange={(event) => setAiFollowUp(event.target.value)}
                  maxLength={300}
                  placeholder="Optional follow-up"
                  className="h-20 w-full rounded-xl border border-slate-300 bg-transparent p-2"
                />
                {/* African Learning Lens Switcher */}
                <div className="my-3 p-3 bg-slate-900/60 rounded-xl border border-slate-700/80">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    🌍 African Learning Lens (AI Buddy)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {LENS_OPTIONS.map((lens) => (
                      <button
                        key={lens.id}
                        type="button"
                        onClick={() => setActiveLens(lens.id)}
                        className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all text-center ${
                          activeLens === lens.id
                            ? "bg-blue-600 text-white font-semibold shadow-md ring-1 ring-blue-400"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        <span>
                          {lens.icon} {lens.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleExplain}
                  className="mt-3 rounded-full bg-slate-900 px-3 py-2 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
                  disabled={aiLoading}
                >
                  {aiLoading ? "Generating…" : "Explain it differently"}
                </button>
                {aiResponse && (
                  <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
                    <p className="mb-1 font-semibold text-sky-700">
                      AI-generated, verify against Microsoft Learn
                    </p>
                    <p className="font-medium">{aiResponse.headline}</p>
                    <p className="mt-2">{aiResponse.explanation}</p>
                    {aiResponse.analogy && (
                      <p className="mt-2 italic">{aiResponse.analogy}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      {aiResponse.commonMistake}
                    </p>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
