import { redirect } from "next/navigation";

export default async function SpaceByUsernamePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  redirect(`/space?u=${encodeURIComponent(username)}`);
}
