"use client";

import { use } from "react";
import { SpaceView } from "../page";

export default function SpaceUsernamePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  return <SpaceView requestedUser={username.trim().toLowerCase()} />;
}
