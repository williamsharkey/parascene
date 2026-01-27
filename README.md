# parascene

> **This is a fork of [crosshj/parascene](https://github.com/crosshj/parascene)** with added Vercel Blob storage adapter for simple serverless persistence.

## Live Demo

**https://parasharkgod.vercel.app**

Test accounts (password: `p123@#`):
- consumer@example.com
- creator@example.com
- provider@example.com
- admin@example.com

## Fork Changes

This fork adds a **Vercel Blob adapter** (`db/adapters/blob.js`) that stores the entire database state in a single JSON blob. This is useful for:
- Simple test deployments without a real database
- Prototyping on Vercel's free tier
- Environments where SQLite/Supabase setup is overkill

### How it works
- All database state (users, images, likes, etc.) is stored in one JSON file on Vercel Blob storage
- State is loaded on first request and saved after mutations
- Works within Vercel's free tier limits

### Setup for your own deployment
1. Create a Vercel Blob store: `vercel blob stores create parascene-db`
2. Connect it to your project in the Vercel dashboard
3. Set environment variables:
   - `DB_ADAPTER=blob`
   - `BLOB_READ_WRITE_TOKEN` (auto-added when you connect the store)
   - `SESSION_SECRET` (any random string)

---

## dev server (express)

```sh
npm install --include=dev
npm run dev
```

Open `http://localhost:3000/` to reach the app (routes are served only
from `/`).

Pages are served from `pages/`. Static assets are served from `static/`
(including `global.css`).

## local db + auth

- SQLite file is stored at `db/data/app.db`
- Auth routes: `POST /signup`, `POST /login`, `POST /logout`
- Session check: `GET /me`

To reset to a blank database:

```sh
npm run reset
```

Seeded accounts after reset (run `npm run reset` if you already seeded):

- `consumer@example.com` / `p123@#`
- `creator@example.com` / `p123@#`
- `provider@example.com` / `p123@#`
- `admin@example.com` / `p123@#`