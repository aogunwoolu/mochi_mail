"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Minus, Undo, Trash2, Download, Upload, Edit3, AlertCircle, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import opentype from "opentype.js";

// Types
interface GlyphData {
  char: string;
  imageData: string;
  timestamp: number;
}

interface FontDraft {
  name: string;
  glyphs: Map<string, GlyphData>;
  glyphWidth: number;
  glyphHeight: number;
  lastSaved: number;
}

interface FontStudioProps {
  initialFont?: {
    id: string;
    name: string;
    glyphs: Record<string, string>;
    glyphWidth: number;
    glyphHeight: number;
  } | null;
  onSave: (name: string, glyphs: Record<string, string>, glyphWidth: number, glyphHeight: number) => void;
  onCancel?: () => void;
}

// Constants
const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?-:;()[]{}+/@#$%&*'\" ";

const CHAR_GROUPS = [
  { label: "A–Z", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", description: "Uppercase letters" },
  { label: "a–z", chars: "abcdefghijklmnopqrstuvwxyz", description: "Lowercase letters" },
  { label: "0–9", chars: "0123456789", description: "Numbers" },
  { label: "Symbols", chars: ".,!?-:;()[]{}+/@#$%&*'\" ", description: "Punctuation & symbols" },
] as const;

const DEFAULT_GW = 104;
const DEFAULT_GH = 128;

const INK_COLORS = [
  "#1e1b2e", "#ff6b9d", "#a78bfa", "#67d4f1", "#6ee7b7",
  "#fbbf24", "#fb923c", "#f87171", "#2563eb", "#374151",
];

// Similar character mappings for quick-fill
const SIMILAR_CHARS: Record<string, string[]> = {
  "A": ["A", "4", "^"],
  "B": ["B", "8", "13"],
  "C": ["C", "c", "("],
  "D": ["D", "0", "O"],
  "E": ["E", "3", "F"],
  "F": ["F", "E", "f"],
  "G": ["G", "6", "9"],
  "H": ["H", "#", "I"],
  "I": ["I", "1", "l", "|"],
  "J": ["J", "j", "7"],
  "K": ["K", "k", "X"],
  "L": ["L", "l", "1", "7"],
  "M": ["M", "m", "W", "w"],
  "N": ["N", "n", "V", "v"],
  "O": ["O", "o", "0", "Q"],
  "P": ["P", "p", "q"],
  "Q": ["Q", "O", "0"],
  "R": ["R", "r", "B"],
  "S": ["S", "s", "5", "$"],
  "T": ["T", "t", "7", "+"],
  "U": ["U", "u", "V", "v"],
  "V": ["V", "v", "U", "u"],
  "W": ["W", "w", "M", "m"],
  "X": ["X", "x", "K", "k"],
  "Y": ["Y", "y", "V", "v"],
  "Z": ["Z", "z", "2", "7"],
  "a": ["a", "o", "@"],
  "b": ["b", "d", "6", "q"],
  "c": ["c", "C", "("],
  "d": ["d", "b", "p", "q"],
  "e": ["e", "o", "0"],
  "f": ["f", "F", "t"],
  "g": ["g", "9", "q"],
  "h": ["h", "n", "b"],
  "i": ["i", "1", "l", "|", "!"],
  "j": ["j", "i", "1"],
  "k": ["k", "K", "x"],
  "l": ["l", "1", "I", "|", "i"],
  "m": ["m", "n", "w"],
  "n": ["n", "u", "h"],
  "o": ["o", "0", "O", "e"],
  "p": ["p", "b", "d", "q"],
  "q": ["q", "p", "b", "d", "9"],
  "r": ["r", "n", "v"],
  "s": ["s", "S", "5"],
  "t": ["t", "T", "+"],
  "u": ["u", "n", "v"],
  "v": ["v", "u", "r"],
  "w": ["w", "m", "W"],
  "x": ["x", "X", "*"],
  "y": ["y", "g", "q"],
  "z": ["z", "Z", "2"],
  "0": ["0", "O", "o"],
  "1": ["1", "I", "l", "|"],
  "2": ["2", "Z", "z"],
  "3": ["3", "E", "B"],
  "4": ["4", "A", "11"],
  "5": ["5", "S", "s"],
  "6": ["6", "b", "G"],
  "7": ["7", "T", "L", "1"],
  "8": ["8", "B", "S"],
  "9": ["9", "g", "q"],
};

// Utility functions
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const canvasToImageData = (canvas: HTMLCanvasElement): string => {
  return canvas.toDataURL("image/png");
};

const imageDataToCanvas = async (imageData: string, canvas: HTMLCanvasElement): Promise<void> => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = await loadImage(imageData);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
};

// Generate similar glyph from reference using canvas transforms
const generateSimilarGlyph = async (
  referenceData: string,
  targetChar: string,
  canvas: HTMLCanvasElement
): Promise<string | null> => {
  try {
    const refImg = await loadImage(referenceData);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Slight random transformations to create variation
    const scaleX = 0.95 + Math.random() * 0.1;
    const scaleY = 0.98 + Math.random() * 0.04;
    const translateY = (Math.random() - 0.5) * 2;
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2 + translateY);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    ctx.drawImage(refImg, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    
    return canvasToImageData(canvas);
  } catch {
    return null;
  }
};

// Draw guide lines on canvas
const drawGuide = (ctx: CanvasRenderingContext2D, char: string, width: number, height: number) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fdfcff";
  ctx.fillRect(0, 0, width, height);

  const cap = height * 0.13;
  const xh = height * 0.40;
  const base = height * 0.74;
  const desc = height * 0.89;

  // x-height zone
  ctx.fillStyle = "rgba(209,196,233,0.13)";
  ctx.fillRect(2, cap, width - 4, base - cap);

  // Guide lines
  const lines: [number, string, number, number[]][] = [
    [cap, "rgba(167,139,250,0.30)", 0.5, [3, 4]],
    [xh, "rgba(167,139,250,0.22)", 0.5, [3, 4]],
    [base, "rgba(167,139,250,0.60)", 0.75, []],
    [desc, "rgba(167,139,250,0.18)", 0.5, [3, 4]],
  ];
  
  for (const [y, color, lw, dash] of lines) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(4, y);
    ctx.lineTo(width - 4, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Border
  ctx.strokeStyle = "rgba(167,139,250,0.18)";
  ctx.lineWidth = 0.75;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // Reference character
  ctx.save();
  ctx.font = `700 ${Math.floor(height * 0.4)}px "Space Mono", monospace`;
  ctx.fillStyle = "rgba(167,139,250,0.12)";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(char === " " ? "·" : char, width / 2, base);
  ctx.restore();
};

// Import TTF/OTF font and render glyphs
const importFontFile = async (
  file: File,
  targetChars: string,
  glyphWidth: number,
  glyphHeight: number
): Promise<Record<string, string> | null> => {
  try {
    const buffer = await file.arrayBuffer();
    const font = opentype.parse(buffer);
    
    if (!font) {
      throw new Error("Failed to parse font");
    }

    const glyphs: Record<string, string> = {};
    const canvas = document.createElement("canvas");
    canvas.width = glyphWidth;
    canvas.height = glyphHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    for (const char of targetChars) {
      ctx.fillStyle = "#fdfcff";
      ctx.fillRect(0, 0, glyphWidth, glyphHeight);
      
      // Get font metrics
      const fontSize = glyphHeight * 0.7;
      const scale = fontSize / font.unitsPerEm;
      
      // Center the glyph
      const glyph = font.charToGlyph(char);
      const advanceWidth = glyph.advanceWidth ?? glyphWidth;
      const x = (glyphWidth - advanceWidth * scale) / 2;
      const y = glyphHeight * 0.74; // baseline
      
      // Draw the glyph
      const path = glyph.getPath(x, y, fontSize);
      path.draw(ctx);
      
      glyphs[char] = canvas.toDataURL("image/png");
    }

    return glyphs;
  } catch (error) {
    console.error("Font import error:", error);
    return null;
  }
};

// Main component
export default function FontStudio({ initialFont, onSave, onCancel }: FontStudioProps) {
  // State
  const [fontName, setFontName] = useState(initialFont?.name ?? "My Hand Font");
  const [charIndex, setCharIndex] = useState(0);
  const [glyphs, setGlyphs] = useState<Map<string, GlyphData>>(() => {
    if (initialFont?.glyphs) {
      const map = new Map<string, GlyphData>();
      Object.entries(initialFont.glyphs).forEach(([char, imageData]) => {
        map.set(char, { char, imageData, timestamp: Date.now() });
      });
      return map;
    }
    return new Map<string, GlyphData>();
  });
  const [activeGroup, setActiveGroup] = useState(0);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [inkColor, setInkColor] = useState("#1e1b2e");
  const [lineWidth, setLineWidth] = useState(4);
  const [previewText, setPreviewText] = useState("Hello World!");
  const [glyphWidth, setGlyphWidth] = useState(initialFont?.glyphWidth ?? DEFAULT_GW);
  const [glyphHeight, setGlyphHeight] = useState(initialFont?.glyphHeight ?? DEFAULT_GH);
  
  // Dialog states
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showQuickFillDialog, setShowQuickFillDialog] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  
  // Draft auto-save
  const [lastDraftSave, setLastDraftSave] = useState<number>(Date.now());
  const [showDraftNotice, setShowDraftNotice] = useState(false);

  // Refs
  const drawRef = useRef<HTMLCanvasElement>(null);
  const guideRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const strokeHistory = useRef<ImageData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentChar = CHARSET[charIndex] ?? "A";
  const totalChars = CHARSET.length;
  const doneCount = glyphs.size;
  const progressPct = Math.round((doneCount / totalChars) * 100);

  // Derived state
  const groupCharIndex = useMemo(() => {
    const chars = CHAR_GROUPS[activeGroup]?.chars ?? "";
    return chars.split("").findIndex(c => c === currentChar);
  }, [activeGroup, currentChar]);

  // Load current glyph when character changes
  useEffect(() => {
    const canvas = drawRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, glyphWidth, glyphHeight);
    strokeHistory.current = [];
    
    const saved = glyphs.get(currentChar);
    if (saved?.imageData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, glyphWidth, glyphHeight);
      img.src = saved.imageData;
    }
  }, [charIndex, glyphs, glyphWidth, glyphHeight, currentChar]);

  // Update guide when character changes
  useEffect(() => {
    const g = guideRef.current;
    if (!g) return;
    const ctx = g.getContext("2d");
    if (!ctx) return;
    drawGuide(ctx, currentChar, glyphWidth, glyphHeight);
  }, [currentChar, glyphWidth, glyphHeight]);

  // Keep active group in sync with current character
  useEffect(() => {
    const char = CHARSET[charIndex];
    if (!char) return;
    const gIdx = CHAR_GROUPS.findIndex(g => g.chars.includes(char));
    if (gIdx >= 0) setActiveGroup(gIdx);
  }, [charIndex]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (glyphs.size > 0) {
        saveDraft();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [glyphs, fontName, glyphWidth, glyphHeight]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case "ArrowRight":
        case "Enter":
          e.preventDefault();
          navigateTo(charIndex + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          navigateTo(charIndex - 1);
          break;
        case "Backspace":
          e.preventDefault();
          clearCurrentGlyph();
          break;
        case "z":
        case "Z":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const snap = strokeHistory.current.pop();
            if (snap && drawRef.current) {
              drawRef.current.getContext("2d")?.putImageData(snap, 0, 0);
            }
          }
          break;
        case "e":
        case "E":
          if (!e.ctrlKey && !e.metaKey) {
            setTool("eraser");
          }
          break;
        case "p":
        case "P":
          setTool("pen");
          break;
        case "[":
          setLineWidth(w => Math.max(1, w - 1));
          break;
        case "]":
          setLineWidth(w => Math.min(14, w + 1));
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [charIndex, lineWidth]);

  // Helper functions
  const captureCurrentGlyph = useCallback((): string | null => {
    const canvas = drawRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  }, []);

  const navigateTo = useCallback((nextIdx: number) => {
    // Save current glyph before navigating
    const data = captureCurrentGlyph();
    if (data && data !== "data:image/png;base64,") {
      setGlyphs(prev => new Map(prev).set(currentChar, {
        char: currentChar,
        imageData: data,
        timestamp: Date.now()
      }));
    }
    
    setCharIndex(Math.max(0, Math.min(CHARSET.length - 1, nextIdx)));
  }, [captureCurrentGlyph, currentChar]);

  const clearCurrentGlyph = useCallback(() => {
    const canvas = drawRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, glyphWidth, glyphHeight);
    strokeHistory.current = [];
    setGlyphs(prev => {
      const next = new Map(prev);
      next.delete(currentChar);
      return next;
    });
  }, [currentChar, glyphWidth, glyphHeight]);

  const saveDraft = useCallback(() => {
    const draft: FontDraft = {
      name: fontName,
      glyphs: new Map(glyphs),
      glyphWidth,
      glyphHeight,
      lastSaved: Date.now()
    };
    
    try {
      localStorage.setItem("fontStudioDraft", JSON.stringify({
        ...draft,
        glyphs: Array.from(draft.glyphs.entries())
      }));
      setLastDraftSave(Date.now());
      setShowDraftNotice(true);
      setTimeout(() => setShowDraftNotice(false), 2000);
    } catch {
      // Storage might be full
    }
  }, [fontName, glyphs, glyphWidth, glyphHeight]);

  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem("fontStudioDraft");
      if (!saved) return;
      
      const parsed = JSON.parse(saved);
      if (parsed.glyphs) {
        setFontName(parsed.name ?? fontName);
        setGlyphWidth(parsed.glyphWidth ?? DEFAULT_GW);
        setGlyphHeight(parsed.glyphHeight ?? DEFAULT_GH);
        setGlyphs(new Map(parsed.glyphs));
      }
    } catch {
      // Invalid draft data
    }
  }, [fontName]);

  const handleQuickFill = useCallback(() => {
    const newGlyphs = new Map(glyphs);
    let filled = 0;
    
    // For each existing glyph, try to fill similar characters
    glyphs.forEach((glyphData, sourceChar) => {
      const similar = SIMILAR_CHARS[sourceChar] ?? [];
      
      for (const targetChar of similar) {
        if (targetChar === sourceChar) continue;
        if (newGlyphs.has(targetChar)) continue;
        if (!CHARSET.includes(targetChar)) continue;
        
        // Create a temporary canvas for generation
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = glyphWidth;
        tempCanvas.height = glyphHeight;
        
        // Generate similar glyph (async but we'll use the result)
        generateSimilarGlyph(glyphData.imageData, targetChar, tempCanvas).then(newData => {
          if (newData) {
            newGlyphs.set(targetChar, {
              char: targetChar,
              imageData: newData,
              timestamp: Date.now()
            });
            setGlyphs(new Map(newGlyphs));
          }
        });
        
        filled++;
      }
    });
    
    setShowQuickFillDialog(false);
    
    if (filled > 0) {
      setTimeout(() => saveDraft(), 100);
    }
  }, [glyphs, glyphWidth, glyphHeight, saveDraft]);

  const handleImportFont = useCallback(async (file: File) => {
    setIsImporting(true);
    setImportError(null);
    
    try {
      const imported = await importFontFile(file, CHARSET, glyphWidth, glyphHeight);
      
      if (imported) {
        const newGlyphs = new Map(glyphs);
        Object.entries(imported).forEach(([char, imageData]) => {
          newGlyphs.set(char, { char, imageData, timestamp: Date.now() });
        });
        setGlyphs(newGlyphs);
        setShowImportDialog(false);
        saveDraft();
      } else {
        setImportError("Failed to import font. Please try a different file.");
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }, [glyphs, glyphWidth, glyphHeight, saveDraft]);

  const handleFinalSave = useCallback(() => {
    // Save current glyph first
    const data = captureCurrentGlyph();
    const finalGlyphs = data && data !== "data:image/png;base64,"
      ? new Map(glyphs).set(currentChar, { char: currentChar, imageData: data, timestamp: Date.now() })
      : glyphs;

    if (finalGlyphs.size === 0) {
      return;
    }

    // Convert to record format
    const glyphRecord: Record<string, string> = {};
    finalGlyphs.forEach((data, char) => {
      glyphRecord[char] = data.imageData;
    });

    onSave(fontName.trim() || "My Hand Font", glyphRecord, glyphWidth, glyphHeight);
    
    // Clear draft
    localStorage.removeItem("fontStudioDraft");
  }, [glyphs, currentChar, fontName, glyphWidth, glyphHeight, captureCurrentGlyph, onSave]);

  // Pointer handlers for drawing
  const getPoint = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (glyphWidth / rect.width),
      y: (e.clientY - rect.top) * (glyphHeight / rect.height),
    };
  }, [glyphWidth, glyphHeight]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = getPoint(e);
    
    const canvas = drawRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const snap = ctx.getImageData(0, 0, glyphWidth, glyphHeight);
        strokeHistory.current.push(snap);
        if (strokeHistory.current.length > 30) strokeHistory.current.shift();
      }
    }
  }, [getPoint, glyphWidth, glyphHeight]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    
    const canvas = drawRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const p = getPoint(e);
    
    if (tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = lineWidth * 2.5;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = inkColor;
      ctx.lineWidth = lineWidth;
    }
    
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    
    last.current = p;
  }, [getPoint, tool, inkColor, lineWidth]);

  const onPointerUp = useCallback(() => {
    drawing.current = false;
    last.current = null;
    
    // Auto-save current glyph
    const data = captureCurrentGlyph();
    if (data && data !== "data:image/png;base64,") {
      setGlyphs(prev => new Map(prev).set(currentChar, {
        char: currentChar,
        imageData: data,
        timestamp: Date.now()
      }));
    }
  }, [captureCurrentGlyph, currentChar]);

  // Export functions
  const exportSpriteSheet = useCallback(() => {
    const chars = CHARSET.split("").filter(ch => glyphs.has(ch));
    if (!chars.length) return;
    
    const COLS = 10;
    const PAD = 8;
    const LABEL_H = 20;
    const cellW = glyphWidth + PAD * 2;
    const cellH = glyphHeight + PAD * 2 + LABEL_H;
    const rows = Math.ceil(chars.length / COLS);
    
    const canvas = document.createElement("canvas");
    canvas.width = cellW * Math.min(chars.length, COLS) + PAD;
    canvas.height = cellH * rows + PAD;
    
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fdfcff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    Promise.all(chars.map((ch, i) => new Promise<void>(resolve => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = PAD + col * cellW;
      const y = PAD + row * cellH;
      
      ctx.fillStyle = "rgba(167,139,250,0.07)";
      ctx.fillRect(x, y, glyphWidth + PAD * 2, glyphHeight + PAD * 2);
      
      ctx.font = "11px monospace";
      ctx.fillStyle = "#9a7fc8";
      ctx.textAlign = "center";
      ctx.fillText(ch === " " ? "SPC" : ch, x + cellW / 2, y + glyphHeight + PAD * 2 + LABEL_H - 4);
      
      const glyph = glyphs.get(ch);
      if (glyph?.imageData) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, x + PAD, y + PAD, glyphWidth, glyphHeight);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = glyph.imageData;
      } else {
        resolve();
      }
    }))).then(() => {
      const link = document.createElement("a");
      link.download = `${fontName.trim() || "my-font"}-sprites.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  }, [glyphs, fontName, glyphWidth, glyphHeight]);

  const exportJSON = useCallback(() => {
    const glyphRecord: Record<string, string> = {};
    glyphs.forEach((data, char) => {
      glyphRecord[char] = data.imageData;
    });
    
    const json = JSON.stringify({
      name: fontName.trim() || "My Hand Font",
      glyphs: glyphRecord,
      glyphWidth,
      glyphHeight,
      exportedAt: new Date().toISOString()
    }, null, 2);
    
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${fontName.trim() || "my-font"}.json`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [glyphs, fontName, glyphWidth, glyphHeight]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <input
          value={fontName}
          onChange={(e) => setFontName(e.target.value)}
          placeholder="Font name..."
          className="flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[var(--purple)]/20"
        />
        <div className="shrink-0 text-right">
          <div className="text-sm font-bold tabular-nums" style={{ color: "var(--purple)" }}>
            {doneCount}<span className="text-xs font-normal opacity-60">/{totalChars}</span>
          </div>
          <div className="text-[9px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>glyphs</div>
        </div>
      </div>

      {/* Progress */}
      <div className="overflow-hidden rounded-full" style={{ height: 6, background: "var(--surface-soft)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #a78bfa, #ff6b9d)" }}
        />
      </div>

      {/* Draft notice */}
      {showDraftNotice && (
        <div className="rounded-lg bg-green-50 px-3 py-1.5 text-center text-xs text-green-600">
          Draft auto-saved
        </div>
      )}

      {/* Character map */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex gap-1 border-b border-[var(--border)] px-3 pt-2">
          {CHAR_GROUPS.map((g, i) => {
            const groupDone = g.chars.split("").filter(c => glyphs.has(c)).length;
            return (
              <button
                key={g.label}
                onClick={() => setActiveGroup(i)}
                className="relative rounded-t-lg px-2.5 pb-2 pt-1.5 text-[10px] font-semibold transition-all"
                style={{
                  color: activeGroup === i ? "var(--purple)" : "var(--muted)",
                  borderBottom: activeGroup === i ? "2px solid var(--purple)" : "2px solid transparent",
                }}
              >
                {g.label}
                {groupDone > 0 && (
                  <span className="ml-1 rounded-full bg-[rgba(167,139,250,0.15)] px-1 py-0.5 text-[8px]" style={{ color: "var(--purple)" }}>
                    {groupDone}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-1 p-2.5">
          {(CHAR_GROUPS[activeGroup]?.chars ?? "").split("").map((ch) => {
            const idx = CHARSET.indexOf(ch);
            const isDone = glyphs.has(ch);
            const isCur = ch === currentChar;
            return (
              <button
                key={ch}
                onClick={() => idx >= 0 && navigateTo(idx)}
                title={ch === " " ? "space" : ch}
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-[12px] font-semibold transition-all hover:scale-105"
                style={{
                  background: isCur ? "var(--purple)" : isDone ? "rgba(167,139,250,0.12)" : "rgba(0,0,0,0.03)",
                  color: isCur ? "white" : isDone ? "var(--purple)" : "var(--muted)",
                  boxShadow: isCur ? "0 0 0 2px rgba(167,139,250,0.3)" : "none",
                }}
              >
                {ch === " " ? "·" : ch}
                {isDone && !isCur && (
                  <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--purple)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Drawing area */}
      <div className="flex gap-4">
        {/* Canvas column */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full items-baseline justify-between">
            <span className="text-2xl font-bold leading-none" style={{ fontFamily: '"Space Mono", monospace', color: "var(--foreground)" }}>
              {currentChar === " " ? <span className="text-base italic" style={{ color: "var(--muted)" }}>space</span> : currentChar}
            </span>
            <span className="text-[10px] tabular-nums" style={{ color: "var(--muted)" }}>
              {charIndex + 1} / {totalChars}
            </span>
          </div>

          <div
            className="relative shrink-0 overflow-hidden rounded-2xl shadow-sm"
            style={{ width: 218, height: 269, border: "1.5px solid rgba(167,139,250,0.22)" }}
          >
            <canvas
              ref={guideRef}
              width={glyphWidth}
              height={glyphHeight}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />
            <canvas
              ref={drawRef}
              width={glyphWidth}
              height={glyphHeight}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none", cursor: tool === "eraser" ? "cell" : "crosshair" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>

          <div className="flex gap-3 text-[9px]" style={{ color: "var(--muted)" }}>
            <span>cap</span>
            <span>x-ht</span>
            <span className="font-semibold" style={{ color: "var(--purple)" }}>base</span>
            <span>desc</span>
          </div>
        </div>

        {/* Controls column */}
        <div className="flex flex-1 flex-col gap-3 pt-8">
          {/* Tool toggle */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-3">
            <div className="mb-2 flex gap-1">
              <button
                onClick={() => setTool("pen")}
                className="btn-smooth flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-all"
                style={{
                  background: tool === "pen" ? "var(--purple)" : "var(--surface-soft)",
                  color: tool === "pen" ? "white" : "var(--muted-strong)",
                }}
              >
                <Edit3 size={12} className="mr-1 inline" />
                Pen (P)
              </button>
              <button
                onClick={() => setTool("eraser")}
                className="btn-smooth flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition-all"
                style={{
                  background: tool === "eraser" ? "#fb923c" : "var(--surface-soft)",
                  color: tool === "eraser" ? "white" : "var(--muted-strong)",
                }}
              >
                <Trash2 size={12} className="mr-1 inline" />
                Eraser (E)
              </button>
            </div>
            {tool === "pen" && (
              <div className="flex flex-wrap gap-1 pt-1">
                {INK_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setInkColor(c)}
                    className="rounded-full transition-transform hover:scale-110"
                    style={{
                      width: 20, height: 20,
                      background: c,
                      border: inkColor === c ? "2.5px solid var(--purple)" : "1.5px solid rgba(0,0,0,0.1)",
                      boxShadow: inkColor === c ? "0 0 0 1.5px rgba(167,139,250,0.4)" : "none",
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Stroke width */}
          <div className="rounded-xl border border-[var(--border)] bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                {tool === "eraser" ? "Eraser size" : "Stroke width"} ([ ])
              </label>
              <div
                className="rounded-full"
                style={{
                  width: Math.max(4, lineWidth * 1.8),
                  height: Math.max(4, lineWidth * 1.8),
                  background: tool === "eraser" ? "#fb923c" : inkColor,
                  transition: "all 0.15s",
                }}
              />
            </div>
            <input
              type="range" min={1} max={14} value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-full accent-[var(--purple)]"
            />
            <div className="mt-1 flex justify-between text-[9px]" style={{ color: "var(--muted)" }}>
              <span>Fine</span><span>Bold</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => navigateTo(charIndex - 1)}
              disabled={charIndex === 0}
              className="btn-smooth col-span-1 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-35"
              style={{ background: "var(--surface-soft)", color: "var(--muted-strong)" }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => navigateTo(charIndex + 1)}
              disabled={charIndex === totalChars - 1}
              className="btn-smooth col-span-1 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-35"
              style={{ background: "rgba(167,139,250,0.18)", color: "var(--purple)" }}
            >
              Next <ChevronRight size={14} />
            </button>
            <button
              onClick={clearCurrentGlyph}
              className="btn-smooth col-span-2 flex items-center justify-center gap-1 rounded-xl py-1.5 text-[11px]"
              style={{ background: "rgba(251,146,60,0.1)", color: "var(--coral)" }}
            >
              <Trash2 size={12} /> Clear (Del)
            </button>
          </div>

          {/* Keyboard hints */}
          <p className="text-[9px] leading-relaxed" style={{ color: "var(--muted)" }}>
            ← → or Enter to navigate · Backspace to clear · Ctrl+Z to undo · P/E for pen/eraser
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setShowImportDialog(true)}
          className="btn-smooth flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold"
          style={{ background: "rgba(103,212,241,0.15)", color: "#0369a1" }}
        >
          <Upload size={14} /> Import Font
        </button>
        <button
          onClick={() => setShowQuickFillDialog(true)}
          disabled={glyphs.size === 0}
          className="btn-smooth flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold disabled:opacity-50"
          style={{ background: "rgba(167,139,250,0.15)", color: "var(--purple)" }}
        >
          <Sparkles size={14} /> Quick Fill
        </button>
      </div>

      {/* Preview */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <label className="mb-2 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          Live Preview
        </label>
        <input
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder="Type to preview your font..."
          className="mb-3 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[var(--purple)]/20"
        />
        <div
          className="flex min-h-[50px] items-end overflow-x-auto rounded-xl border border-[rgba(0,0,0,0.05)] bg-[#fdfcff] px-2 py-2"
        >
          {previewText === "" ? (
            <span className="text-xs italic" style={{ color: "var(--muted)" }}>your characters will appear here</span>
          ) : (
            previewText.split("").map((ch, i) => {
              const glyph = glyphs.get(ch);
              return (
                <div key={i} className="shrink-0" style={{ width: glyphWidth * 0.55, height: glyphHeight * 0.55 }}>
                  {glyph ? (
                    <img src={glyph.imageData} alt={ch} className="h-full w-full object-contain" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[13px]" style={{ color: "rgba(0,0,0,0.18)", fontFamily: '"Space Mono", monospace' }}>
                      {ch === " " ? "\u00a0" : ch}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Export options */}
      {doneCount > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={exportSpriteSheet}
            className="btn-smooth flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-semibold"
            style={{ background: "rgba(110,231,183,0.18)", color: "#065f46" }}
          >
            <Download size={12} /> Sprite Sheet
          </button>
          <button
            onClick={exportJSON}
            className="btn-smooth flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-semibold"
            style={{ background: "rgba(251,191,36,0.18)", color: "#92400e" }}
          >
            <Download size={12} /> JSON
          </button>
        </div>
      )}

      {/* Save button */}
      <button
        onClick={() => doneCount > 0 ? setShowConfirmDialog(true) : null}
        disabled={doneCount === 0}
        className="btn-smooth mt-auto flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-sm disabled:opacity-50"
        style={{
          background: doneCount > 0 ? "linear-gradient(135deg, #a78bfa 0%, #ff6b9d 100%)" : "var(--surface-soft)",
          color: "white",
        }}
      >
        <Sparkles size={16} />
        {initialFont ? "Update Font" : "Save Font"}
        <span className="text-xs opacity-80">({doneCount} glyphs)</span>
      </button>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Font?</DialogTitle>
            <DialogDescription>
              You&apos;ve created {doneCount} glyphs for &quot;{fontName || "My Hand Font"}&quot;.
              {initialFont ? " This will update your existing font." : " This will add the font to your collection."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
            <AlertCircle className="mr-1 inline h-3 w-3" />
            Tip: You can always edit this font later from your asset library.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Keep Editing
            </Button>
            <Button 
              onClick={() => {
                setShowConfirmDialog(false);
                handleFinalSave();
              }}
              className="bg-gradient-to-r from-[#a78bfa] to-[#ff6b9d] text-white"
            >
              {initialFont ? "Update Font" : "Save Font"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Font</DialogTitle>
            <DialogDescription>
              Upload a TTF or OTF font file to auto-generate glyphs. You can then trace over them or use them directly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFont(file);
              }}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="btn-smooth flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--purple)]/30 bg-[rgba(167,139,250,0.05)] py-8 text-sm font-semibold text-[var(--purple)] transition-all hover:border-[var(--purple)]/50"
            >
              {isImporting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--purple)] border-t-transparent" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Click to select font file
                </>
              )}
            </button>
            {importError && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
                <AlertCircle className="mr-1 inline h-3 w-3" />
                {importError}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Fill Dialog */}
      <Dialog open={showQuickFillDialog} onOpenChange={setShowQuickFillDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Fill Similar Glyphs</DialogTitle>
            <DialogDescription>
              Automatically generate variations of your existing glyphs for similar characters.
              For example, if you draw &quot;A&quot;, we&apos;ll try to create &quot;4&quot; and &quot;^&quot; based on it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
              <Sparkles className="mr-1 inline h-3 w-3" />
              This will create {glyphs.size > 0 ? `~${Math.min(glyphs.size * 2, CHARSET.length - glyphs.size)}` : "0"} additional glyphs based on your existing {glyphs.size} characters.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowQuickFillDialog(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-gradient-to-r from-[#a78bfa] to-[#ff6b9d] text-white"
                onClick={handleQuickFill}
              >
                Generate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
