"use client";

import React, { useState } from "react";
import {
  FiEdit3,
  FiMail,
  FiShoppingBag,
  FiUsers,
  FiEye,
  FiEyeOff,
  FiArrowUp,
  FiArrowDown,
  FiTrash2,
  FiX,
  FiCopy,
  FiCheck,
  FiLock,
  FiGlobe,
  FiSettings,
  FiSend,
  FiRotateCcw,
  FiRotateCw,
} from "react-icons/fi";
import {
  Pencil,
  Eraser,
  MousePointer,
  Type,
  Scissors,
  Image as ImageIcon,
  Sparkles,
  Search,
  Heart,
  Download,
  Check,
  Zap,
  Plane,
  Clock,
  Plus,
} from "lucide-react";

export type HandDrawnIconName =
  | "pen"
  | "eraser"
  | "select"
  | "text"
  | "assets"
  | "washi"
  | "animated"
  | "undo"
  | "redo"
  | "export"
  | "clear"
  | "canvas"
  | "mail"
  | "shop"
  | "rooms"
  | "account"
  | "layers"
  | "eye-open"
  | "eye-closed"
  | "arrow-up"
  | "arrow-down"
  | "trash"
  | "compose"
  | "envelope"
  | "stamp"
  | "paper"
  | "speed-express"
  | "speed-standard"
  | "speed-snail"
  | "send"
  | "search"
  | "heart"
  | "heart-outline"
  | "download"
  | "check"
  | "publish"
  | "close"
  | "copy"
  | "lock"
  | "globe"
  | "settings"
  | "plus";

interface HandDrawnIconProps {
  name: HandDrawnIconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
  color?: string;
  fallback?: React.ReactNode;
}

/**
 * Built-in default fallback SVG icons when custom hand-drawn PNGs haven't
 * been dropped into /public/icons/handdrawn/${name}.png yet.
 */
function DefaultFallback({
  name,
  size = 20,
  color,
}: {
  name: HandDrawnIconName;
  size: number;
  color?: string;
}) {
  const iconProps = { size, color, style: color ? { color } : undefined };

  switch (name) {
    case "pen":
      return <Pencil {...iconProps} />;
    case "eraser":
      return <Eraser {...iconProps} />;
    case "select":
      return <MousePointer {...iconProps} />;
    case "text":
      return <Type {...iconProps} />;
    case "assets":
      return <ImageIcon {...iconProps} />;
    case "washi":
      return <Scissors {...iconProps} />;
    case "animated":
      return <Sparkles {...iconProps} />;
    case "undo":
      return <FiRotateCcw {...iconProps} />;
    case "redo":
      return <FiRotateCw {...iconProps} />;
    case "export":
      return <Download {...iconProps} />;
    case "clear":
      return <FiTrash2 {...iconProps} />;
    case "canvas":
      return <FiEdit3 {...iconProps} />;
    case "mail":
      return <FiMail {...iconProps} />;
    case "shop":
      return <FiShoppingBag {...iconProps} />;
    case "rooms":
      return <FiUsers {...iconProps} />;
    case "layers":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
      );
    case "eye-open":
      return <FiEye {...iconProps} />;
    case "eye-closed":
      return <FiEyeOff {...iconProps} />;
    case "arrow-up":
      return <FiArrowUp {...iconProps} />;
    case "arrow-down":
      return <FiArrowDown {...iconProps} />;
    case "trash":
      return <FiTrash2 {...iconProps} />;
    case "compose":
      return <FiEdit3 {...iconProps} />;
    case "envelope":
      return <FiMail {...iconProps} />;
    case "stamp":
      return <span style={{ fontSize: size * 0.9 }}>💌</span>;
    case "paper":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case "speed-express":
      return <Zap {...iconProps} />;
    case "speed-standard":
      return <Plane {...iconProps} />;
    case "speed-snail":
      return <Clock {...iconProps} />;
    case "send":
      return <FiSend {...iconProps} />;
    case "search":
      return <Search {...iconProps} />;
    case "heart":
      return <Heart {...iconProps} fill="currentColor" />;
    case "heart-outline":
      return <Heart {...iconProps} />;
    case "download":
      return <Download {...iconProps} />;
    case "check":
      return <Check {...iconProps} />;
    case "publish":
    case "plus":
      return <Plus {...iconProps} />;
    case "close":
      return <FiX {...iconProps} />;
    case "copy":
      return <FiCopy {...iconProps} />;
    case "lock":
      return <FiLock {...iconProps} />;
    case "globe":
      return <FiGlobe {...iconProps} />;
    case "settings":
      return <FiSettings {...iconProps} />;
    default:
      return <Sparkles {...iconProps} />;
  }
}

/**
 * HandDrawnIcon renders a hand-drawn PNG from `/icons/handdrawn/[name].png`.
 * If the custom file does not exist or fails to load, it automatically falls
 * back to the standard vector icon with zero layout shift.
 *
 * To replace any icon:
 * Simply drop `[name].png` into `public/icons/handdrawn/`!
 */
export default function HandDrawnIcon({
  name,
  size = 22,
  className = "",
  style,
  alt,
  color,
  fallback,
}: Readonly<HandDrawnIconProps>) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    if (fallback !== undefined) return <>{fallback}</>;
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${className}`}
        style={{ width: size, height: size, ...style }}
      >
        <DefaultFallback name={name} size={size} color={color} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
        ...style,
      }}
    >
      <img
        src={`/icons/handdrawn/${name}.png`}
        alt={alt || `${name} icon`}
        width={size}
        height={size}
        onError={() => setHasError(true)}
        className="h-full w-full object-contain pointer-events-none select-none"
        style={{
          imageRendering: "auto",
        }}
        draggable={false}
      />
    </span>
  );
}
