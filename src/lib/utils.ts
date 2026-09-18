import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Turn a free-typed recipient name into the same slug shape profile
 *  usernames use (lowercase, `_` separated) so mail lookups match real
 *  accounts. Shared between the compose recipient validator and useMail's
 *  send path so they can never drift apart. */
export function usernameSlug(value: string): string {
  return value.trim().toLowerCase().replaceAll(/\s+/g, "_");
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

