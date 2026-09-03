import useSWR from "swr";
import { api } from "@/lib/api";

// Extracted from dashboard/students/page.tsx's own original inline
// `useSWR("edition-status", () => api.getEditionStatus())` — now used
// by every FeatureLock-wrapped page plus the profile popover's tier
// badge, not just Students, so every caller shares one SWR cache entry
// under the same key instead of each page re-fetching independently.
export function useEditionStatus() {
  return useSWR("edition-status", () => api.getEditionStatus());
}
