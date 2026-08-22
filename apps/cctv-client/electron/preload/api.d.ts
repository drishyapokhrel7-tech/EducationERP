import type { CctvClientApi } from "./types";

declare global {
  interface Window {
    cctvClient: CctvClientApi;
  }
}
