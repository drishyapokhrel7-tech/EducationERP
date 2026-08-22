import { apiClient, getRefreshToken, setAccessToken, setRefreshToken } from "./apiClient";

// Proactively refreshes ~2 minutes before the access token actually
// expires, rather than waiting for a request to fail with a 401 —
// this is an unattended station, so there's no user around to notice
// and retry a stuck screen. The refresh endpoint rotates on every use
// (the old refresh token is revoked, a new one issued), which is
// unsafe to call concurrently with itself — confirmed directly
// against the real auth service before writing this: two overlapping
// /auth/refresh calls with the same token can race, and the loser
// gets "invalid or expired refresh token" even though it was valid
// when the call started. `inFlight` collapses any concurrent trigger
// (the timer firing at the same moment a request-driven check does,
// for instance) into the one real network call already in progress.
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

export class RefreshScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<boolean> | null = null;

  scheduleFrom(expiresInSeconds: number): void {
    this.clear();
    const delay = Math.max(0, expiresInSeconds * 1000 - REFRESH_MARGIN_MS);
    this.timer = setTimeout(() => {
      void this.refreshNow();
    }, delay);
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Resolves true once a valid session exists, false if the refresh token is missing/invalid. */
  async refreshNow(): Promise<boolean> {
    if (this.inFlight) return this.inFlight;
    const token = getRefreshToken();
    if (!token) return false;
    this.inFlight = this.doRefresh(token).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async doRefresh(token: string): Promise<boolean> {
    try {
      const result = await apiClient.refresh(token);
      setAccessToken(result.accessToken);
      setRefreshToken(result.refreshToken);
      this.scheduleFrom(result.expiresIn);
      return true;
    } catch {
      setAccessToken(null);
      setRefreshToken(null);
      return false;
    }
  }
}
