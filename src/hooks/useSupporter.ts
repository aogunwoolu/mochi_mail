import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isPlusActive, perksFor, type Perks, type SupporterRow, type PlusPlan } from "@/lib/plus";
import type { ViewerIdentity } from "@/types";

type ActionResult = { ok: boolean; needsAccount?: boolean; error?: string };

async function getAccessToken(): Promise<string | null> {
  const supabase = createSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function postBilling(path: string, payload: Record<string, unknown>): Promise<ActionResult & { url?: string }> {
  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false, error: "Please wait a moment and try again." };
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, accessToken }),
  });
  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as { needsAccount?: boolean };
    return { ok: false, needsAccount: body.needsAccount === true };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: body.error ?? "Something went wrong." };
  }
  const body = (await res.json()) as { url?: string };
  return { ok: true, url: body.url };
}

export function useSupporter(viewer: ViewerIdentity) {
  const accountId = viewer.accountId;
  const [row, setRow] = useState<SupporterRow | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!accountId) {
      setRow(null);
      setLoading(false);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("supporters")
      .select("*")
      .eq("user_id", accountId)
      .maybeSingle();
    setRow(data ?? null);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const isPlus = useMemo(() => isPlusActive(row), [row]);
  const perks: Perks = useMemo(() => perksFor(isPlus), [isPlus]);

  const startCheckout = useCallback(async (plan: PlusPlan): Promise<ActionResult> => {
    const result = await postBilling("/api/billing/checkout", { mode: "subscription", plan });
    if (result.ok && result.url) window.location.href = result.url;
    return result;
  }, []);

  const startTip = useCallback(async (amountCents: number): Promise<ActionResult> => {
    const result = await postBilling("/api/billing/checkout", {
      mode: "tip",
      amountCents,
      displayName: viewer.name,
    });
    if (result.ok && result.url) window.location.href = result.url;
    return result;
  }, [viewer.name]);

  const openPortal = useCallback(async (): Promise<ActionResult> => {
    const result = await postBilling("/api/billing/portal", {});
    if (result.ok && result.url) window.location.href = result.url;
    return result;
  }, []);

  const toggleBadge = useCallback(async () => {
    if (!accountId || !row) return;
    const next = !row.show_badge;
    setRow({ ...row, show_badge: next }); // optimistic
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("supporters")
      .update({ show_badge: next })
      .eq("user_id", accountId);
    if (error) {
      setRow({ ...row, show_badge: !next }); // revert on failure
      return;
    }
    // Keep the public render-only badge flag on the profile in sync (members own
    // their profile row, so this update is allowed by RLS).
    await supabase
      .from("profiles")
      .update({ is_supporter: next && isPlusActive(row) })
      .eq("id", accountId);
  }, [accountId, row]);

  return {
    isPlus,
    perks,
    status: row?.status ?? "none",
    plan: row?.plan ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    cancelAtPeriodEnd: row?.cancel_at_period_end ?? false,
    showBadge: row?.show_badge ?? true,
    loading,
    refresh,
    startCheckout,
    startTip,
    openPortal,
    toggleBadge,
  };
}
