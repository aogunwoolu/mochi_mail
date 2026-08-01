import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY as string | undefined;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST as string | undefined;
const isDev = process.env.NODE_ENV === "development";

export const TRACKING_PREF_KEY = "mochimail_tracking_enabled";

export function getTrackingEnabled(): boolean {
  try {
    const stored = localStorage.getItem(TRACKING_PREF_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function setTrackingEnabled(enabled: boolean) {
  try {
    localStorage.setItem(TRACKING_PREF_KEY, String(enabled));
  } catch {
    // ignore
  }
  if (!KEY) return;
  if (enabled) {
    posthog.opt_in_capturing();
  } else {
    posthog.opt_out_capturing();
  }
}

export function initPostHog() {
  if (!KEY || !HOST) return;
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: "identified_only",
    // Auto-capture SPA navigations (App Router) so pageviews + heatmaps get data.
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: true,
    // Persist across reloads so users/replays/funnels aren't fragmented.
    persistence: "localStorage+cookie",
    opt_out_capturing_by_default: !getTrackingEnabled(),
    // Automatic error tracking: unhandled exceptions + promise rejections.
    capture_exceptions: true,
    disable_session_recording: isDev,
    disable_surveys: true,
    enable_heatmaps: !isDev,
    loaded(ph) {
      if (isDev) ph.debug();
    },
  });
}

export function identifyUser(id: string, props?: Record<string, unknown>) {
  if (!KEY) return;
  posthog.identify(id, props);
}

export function resetUser() {
  if (!KEY) return;
  posthog.reset();
}

export function trackPageview(path: string) {
  if (!KEY) return;
  posthog.capture("$pageview", { $current_url: globalThis.location?.origin + path });
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!KEY) return;
  posthog.capture(event, props);
}

export function trackError(error: Error, context?: Record<string, unknown>) {
  if (!KEY) return;
  posthog.capture("$exception", {
    $exception_message: error.message,
    $exception_type: error.name,
    $exception_stack_trace_raw: error.stack,
    ...context,
  });
}

export default posthog;
