# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is Pathfinder

An Italian university student networking platform with personalized opportunity matching, social features (posts, friends, comments/likes), and real-time messaging. Built with Next.js 14 frontend + Express.js backend + PostgreSQL (via Docker) + Prisma ORM.

## Development Commands

```bash
# Full stack dev (starts frontend:3000 + backend:4000 concurrently)
npm run dev

# Individual services
npm run dev:frontend    # Next.js dev server on port 3000
npm run dev:backend     # Express dev server on port 4000 (ts-node-dev)

# Database (requires Docker)
npm run db:up           # Start PostgreSQL 16 container
npm run db:migrate      # Run Prisma migrations
npm run db:seed         # Seed with sample data (5 users, 8 universities)

# Build
cd frontend && npm run build   # Next.js production build
cd backend && npm run build    # TypeScript compilation to dist/
```

**First-time setup:** `docker-compose up -d && npm install && npm run db:migrate && npm run db:seed && npm run dev`

## Architecture

**Monorepo with two packages** — no workspace manager, root `package.json` uses concurrently to run both.

### Backend (`backend/src/`)
- **Entry:** `index.ts` — Express app + Socket.IO server setup
- **Pattern:** Routes → Controllers → Services → Prisma
- **Auth:** JWT access tokens (15min, Bearer header) + refresh tokens (7d, HTTPOnly cookie). Middleware in `middleware/auth.ts` sets `req.user`.
- **Real-time:** Socket.IO on `/chat` namespace — handles `send_message`, `typing`, `stop_typing` events. Auth via JWT token in handshake.
- **Matching engine** (`services/matchingEngine.ts`): Scores opportunities 0-100 based on interest type (30pts), cluster tag (25pts), GPA (15pts), English level (15pts), relocation willingness (10pts), study year (5pts).
- **Prisma singleton** in `lib/prisma.ts` — always import from there.

### Frontend (`frontend/`)
- **Next.js 14 App Router** with route groups: `(main)/` for protected routes, top-level for auth pages
- **Auth context** in `components/AuthProvider.tsx` — checks `profileCompleted`, redirects incomplete profiles to `/onboarding`
- **API client** in `lib/api.ts` — Axios with JWT interceptor that auto-refreshes on 401
- **Socket client** in `lib/socket.ts`
- **Styling:** Tailwind CSS, dark theme default, primary color #4F46E5

### Database
- **Key models:** User, UserProfile (questionnaire data + cluster tags), Opportunity, University, Course, FriendRequest, PathMatesMessage/Group, Post/PostLike/PostComment, Notification
- **Cluster tags** derived from onboarding questionnaire: Analista, Creativo, Leader, Imprenditore, Sociale, Explorer

## API Routes

All protected routes require `Authorization: Bearer <token>`. Key prefixes:
- `/api/auth/` — register, login, refresh
- `/api/profile/` — user profiles + questionnaire
- `/api/opportunities/` — browse, match (`?matched=true`), save
- `/api/friends/` — requests, accept/reject, status
- `/api/posts/` — feed, likes, comments
- `/api/messages/` — conversations, send (also via Socket.IO)
- `/api/notifications/` — list, unread count, mark read
- `/api/universities/` — list, details with courses

## Environment

Backend `.env`: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT=4000`
Frontend `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000`

## Seed Users

All use password `Password123`: marco@example.com, giulia@example.com, luca@example.com, sara@example.com, alessandro@example.com
