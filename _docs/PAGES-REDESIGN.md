# Pages System Redesign

## Current Implementation

Static HTML files in `pages/` served via `api_routes/pages.js`:

**Role-related Routes:**
- `/` (not logged in) → index.html
- `/auth` → auth.html
- `/user`, `/user/:id` → `user-profile.html`
- `/creations/:id` → `creation-detail.html`
- `/*` → all roles use app.html except admin which uses app-admin.html

**Composition methods:**
- Static HTML shell files
- Server-side string replacement (eg. `<!--APP_HEADER-->`)

- Web Components (navigation, modals, routes)
- Global component loading (`global.js` imports all components)

- Inline HTML in pages (admin modals, creation-detail structure)
- Client-side JS composition (page-specific JS files)

---

## Proposed Changes

[ insert changes here ]