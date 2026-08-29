# 🎨 MochiMail Hand-Drawn Icon Replacement Guide

Drop your hand-drawn PNG icons directly into this folder (`public/icons/handdrawn/`) with the filenames below. The app will automatically detect and display your hand-drawn art, with automatic vector fallback if any file is missing.

---

## 📐 Procreate Canvas & Export Settings

| Setting | Recommended Value | Notes |
| :--- | :--- | :--- |
| **Canvas Dimensions** | **128 × 128 px** (or **256 × 256 px**) | Square 1:1 ratio. 128px is ideal for lightweight, crisp pixel art & line art; 256px is great for high-DPI retina detail. |
| **Resolution / DPI** | **72 DPI** or **300 DPI** | (Pixel dimensions are what matter on screen; 128x128px or 256x256px). |
| **Color Profile** | **sRGB IEC61966-2.1** | Standard web color profile so colors match your screen. |
| **Background** | **Transparent** | ⚠️ In Procreate Layers, uncheck the bottom `Background color` checkbox before exporting! |
| **Margin / Padding** | **10% – 15% inner padding** | Leave a few pixels around the outer edges so line strokes don't get clipped. |
| **Export Format** | **PNG** | Export as **PNG** with transparency. |

---

## 📋 Icon Checklist & Filenames

Simply export your drawing from Procreate as a PNG and name it according to this table:

### 1. 🖌️ Canvas & Studio Toolbar
| Filename | Icon Name | Description & Suggestion |
| :--- | :--- | :--- |
| `pen.png` | Pen Tool | Cute fountain pen, pencil, or calligraphy nib |
| `eraser.png` | Eraser Tool | Pink block eraser or cute smudge rubber |
| `select.png` | Select / Move | Hand cursor, pointer arrow, or grabby paw |
| `text.png` | Text Tool | Hand-drawn letter "T" or text cursor |
| `assets.png` | Asset Drawer | 4 little stickers, sticker box, or ribbon |
| `undo.png` | Undo | Curved arrow pointing left |
| `redo.png` | Redo | Curved arrow pointing right |
| `export.png` | Save / Export | Floppy disk, download arrow, or sealed stamp |
| `clear.png` | Clear Canvas | Cute trash can, sparkle broom, or eraser sweep |

### 2. 🧭 Main Navigation (Header & Bottom Bar)
| Filename | Icon Name | Description & Suggestion |
| :--- | :--- | :--- |
| `canvas.png` | Canvas Tab | Easel, sketchbook, or brush |
| `mail.png` | Mail Tab | Snail mail envelope, letter, or postage stamp |
| `shop.png` | Shop Tab | Tote bag, boutique awning, or cute shop stand |
| `rooms.png` | Rooms Tab | Two mochi friends, tea table, or room door |

### 3. 🥞 Layers Panel
| Filename | Icon Name | Description & Suggestion |
| :--- | :--- | :--- |
| `layers.png` | Layers | Stack of paper sheets / pancakes |
| `eye-open.png` | Visible Layer | Cute open eye |
| `eye-closed.png` | Hidden Layer | Closed eye with lashes or slash |
| `arrow-up.png` | Move Up | Arrow pointing up |
| `arrow-down.png` | Move Down | Arrow pointing down |
| `trash.png` | Delete | Tiny wastebin or scribbled cross |

### 4. 💌 Mail Studio & Mailbox
| Filename | Icon Name | Description & Suggestion |
| :--- | :--- | :--- |
| `compose.png` | Compose | Quill / writing letter |
| `envelope.png` | Envelope Style | Folded envelope with heart seal |
| `stamp.png` | Stamp Tool | Scalloped postage stamp |
| `paper.png` | Paper Background | Sheet of stationery paper |
| `speed-express.png`| Express Delivery | Lightning bolt or swift wings ⚡ |
| `speed-standard.png`| Standard Delivery | Paper airplane ✈️ |
| `speed-snail.png` | Snail Mail | Cute little snail 🐌 |
| `send.png` | Send Letter | Flying paper plane or mailbox drop |

### 5. 🛍️ Community Store
| Filename | Icon Name | Description & Suggestion |
| :--- | :--- | :--- |
| `search.png` | Search | Hand-drawn magnifying glass |
| `heart.png` | Liked Heart | Filled cute heart |
| `heart-outline.png`| Unliked Heart | Heart outline |
| `download.png` | Download / Add | Download tray with arrow |
| `check.png` | Added | Cute checkmark |
| `publish.png` | Publish / Add | Plus symbol `+` |

### 6. ⚙️ Dialogs & Room Controls
| Filename | Icon Name | Description & Suggestion |
| :--- | :--- | :--- |
| `close.png` | Close | Hand-drawn `X` button |
| `copy.png` | Copy Link | Two overlapping papers |
| `lock.png` | Private Room | Padlock |
| `globe.png` | Public Room | Cute Earth / globe |
| `settings.png` | Settings | Gear / flower cog |

---

## 💡 How to Test Immediately
1. Draw one icon in Procreate (e.g. `pen.png` at 128×128px with transparent background).
2. Export as PNG and drop it directly into this folder: `public/icons/handdrawn/pen.png`.
3. Refresh the app in your browser — the pen tool immediately turns into your hand-drawn drawing!

---

## 📎 Procreate Reference Templates

The `templates/` folder has transparent SVG guides you can drop into Procreate to keep every icon consistent:

- `templates/single-icon-128.svg` / `templates/single-icon-256.svg` — a single-icon canvas with a safe-margin box, inscribed circle guide, and center crosshair.
- `templates/contact-sheet.svg` — all 38 icon slots in one labeled grid, **with the current fallback vector icon already traced at low opacity in each cell** — so you can see exactly what shape you're replacing and trace/reinterpret it in your own style, then export them individually afterward.

**To use in Procreate:**
1. AirDrop/share the `.svg` file to your iPad, or open it in Files, then import it into a new Procreate canvas (Procreate can import SVGs as a new layer).
2. The faint icon shapes and guide lines come in on their own layer — lock it so you don't draw on it directly.
3. Add a new layer above the guide and draw your icon on top of (or inspired by) the faint reference shape, inside the dashed safe-margin box.
4. Hide or delete the guide layer, then export just your artwork layer as a transparent PNG using the filenames above.

### ✂️ Auto-crop the finished contact sheet

Drew everything on `contact-sheet.svg` in one Procreate canvas? Open `templates/sheet-splitter.html` in your browser
(double-click it, no install needed), upload your exported contact-sheet PNG, and it will automatically crop out
all 38 icon cells. It can either save the PNGs straight into a folder you pick (Chrome/Edge) or download them as a
ZIP you unzip into this folder.

