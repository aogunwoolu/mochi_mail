import { useState } from "react";
import { useMochi } from "@/context/MochiContext";
import { PLUS_PRICING, TIP_AMOUNTS_CENTS, type PlusPlan } from "@/lib/plus";
import { toast } from "@/lib/toast";

function Card({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div
      className="rounded-2xl border p-3"
      style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.7)" }}
    >
      {children}
    </div>
  );
}

/** Gentle inline "save your account" step shown only when an anonymous user tries
 *  to subscribe — so Plus perks bind to a durable, recoverable identity. */
function SaveAccountStep({ onSaved, busy }: Readonly<{ onSaved: (i: { email: string; password: string; displayName: string }) => void; busy: boolean }>) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { account } = useMochi();
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Before you support us 🌸</p>
      <p className="text-xs leading-relaxed" style={{ color: "var(--muted-strong)" }}>
        Save your account so your membership follows you across devices. Everything you&apos;ve made stays exactly as it is.
      </p>
      <div>
        <label htmlFor="support-email" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Email</label>
        <input id="support-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="✉️ you@example.com" className="input-soft w-full px-3 py-2 text-sm outline-none" autoComplete="email" />
      </div>
      <div>
        <label htmlFor="support-password" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Password</label>
        <input id="support-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="🔒 ••••••••" className="input-soft w-full px-3 py-2 text-sm outline-none" autoComplete="new-password" />
      </div>
      <button
        onClick={() => onSaved({ email, password, displayName: account.viewer.name })}
        disabled={busy || !email.trim() || !password.trim()}
        className="btn-smooth w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
        style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))", opacity: busy ? 0.7 : 1 }}
      >
        {busy ? "Saving…" : "Save & continue to checkout"}
      </button>
    </div>
  );
}

export default function SupportMochiPanel() {
  const { supporter, account } = useMochi();
  const [plan, setPlan] = useState<PlusPlan>("yearly");
  const [busy, setBusy] = useState(false);
  const [needsAccount, setNeedsAccount] = useState(false);

  const runCheckout = async () => {
    setBusy(true);
    const result = await supporter.startCheckout(plan);
    setBusy(false);
    if (result.needsAccount) {
      setNeedsAccount(true);
      return;
    }
    if (!result.ok && result.error) toast(result.error, { variant: "error", icon: "warning" });
    // On success the browser redirects to Stripe Checkout.
  };

  const handleSaveAndCheckout = async (input: { email: string; password: string; displayName: string }) => {
    setBusy(true);
    const saved = await account.saveAccount(input);
    if (!saved.ok) {
      setBusy(false);
      toast(saved.error ?? "Couldn't save your account.", { variant: "error", icon: "warning" });
      return;
    }
    toast("Account saved! ✨", { icon: "star" });
    const result = await supporter.startCheckout(plan);
    setBusy(false);
    if (!result.ok && result.error) toast(result.error, { variant: "error", icon: "warning" });
  };

  const handleTip = async (amountCents: number) => {
    setBusy(true);
    const result = await supporter.startTip(amountCents);
    setBusy(false);
    if (!result.ok && result.error) toast(result.error, { variant: "error", icon: "warning" });
  };

  const handlePortal = async () => {
    setBusy(true);
    const result = await supporter.openPortal();
    setBusy(false);
    if (!result.ok && result.error) toast(result.error, { variant: "error", icon: "warning" });
  };

  // ── Member view ─────────────────────────────────────────────────────────────
  if (supporter.isPlus) {
    const renews = supporter.currentPeriodEnd
      ? new Date(supporter.currentPeriodEnd).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
      : null;
    return (
      <Card>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>♡ Mochi Plus</p>
        <p className="mt-1 text-sm font-semibold">Thank you for keeping Mochi cozy 🍵</p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted-strong)" }}>
          {supporter.cancelAtPeriodEnd && renews
            ? `Your membership ends on ${renews}. You'll keep your perks until then.`
            : renews
            ? `${supporter.plan === "yearly" ? "Yearly" : "Monthly"} member · renews ${renews}`
            : "You're a member."}
        </p>

        <label className="mt-3 flex items-center justify-between rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface)" }}>
          <span style={{ color: "var(--foreground-soft)" }}>Show my ♡ supporter badge</span>
          <button
            onClick={() => void supporter.toggleBadge()}
            role="switch"
            aria-checked={supporter.showBadge}
            aria-label="Toggle supporter badge"
            className="btn-smooth shrink-0"
          >
            <div className="relative h-5 w-9 rounded-full transition-colors duration-200" style={{ background: supporter.showBadge ? "var(--pink)" : "rgba(180,170,195,0.45)" }}>
              <div className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200" style={{ transform: supporter.showBadge ? "translateX(1.125rem)" : "translateX(0.125rem)" }} />
            </div>
          </button>
        </label>

        <button
          onClick={() => void handlePortal()}
          disabled={busy}
          className="btn-smooth mt-2 w-full rounded-xl px-3 py-2 text-xs font-semibold"
          style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}
        >
          Manage membership
        </button>
      </Card>
    );
  }

  // ── Non-member view ───────────────────────────────────────────────────────────
  return (
    <Card>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>♡ Support Mochi</p>

      {needsAccount ? (
        <div className="mt-2">
          <SaveAccountStep busy={busy} onSaved={(i) => void handleSaveAndCheckout(i)} />
          <button className="mt-2 w-full text-center text-[10px]" style={{ color: "var(--muted)" }} onClick={() => setNeedsAccount(false)}>
            ← back
          </button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-strong)" }}>
            Mochi is free and always will be. If it brings you a little joy, you can chip in to keep it that way 💛
          </p>

          {/* Membership */}
          <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.6)" }}>
            <p className="text-sm font-semibold">Become a member</p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted-strong)" }}>
              A ♡ badge, seasonal packs, extra customization & a little more studio room.
            </p>
            <div className="mt-2 flex gap-1 rounded-2xl p-1" style={{ background: "var(--surface)" }}>
              {(Object.keys(PLUS_PRICING) as PlusPlan[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlan(p)}
                  className="btn-smooth flex-1 rounded-xl py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    background: plan === p ? "white" : "transparent",
                    color: plan === p ? "var(--foreground)" : "var(--muted)",
                    boxShadow: plan === p ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                  }}
                >
                  {PLUS_PRICING[p].label}
                  {"note" in PLUS_PRICING[p] ? <span className="ml-1 text-[9px]" style={{ color: "var(--pink)" }}>{(PLUS_PRICING[p] as { note?: string }).note}</span> : null}
                </button>
              ))}
            </div>
            <button
              onClick={() => void runCheckout()}
              disabled={busy}
              className="btn-smooth btn-ripple mt-2 w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))", opacity: busy ? 0.7 : 1 }}
            >
              {busy ? "One moment…" : "Become a member"}
            </button>
          </div>

          {/* Tip */}
          <div className="mt-2 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.6)" }}>
            <p className="text-sm font-semibold">Or buy us a tea 🍵</p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted-strong)" }}>A one-time thank-you — no account needed.</p>
            <div className="mt-2 flex gap-2">
              {TIP_AMOUNTS_CENTS.map((cents) => (
                <button
                  key={cents}
                  onClick={() => void handleTip(cents)}
                  disabled={busy}
                  className="btn-smooth flex-1 rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}
                >
                  ${(cents / 100).toFixed(0)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
