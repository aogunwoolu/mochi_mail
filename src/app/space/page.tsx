"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "@/hooks/useAccount";
import { useSpaces } from "@/hooks/useSpaces";
import SpaceStudio from "@/components/SpaceStudio";
import { useState, useEffect, Suspense } from "react";
import { parseSpaceConfig, bgToCss } from "@/lib/spaceConfig";

function SpaceView({ requestedUser }: { requestedUser: string }) {
  const router = useRouter();
  const account = useAccount();
  const spaces = useSpaces(account.accounts, account.currentAccount, requestedUser || undefined);
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
      <div className="flex h-svh items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="panel rounded-3xl px-6 py-5 text-center">
          <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Opening your space...
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
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

function SpacePageInner() {
  const searchParams = useSearchParams();
  const requestedUser = searchParams?.get("u")?.trim().toLowerCase() ?? "";
  return <SpaceView requestedUser={requestedUser} />;
}

export default function SpacePage() {
  return (
    <Suspense>
      <SpacePageInner />
    </Suspense>
  );
}
