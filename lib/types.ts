export type Domain = 'cloud-concepts' | 'architecture-services' | 'management-governance';
export type Difficulty = 1 | 2 | 3;
export type QType = 'single' | 'multi' | 'yes-no-statements';
export type Mode = 'practice' | 'exam' | 'remediation';
export type TeachBackScore = 0 | 1 | 2;
export type TeachBackSource = 'ai' | 'fallback';

export interface TeachBackResult {
  text: string;
  score: TeachBackScore;
  feedback: string;
  source: TeachBackSource;
  covered?: string[];
  missing?: string[];
}

export interface ConfusionPair {
  id: string;
  a: { name: string; oneLiner: string };
  b: { name: string; oneLiner: string };
  comparison: { dimension: string; a: string; b: string }[];
  ruleOfThumb: string;
  drillQuestionIds: string[];
}

export interface PairDrillResult {
  correct: number;
  total: number;
  completedAt: number;
  beforeAccuracy: number;
  afterAccuracy: number;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  domain: Domain;
  subtopic: string;
  difficulty: Difficulty;
  type: QType;
  stem: string;
  options: QuestionOption[];
  correct: string[];
  explanation: {
    summary: string;
    whyCorrect: string;
    whyWrong: Record<string, string>;
    memoryHook: string;
    docsTopic: string;
    keyConcepts: string[];
    keyConceptSynonyms?: Record<string, string[]>;
  };
  tags: string[];
  pairId?: string;
}

export interface Attempt {
  qid: string;
  chosen: string[];
  correct: boolean;
  ms: number;
  ts: number;
  mode: Mode;
  ratingBefore: number;
  ratingAfter: number;
  pairId?: string;
  teachBack?: TeachBackResult;
}

export type QuestionInput = Omit<Question, 'explanation' | 'pairId'> & {
  pairId?: string;
  explanation: Omit<Question['explanation'], 'keyConcepts'> & {
    keyConcepts?: string[];
  };
};

export interface BookmarkState {
  [qid: string]: boolean;
}

export interface ProgressState {
  attempts: Attempt[];
  bookmarks: BookmarkState;
  sessions: Record<string, unknown> & {
    pairDrills?: Record<string, PairDrillResult>;
    demo?: { enabled: boolean; startingRating: number };
  };
}

export interface ExplainRequest {
  mode: 'ELI5' | 'Analogy' | 'Deep Dive' | 'Exam Tip';
  question: Question;
  chosenAnswer?: string[];
  followUp?: string;
}

export interface ExplainResponse {
  mode: string;
  headline: string;
  explanation: string;
  analogy?: string;
  commonMistake: string;
  checkYourself: {
    question: string;
    answer: string;
  };
}
