import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Guard against `javascript:`/`data:`/etc. hrefs in user-authored content
 *  (space links, music links) - only allow schemes that can't execute script
 *  when clicked. Returns "#" for anything else so the link is inert. */
export function sanitizeHref(url: string | undefined | null): string {
  if (!url) return "#";
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  // Bare domains/paths (no scheme) are safe to prefix - assume https.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return `https://${trimmed}`;
  return "#";
}

