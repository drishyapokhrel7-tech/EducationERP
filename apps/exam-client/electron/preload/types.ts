import type {
  LoginInput,
  SafeUser,
  MyExamAttempt,
  ExamTakingState,
  SaveAnswerInput,
  AnswerRecord,
  ExamAttemptRecord,
  CaptchaChallenge,
} from "@education-erp/api-client";
import type { SyncStatus } from "../main/retryQueue";

export type { SyncStatus };

export interface SyncStatusEvent {
  kind: "answer" | "submit";
  status: SyncStatus;
  questionId?: string;
}

// The single narrow, explicitly-allowlisted IPC surface the preload
// script exposes on window.examClient — exactly these six actions plus
// one status subscriber, nothing else. This file is plain types only
// (no `electron` import, no runtime code) so the renderer can import
// from it directly without pulling in preload/index.ts's contextBridge
// call into the renderer bundle.
export interface ExamClientApi {
  // No auth needed — fetched before login, same self-hosted CAPTCHA
  // every other login surface (the main web app, the platform admin
  // console) uses.
  getCaptcha: () => Promise<CaptchaChallenge>;
  login: (input: LoginInput) => Promise<SafeUser>;
  logout: () => Promise<void>;
  listExams: () => Promise<MyExamAttempt[]>;
  startExam: (examSubjectId: string) => Promise<ExamTakingState>;
  saveAnswer: (
    examSubjectId: string,
    questionId: string,
    input: SaveAnswerInput,
  ) => Promise<AnswerRecord | undefined>;
  submitExam: (examSubjectId: string) => Promise<ExamAttemptRecord | undefined>;
  onSyncStatus: (callback: (event: SyncStatusEvent) => void) => () => void;
}
