"use client";

import { useRouter } from "next/navigation";
import { useMochi } from "@/context/MochiContext";
import { useSpaces } from "@/hooks/useSpaces";
import SpaceStudio from "@/components/SpaceStudio";
import { useState, useEffect } from "react";
import { parseSpaceConfig, bgToCss } from "@/lib/spaceConfig";

export function SpaceView({ requestedUser }: { requestedUser: string }) {
  const router = useRouter();
  // Use the app-wide account instance from MochiProvider. Calling useAccount()
  // here would spin up a second, parallel auth state — on a fresh visit both
  // instances raced signInAnonymously(), creating duplicate anonymous users.
  const { account } = useMochi();
  const spaces = useSpaces([], account.currentAccount, requestedUser || undefined);
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const isPreparingSpace = account.hydrated && account.isAuthenticated && !account.currentAccount;

  const selectedSpace = spaces.spaces.find((s) => s.id === selectedSpaceId)
    ?? spaces.ownSpace
    ?? spaces.spaces[0]
    ?? null;

  useEffect(() => {
    if (!requestedUser || spaces.spaces.length === 0) return;
    const match = spaces.spaces.find((space) =>
      space.slug.toLowerCase() === requestedUser ||
      space.ownerName.toLowerCase() === requestedUser
    );
    if (match && selectedSpaceId !== match.id) {
      setSelectedSpaceId(match.id);
    }
  }, [requestedUser, spaces.spaces, selectedSpaceId]);

  useEffect(() => {
    if (!requestedUser && account.hydrated && !account.hasSession) {
      router.push("/");
    }
  }, [requestedUser, account.hydrated, account.hasSession, router]);

  if (!account.hydrated || isPreparingSpace) {
    return (
      <div className="flex h-svh items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="panel animate-fade-in flex flex-col items-center rounded-3xl px-8 py-6 text-center">
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="var(--pink)" strokeWidth="2.5" strokeDasharray="28 56" strokeLinecap="round" />
          </svg>
          <p className="mt-3 text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            Opening your space...
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            We&apos;re loading your profile and arranging your page.
          </p>
        </div>
      </div>
    );
  }

  if (!requestedUser && !account.hasSession) return null;

  const cfg = parseSpaceConfig(selectedSpace?.wallpaper ?? account.viewer.wallpaper);
  const pageBg = bgToCss(cfg.bg);
  const pageAccent = cfg.lineColor || selectedSpace?.accentColor || account.viewer.accentColor || "#ff6b9d";

  return (
    <div
      className="flex h-svh flex-col overflow-hidden"
      style={{ background: pageBg, "--pink": pageAccent, "--accent": pageAccent } as React.CSSProperties}
    >
      <div className="flex-1 overflow-hidden">
        <SpaceStudio
          viewer={account.viewer}
          isAuthenticated={account.isAuthenticated}
          loading={spaces.loading}
          requestedUsername={requestedUser || undefined}
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
          onNavigateBack={() => router.push("/")}
        />
      </div>
    </div>
  );
}
