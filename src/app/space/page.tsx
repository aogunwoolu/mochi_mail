"use client";

import { useRouter } from "next/navigation";
import { useAccount } from "@/hooks/useAccount";
import { useSpaces } from "@/hooks/useSpaces";
import SpaceStudio from "@/components/SpaceStudio";
import { useState } from "react";

export default function SpacePage() {
  const router = useRouter();
  const account = useAccount();
  const spaces = useSpaces(account.accounts, account.currentAccount);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");

  // Redirect guests to home  they need an account for a space
  if (account.hydrated && !account.isAuthenticated) {
    router.replace("/");
    return null;
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden"
      style={{ background: account.viewer.wallpaper || "var(--bg)" }}
    >
      {/* Header bar */}
      <header
        className="flex shrink-0 items-center gap-3 px-4 py-3 backdrop-blur-md"
        style={{ borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.55)" }}
      >
        <button
          onClick={() => router.push("/")}
          className="btn-smooth flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium"
          style={{ color: "var(--muted-strong)", background: "var(--surface-active)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to Studio
        </button>
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          {account.viewer.name}&apos;s Space
        </span>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden p-4">
        <SpaceStudio
          viewer={account.viewer}
          isAuthenticated={account.isAuthenticated}
          spaces={spaces.spaces}
          ownSpace={spaces.ownSpace}
          selectedSpaceId={selectedSpaceId}
          onSelectSpace={setSelectedSpaceId}
          onRequireAccount={() => router.push("/")}
          onUpdateOwnSpace={spaces.updateOwnSpace}
          onAddItemToOwnSpace={spaces.addItemToOwnSpace}
          onUpdateSpaceItem={spaces.updateSpaceItem}
          onRemoveSpaceItem={spaces.removeSpaceItem}
          onLeaveVisitorNote={spaces.leaveVisitorNote}
        />
      </div>
    </div>
  );
}
