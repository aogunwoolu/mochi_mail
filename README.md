# 💌 Mochi Mail

A cozy, real-time collaborative stationery studio. Draw letters, decorate them with stickers and washi tape, send them to friends, and hang out on a shared canvas — all in the browser.

---

## What it is

Mochi Mail is a digital pen-pal experience built around a shared infinite canvas. Users can draw, place stickers, write letters, and publish their own decorations to a community shop. Every room is a live multiplayer session — you see other people's cursors and strokes appear in real time.

---

## Features

### ✏️ Studio
An infinite canvas (6 000 × 4 800 px) where you draw, decorate, and compose.

| Tool | What it does |
|------|-------------|
| Pen | Freehand drawing with pressure sensitivity via `perfect-freehand` |
| Eraser | Erase strokes |
| Text | Place styled text with any custom font |
| Stickers | Drag stickers, washi tape, stamps, and envelope overlays onto the canvas |
| Backgrounds | Swap the paper texture behind your drawing |

Canvas state — drawings, placed items, paper — is auto-saved per user per room and restored on return.

### 💌 Mail
Write a letter, pick an envelope and stamp, choose a delivery speed, and send it. Recipients get it in their inbox with a delivery countdown. Outbox tracks everything you've sent.

### 🏪 Shop
A community marketplace for decorations. Browse by type (stickers, washi tape, paper, stamps, envelopes, fonts, kits), search by name or tag, save items to your collection, and publish your own. Items persist as base64 data in Supabase — no separate file storage needed.

### 🎨 Sticker Creator
Built-in tool for making custom stickers with three modes:

- **Draw** — paint directly on a canvas with a pastel palette; saves as a trimmed PNG
- **Upload** — drop any image file; GIFs are detected automatically and saved as animated stickers
- **Animate** — frame-by-frame animator (up to 8 frames) with FPS control; exports as a real GIF via `gifenc`

### 🚪 Rooms
Multiplayer collaborative spaces.

- Create public or password-protected rooms
- Join by invite link, room code (`ABC-123`), or direct room ID
- See live cursors and names of everyone in the room
- Jump to any collaborator's position on the canvas
- Persistent board state per room

### 🌸 Spaces
Every user gets a public profile page — a customisable corkboard where you pin sticky notes, images, drawings, and emoji stickers. Visitors can leave notes. Positions of everything on the board are saved.

### 👤 Accounts
- **Guest mode** — instant access, no sign-up, session persists in `sessionStorage`
- **Full account** — username, display name, avatar, bio, accent colour, wallpaper, YouTube link

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org) (App Router, client components) |
| UI | React 19, [Tailwind CSS v4](https://tailwindcss.com), [Radix UI](https://www.radix-ui.com) |
| Animation | [Framer Motion](https://www.framer-motion.com) |
| Drawing | [perfect-freehand](https://github.com/steveruizok/perfect-freehand) |
| GIF encoding | [gifenc](https://github.com/mattdesl/gifenc) |
| Database | [Supabase](https://supabase.com) (PostgreSQL + Realtime + Auth) |
| Analytics | [PostHog](https://posthog.com) |
| Deployment | [Vercel](https://vercel.com) |
| Language | TypeScript (strict) |

---

## Database schema

All tables live in the `public` schema on Supabase with Row-Level Security enabled.

```
profiles          — user identity (username, display_name, avatar_url, accent_color, wallpaper, …)
spaces            — user profile boards (title, tagline, about_me)
space_items       — items on a space board (notes, images, drawings; x/y/width/height/rotation)
rooms             — collaborative rooms (title, is_public, password_hash, invite_token, room_code)
room_members      — room membership (room_id + user_id composite PK)
studio_boards     — canvas state per user per room (drawing_data PNG, placed_items JSON, selected_paper JSON)
board_strokes     — real-time vector strokes (room_id, artist_id, tool, color, size, points JSON, seq)
mail_states       — per-user mail inbox/sent (JSONB blob)
asset_states      — per-user stickers, washi, fonts, placed items (JSONB blob)
store_states      — per-user published shop items + collection (JSONB blob, publicly readable)
```

Key Supabase functions: `create_room`, `join_room_by_token`, `join_room_by_code`, `join_room_full`, `update_room_security`, `rotate_room_invite_token`, `get_room_invite_preview`.

Migrations live in [`.migration-backup/supabase/migrations/`](.migration-backup/supabase/migrations/). Run them in order (`0001_` → `0012_`) via the Supabase SQL editor.

---

## Environment variables

Create a `.env.local` file in the repo root:

```env
# Required — Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional — PostHog analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

The Supabase anon key is safe to expose publicly — all data access is controlled by Row-Level Security policies on the database.

---

## Running locally

**Prerequisites:** Node.js 18+, npm

```bash
# 1. Clone
git clone https://github.com/your-org/mochi-mail.git
cd mochi-mail

# 2. Install dependencies
npm install

# 3. Add environment variables
cp .env.local.example .env.local   # then fill in your Supabase keys

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Other scripts

```bash
npm run build       # Production build
npm start           # Serve the production build
npm run typecheck   # TypeScript type-check only
```

---

## Deploying to Vercel

1. Push the repo to GitHub
2. Import it on [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Next.js — no build configuration needed
4. Add the environment variables from the section above in the Vercel project settings
5. Deploy

The `vercel.json` at the root is minimal — it just declares `"framework": "nextjs"`.

---

## Project structure

```
mochi-mail/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout (MochiProvider, global CSS)
│   │   ├── page.tsx            # Main studio (canvas, mail, shop tabs)
│   │   ├── rooms/
│   │   │   ├── page.tsx        # Room browser
│   │   │   └── [inviteToken]/
│   │   │       └── page.tsx    # Room invite accept flow
│   │   └── space/
│   │       └── page.tsx        # User profile / space page
│   ├── components/             # UI components
│   │   ├── DrawingCanvas.tsx   # Main infinite canvas
│   │   ├── SpaceStudio.tsx     # Profile board
│   │   ├── StoreView.tsx       # Shop UI
│   │   ├── StickerCreator.tsx  # Draw / upload / animate sticker tool
│   │   ├── MailComposePanel.tsx
│   │   ├── MailboxPanel.tsx
│   │   └── …
│   ├── hooks/                  # Business logic
│   │   ├── useAssets.ts        # Stickers, washi, papers, fonts, placed items
│   │   ├── useStore.ts         # Shop items, collection, publish
│   │   ├── useMail.ts          # Compose, send, inbox
│   │   ├── useRooms.ts         # Room CRUD, join, membership
│   │   ├── useSpaces.ts        # Profile board items, persistence
│   │   ├── useAccount.ts       # Auth, profile, guest mode
│   │   └── useStrokeSync.ts    # Real-time stroke broadcast via Supabase Realtime
│   ├── context/
│   │   └── MochiContext.tsx    # Global context wiring all hooks together
│   ├── lib/
│   │   ├── supabase/
│   │   │   └── client.ts       # Singleton Supabase browser client
│   │   ├── posthog.ts          # Analytics helpers
│   │   └── exportAsset.ts      # Canvas/font export utilities
│   └── types/
│       ├── index.ts            # Domain types (Sticker, PlacedSticker, StoreItem, …)
│       └── database.ts         # Generated Supabase row types
├── .migration-backup/
│   └── supabase/migrations/    # SQL migrations (run in Supabase SQL editor)
├── next.config.ts
├── postcss.config.mjs          # Tailwind v4 via @tailwindcss/postcss
├── tsconfig.json
└── vercel.json
```

---

## Real-time architecture

Collaborative drawing uses **Supabase Realtime** (Postgres change events) on the `board_strokes` table:

1. Every pen stroke is inserted as a row: `(room_id, artist_id, tool, color, size, points[], seq)`
2. All clients in the room subscribe to `INSERT` events filtered by `room_id`
3. New strokes are replayed onto the local canvas as they arrive
4. Periodic full-board snapshots are saved to `studio_boards` for rejoining users

Room presence (cursors, member list) uses Supabase Realtime Presence channels.

---

## Animated stickers

The **Animate** tab in the Sticker Creator uses `gifenc` to encode multi-frame drawings as real GIF files:

1. User draws up to 8 frames on a shared canvas
2. Each frame is saved as a PNG data URL
3. On export, frames are decoded into RGBA pixel data, quantised to a 256-colour palette, and encoded into a GIF with configurable frame delay
4. The GIF is stored as a `data:image/gif;base64,...` string alongside static stickers

Animated stickers in the canvas are rendered as `<img>` elements (so the browser animates them natively) rather than drawn to the canvas overlay, which handles only static content.

---

## Contributing

Issues and pull requests are welcome. The codebase is TypeScript strict throughout — run `npm run typecheck` before opening a PR.
