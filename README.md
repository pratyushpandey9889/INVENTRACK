# INVENTRACK

A full-stack inventory management system with a Node/Express backend and a React/Vite frontend.

## Prerequisites

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **npm 9+** (bundled with Node 18)

## Install dependencies

Run this once from the repository root. npm workspaces will install packages for both the backend and frontend.

```bash
npm install
```

## Environment variables

Each package ships an `.env.example` file. Copy it to `.env` and fill in the values before starting the server.

### Backend

```bash
cp packages/backend/.env.example packages/backend/.env
```

| Variable        | Description                                             | Default                   |
|-----------------|---------------------------------------------------------|---------------------------|
| `DATABASE_PATH` | Path to the SQLite database file                        | `./inventrack.db`         |
| `JWT_SECRET`    | Secret key used to sign JWT tokens                      | *(must be set)*           |
| `CORS_ORIGIN`   | Allowed CORS origin (production only)                   | `http://localhost:5173`   |
| `NODE_ENV`      | Runtime environment: `development`, `production`, `test`| `development`             |
| `PORT`          | Port the API server listens on                          | `3001`                    |

### Frontend

```bash
cp packages/frontend/.env.example packages/frontend/.env
```

| Variable       | Description                      | Default                    |
|----------------|----------------------------------|----------------------------|
| `VITE_API_URL` | Base URL of the backend API      | `http://localhost:3001`    |

> **Never commit `.env` files.** Only `.env.example` files should be checked in.

## Running locally (development)

Open two terminals:

**Terminal 1 — backend**

```bash
cd packages/backend
npm run dev
```

The API starts at `http://localhost:3001`. You can verify it with:

```bash
curl http://localhost:3001/health
```

**Terminal 2 — frontend**

```bash
cd packages/frontend
npm run dev
```

The app opens at `http://localhost:5173`.

## Building for production

**Backend** — compiles TypeScript to `packages/backend/dist/`:

```bash
cd packages/backend
npm run build
npm start
```

**Frontend** — bundles the app to `packages/frontend/dist/`:

```bash
cd packages/frontend
npm run build
```

## Running tests

```bash
cd packages/backend
npm test
```

## Project structure

```
.
├── packages/
│   ├── backend/   # Express API (TypeScript, SQLite via better-sqlite3)
│   └── frontend/  # React + Vite + Tailwind
└── package.json   # Root workspace config
```
