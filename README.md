# parascene

> **This is a fork of [crosshj/parascene](https://github.com/crosshj/parascene)**

## Live Demo

**https://parasharkgod.vercel.app**

Test accounts (password: `p123@#`):
- consumer@example.com
- creator@example.com
- provider@example.com
- admin@example.com

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
