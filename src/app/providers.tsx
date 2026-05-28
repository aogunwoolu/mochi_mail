"use client";

import { useEffect } from "react";
import { MochiProvider } from "@/context/MochiContext";
import MochiToastStack from "@/components/MochiToastStack";
import { initPostHog } from "@/lib/posthog";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <MochiProvider>
      {children}
      <MochiToastStack />
    </MochiProvider>
  );
}
