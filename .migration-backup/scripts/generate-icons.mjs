// Run with: node scripts/generate-icons.mjs
// Generates simple SVG-based PNG icons for the PWA

import { writeFileSync } from "fs";

const svg192 = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="32" fill="#FF6B8A"/>
  <rect x="8" y="8" width="176" height="176" rx="28" fill="#F0E8F8"/>
  <text x="96" y="110" text-anchor="middle" font-size="80" font-family="monospace">✉️</text>
  <text x="96" y="155" text-anchor="middle" font-size="22" font-family="monospace" font-weight="bold" fill="#4A4A5A">MOCHI</text>
</svg>`;

const svg512 = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="80" fill="#FF6B8A"/>
  <rect x="16" y="16" width="480" height="480" rx="72" fill="#F0E8F8"/>
  <text x="256" y="280" text-anchor="middle" font-size="200" font-family="monospace">✉️</text>
  <text x="256" y="410" text-anchor="middle" font-size="56" font-family="monospace" font-weight="bold" fill="#4A4A5A">MOCHI</text>
</svg>`;

// Write as SVG (browsers handle SVG PWA icons well enough for dev)
writeFileSync("public/icons/icon-192.svg", svg192);
writeFileSync("public/icons/icon-512.svg", svg512);

console.log("Icons generated! Note: For production, convert these SVGs to PNGs.");
