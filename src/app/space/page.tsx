"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SpaceView } from "./SpaceView";

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
