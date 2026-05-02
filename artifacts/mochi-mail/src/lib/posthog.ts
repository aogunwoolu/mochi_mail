import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

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
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: "memory",
    opt_out_capturing_by_default: !getTrackingEnabled(),
    disable_session_recording: import.meta.env.DEV,
    disable_surveys: true,
    enable_heatmaps: !import.meta.env.DEV,
    loaded(ph) {
      if (import.meta.env.DEV) ph.debug();
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
