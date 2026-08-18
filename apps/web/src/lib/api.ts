import { createApiClient } from "@education-erp/api-client";
import { getAccessToken } from "./auth-storage";

export const api = createApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  getAccessToken,
});
