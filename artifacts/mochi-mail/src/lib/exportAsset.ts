
import type { CustomFont } from "@/types";

function slugify(str: string): string {
  return str
    .trim()
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
}

function buildFilename(assetName: string, authorName: string, ext: string): string {
  const a = slugify(assetName) || "asset";
  const b = slugify(authorName) || "creator";
  return `${a}_${b}_MochiMail.${ext}`;
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportImageAsset(
  assetName: string,
  authorName: string,
  imageData: string,
) {
  const filename = buildFilename(assetName, authorName, "png");

  if (imageData.startsWith("data:image/png")) {
    triggerDownload(imageData, filename);
    return;
  }

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d")!.drawImage(img, 0, 0);
    triggerDownload(canvas.toDataURL("image/png"), filename);
  };
  img.src = imageData;
}

export function exportFont(font: CustomFont, authorName: string) {
  const payload = {
    format: "mochimail-font",
    version: 1,
    name: font.name,
    author: authorName,
    glyphWidth: font.glyphWidth,
    glyphHeight: font.glyphHeight,
    glyphs: font.glyphs,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, buildFilename(font.name, authorName, "json"));
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
