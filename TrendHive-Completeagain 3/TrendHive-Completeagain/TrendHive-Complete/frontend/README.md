# TrendHive v2 (Frontend)

This is the TrendHive v2 dashboard frontend built with **Vite + React + Tailwind + Recharts**.

## Prerequisites
- Node.js 18+ (recommended)

## Configure backend URL
Copy `.env.example` to `.env` and set the backend base URL:

- `VITE_API_URL=http://localhost:8000`

If you don't set it, the app defaults to `http://localhost:8000`.

## Install & run
```bash
npm install
npm run dev
```

## Expected backend endpoints
This UI expects a TrendHive backend exposing endpoints such as:
- `/health`
- `/areas`, `/areas/{area}`
- `/categories`
- `/narrative/*`
- `/forecast/*`
- `/explain/*`

## Notes
- The UI is resilient: if the backend is down, API calls return `null` and the UI shows fallback states.
- Theme tokens live in `src/styles/theme.js`.
- API helper lives in `src/lib/api.js`.


## Routing (v2 refactor)

This version uses `react-router-dom`.

Public routes:
- `/` (Home)
- `/login`
- `/contact`
- `/demo`

App routes:
- `/app/dashboard`
- `/app/areas/:areaId`
- `/app/opportunities`
- `/app/alerts`
- `/app/categories`
- `/app/ai-copilot`
- `/app/profile`
