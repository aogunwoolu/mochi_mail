"use client";

import { FiEdit3, FiMail, FiShoppingBag, FiUsers } from "react-icons/fi";
import type { AppTab } from "@/types";

interface AppHeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  unreadCount: number;
  onAccountClick: () => void;
  accountName: string;
  accountAvatarUrl: string;
  accountAccentColor: string | null;
  accountHydrated: boolean;
}

export function AppHeader({
  activeTab,
  onTabChange,
  unreadCount,
  onAccountClick,
  accountName,
  accountAvatarUrl,
  accountAccentColor,
  accountHydrated,
}: AppHeaderProps) {
  return (
    <header className="glass-strong shrink-0 px-4 py-3">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="h-9 w-9 rounded-xl bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/brand-mark.svg')" }}
          />
          <div>
            <h1 className="text-base font-bold leading-tight tracking-tight">MochiMail</h1>
            <p className="hidden text-[10px] tracking-widest sm:block" style={{ color: "var(--muted)" }}>
              DIGITAL STATIONERY
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav
          className="flex rounded-2xl p-1"
          style={{ background: "var(--surface)" }}
          aria-label="Main navigation"
        >
          {(
            [
              { id: "studio" as AppTab, label: "Canvas", icon: <FiEdit3 /> },
              { id: "mail" as AppTab, label: "Mail", icon: <FiMail /> },
              { id: "store" as AppTab, label: "Shop", icon: <FiShoppingBag /> },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="btn-smooth relative flex min-h-10 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{
                background: activeTab === tab.id ? "var(--surface-hover)" : "transparent",
                color: activeTab === tab.id ? "var(--foreground)" : "var(--muted)",
              }}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.id === "mail" && unreadCount > 0 && (
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                  style={{ background: "var(--pink)" }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Account */}
        <button
          onClick={onAccountClick}
          className="btn-smooth flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border-2"
          style={{
            borderColor: accountAccentColor ?? "var(--border)",
            background: accountAccentColor ? `${accountAccentColor}22` : "var(--surface)",
          }}
          title={accountHydrated ? accountName : "Account"}
          aria-label="Account"
        >
          <img
            src={accountAvatarUrl || `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(accountName || "mochimail")}`}
            alt={accountName}
            className="h-full w-full object-cover"
          />
        </button>
      </div>
    </header>
  );
}
