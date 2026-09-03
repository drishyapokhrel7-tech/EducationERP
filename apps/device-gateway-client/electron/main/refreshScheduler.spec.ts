import { RefreshScheduler } from "./refreshScheduler";
import { apiClient, getRefreshToken, setAccessToken, setRefreshToken } from "./apiClient";

// ./apiClient touches real Electron modules (app, safeStorage) that
// don't exist outside a running Electron process — mocked entirely so
// this test exercises only RefreshScheduler's own scheduling/
// single-flight logic, matching exam-client's retryQueue.spec.ts and
// cctv-client's refreshScheduler.spec.ts pattern of testing the pure
// logic in isolation.
jest.mock("./apiClient", () => ({
  apiClient: { refresh: jest.fn() },
  getRefreshToken: jest.fn(),
  setAccessToken: jest.fn(),
  setRefreshToken: jest.fn(),
}));

const mockedRefresh = apiClient.refresh as jest.Mock;
const mockedGetRefreshToken = getRefreshToken as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});
afterEach(() => jest.useRealTimers());

describe("RefreshScheduler.scheduleFrom", () => {
  it("proactively refreshes ~2 minutes before the access token actually expires", async () => {
    mockedGetRefreshToken.mockReturnValue("old-refresh-token");
    mockedRefresh.mockResolvedValue({ accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 900 });

    const scheduler = new RefreshScheduler();
    scheduler.scheduleFrom(900); // 15 min TTL

    await jest.advanceTimersByTimeAsync(779_000); // 1s short of the 13-min mark
    expect(mockedRefresh).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1_000); // crosses 780_000ms = 13min
    expect(mockedRefresh).toHaveBeenCalledWith("old-refresh-token");
    expect(setAccessToken).toHaveBeenCalledWith("new-access");
    expect(setRefreshToken).toHaveBeenCalledWith("new-refresh");
  });

  it("reschedules itself from the new expiry after a successful refresh", async () => {
    mockedGetRefreshToken.mockReturnValue("token-1");
    mockedRefresh.mockResolvedValueOnce({ accessToken: "a1", refreshToken: "token-2", expiresIn: 900 });
    mockedRefresh.mockResolvedValueOnce({ accessToken: "a2", refreshToken: "token-3", expiresIn: 900 });

    const scheduler = new RefreshScheduler();
    scheduler.scheduleFrom(900);
    await jest.advanceTimersByTimeAsync(780_000);
    expect(mockedRefresh).toHaveBeenCalledTimes(1);

    mockedGetRefreshToken.mockReturnValue("token-2");
    await jest.advanceTimersByTimeAsync(780_000);
    expect(mockedRefresh).toHaveBeenCalledTimes(2);
    expect(mockedRefresh).toHaveBeenLastCalledWith("token-2");
  });
});

describe("RefreshScheduler.refreshNow", () => {
  it("collapses concurrent calls into a single network request — the rotate-on-use race this guards against", async () => {
    mockedGetRefreshToken.mockReturnValue("token");
    let resolveRefresh!: (v: { accessToken: string; refreshToken: string; expiresIn: number }) => void;
    mockedRefresh.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const scheduler = new RefreshScheduler();
    const first = scheduler.refreshNow();
    const second = scheduler.refreshNow();
    expect(mockedRefresh).toHaveBeenCalledTimes(1);

    resolveRefresh({ accessToken: "a", refreshToken: "r", expiresIn: 900 });
    expect(await first).toBe(true);
    expect(await second).toBe(true);
  });

  it("clears tokens and returns false when the refresh token is rejected", async () => {
    mockedGetRefreshToken.mockReturnValue("bad-token");
    mockedRefresh.mockRejectedValue(new Error("invalid or expired refresh token"));

    const scheduler = new RefreshScheduler();
    const ok = await scheduler.refreshNow();

    expect(ok).toBe(false);
    expect(setAccessToken).toHaveBeenCalledWith(null);
    expect(setRefreshToken).toHaveBeenCalledWith(null);
  });

  it("returns false without calling the API when there is no refresh token to use", async () => {
    mockedGetRefreshToken.mockReturnValue(null);
    const scheduler = new RefreshScheduler();
    const ok = await scheduler.refreshNow();
    expect(ok).toBe(false);
    expect(mockedRefresh).not.toHaveBeenCalled();
  });
});
