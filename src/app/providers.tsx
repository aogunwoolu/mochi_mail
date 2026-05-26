"use client";

import { MochiProvider } from "@/context/MochiContext";
import MochiToastStack from "@/components/MochiToastStack";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MochiProvider>
      {children}
      <MochiToastStack />
    </MochiProvider>
  );
}
