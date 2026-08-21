import type { ExamClientApi } from "./types";

declare global {
  interface Window {
    examClient: ExamClientApi;
  }
}
