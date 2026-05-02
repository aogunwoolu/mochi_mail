"use client";

import { MochiProvider } from "@/context/MochiContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <MochiProvider>{children}</MochiProvider>;
}
