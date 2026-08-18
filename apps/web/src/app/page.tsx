"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  // See dashboard/layout.tsx: post-hydration flag, not a state-in-effect read.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted) {
      router.replace(user ? "/dashboard" : "/login");
    }
  }, [mounted, user, router]);

  return null;
}
