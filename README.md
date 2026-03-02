# Next iOS Admin Panel

React + Vite + TypeScript frontend for the Next iOS license/admin panel.

## Setup

```sh
npm i
cp .env.example .env   # edit .env: set VITE_API_BASE_URL for backend
npm run dev
```

## Scripts

- `npm run dev` – dev server (port from `VITE_DEV_PORT` or 8080)
- `npm run build` – production build (uses `.env.production` for API URL)
- `npm run preview` – preview production build locally

## Backend

Set `VITE_API_BASE_URL` in `.env` (local: `http://localhost:8550`) or in `.env.production` for build. See `FRONTEND-BACKEND-CONNECTION.md`.

## Favicon / PWA icons

- **Favicon:** `public/favicon.ico` – replace with your own 32×32 or 16×16 `.ico` if needed.
- **PWA:** `public/pwa-192x192.png`, `public/pwa-512x512.png` – used for install icon and splash.
