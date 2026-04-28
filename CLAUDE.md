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

# Tests (Vitest, backend only)
npm test                # Run once
npm run test:watch      # Watch mode

# Build
cd frontend && npm run build   # Next.js production build
cd backend && npm run build    # TypeScript compilation to dist/

# Admin
cd backend && npm run admin:create   # Create an admin user interactively

# Opportunity import (run from backend/)
npm run scrape:<source>          # e.g. scrape:greenhouse, scrape:lever
npm run import:opportunity-desk  # One-shot imports
npm run seed:curated             # Seed hand-curated opportunities
```

**First-time setup:** `docker-compose up -d && npm install && npm run db:migrate && npm run db:seed && npm run dev`

Redis must also be running locally (`redis-server` or via Docker) — Socket.IO uses a Redis adapter.

## Architecture

**Monorepo with npm workspaces** (`"workspaces": ["frontend", "backend"]`). Root `package.json` uses concurrently to run both services.

### Backend (`backend/src/`)
- **Entry:** `index.ts` — Express app + Socket.IO server setup, starts import scheduler and deadline checker
- **Pattern:** Routes → Controllers → Services → Prisma
- **Auth:** JWT access tokens (15min, Bearer header) + refresh tokens (7d, HTTPOnly cookie). Three middleware exports in `middleware/auth.ts`: `authMiddleware` (token only), `verifiedMiddleware` (token + email verified), `adminMiddleware` (requires ADMIN role).
- **Real-time:** Socket.IO with Redis adapter. Two namespaces: `chatHandler` (send_message, typing, stop_typing) and `notificationHandler`. Global io instance exported via `socketManager.ts` (`getIO()`).
- **Schemas:** Zod validation schemas in `schemas/` — always validate request bodies with these before passing to services.
- **Matching engine** (`services/matchingEngine.ts`): Scores opportunities 0-100 based on interest type (30pts), cluster tag (25pts), GPA (15pts), English level (15pts), relocation willingness (10pts), study year (5pts). Skills matching is layered on top.
- **Embedding service** (`services/embedding.service.ts`): Lazy-loads `Xenova/all-MiniLM-L6-v2` via `@xenova/transformers` for semantic similarity on opportunity text.
- **Similarity service** (`services/similarity.service.ts`): `profileSimilarityScore()` — scores profile-to-profile similarity 0-100 (interest 35pts, cluster 30pts, careerVision 20pts, passions 15pts). Used for PathMates course comparison.
- **Import pipeline** (`services/import/`): ~15 source importers (Greenhouse, Lever, Ashby, Arbeitnow, etc.) + `scheduler.ts` with cron jobs. Sources run weekly on staggered days to avoid load spikes. EURES disabled (no API); Bundesagentur and The Muse removed for ToS reasons.
- **Prisma singleton** in `lib/prisma.ts` — always import from there.
- **Storage:** Cloudflare R2 via `lib/r2.ts` (S3-compatible). Falls back gracefully if `R2_CONFIGURED` is false.
- **Cache:** Redis via `lib/redis.ts` (ioredis). Also exports `createPubSubPair()` for the Socket.IO adapter.

### Frontend (`frontend/`)
- **Next.js 14 App Router** with route groups: `(main)/` for protected routes (home, networking, notifications, profile, universities), top-level for auth pages (login, register, onboarding, forgot-password, reset-password, verify-email)
- **Auth context** in `components/AuthProvider.tsx` — checks `profileCompleted`, redirects incomplete profiles to `/onboarding`
- **API client** in `lib/api.ts` — Axios with JWT interceptor that auto-refreshes on 401
- **Socket client** in `lib/socket.ts`
- **Styling:** Tailwind CSS, dark theme default, primary color #4F46E5

### Database
- **Key models:** User, UserProfile (questionnaire data + cluster tags), Opportunity, University, Course, FriendRequest, PathMatesMessage/Group, Post/PostLike/PostComment, Notification, Badge, UserSkills
- **Cluster tags** derived from onboarding questionnaire: Analista, Creativo, Leader, Imprenditore, Sociale, Explorer

## API Routes

All protected routes require `Authorization: Bearer <token>`. Key prefixes:
- `/api/auth/` — register, login, refresh, verify-email, forgot/reset-password
- `/api/profile/` — user profiles + questionnaire
- `/api/opportunities/` — browse, match (`?matched=true`), save
- `/api/friends/` — requests, accept/reject, status
- `/api/posts/` — feed, likes, comments
- `/api/messages/` — conversations, send (also via Socket.IO)
- `/api/notifications/` — list, unread count, mark read
- `/api/universities/` — list, details with courses
- `/api/courses/` — course comparison (PathMates feature)
- `/api/groups/` — PathMates groups
- `/api/badges/` — user badges
- `/api/skills/` — user skills
- `/api/users/` — public user lookup
- `/api/import/` — manual trigger for opportunity imports (admin)
- `/api/admin/` — user management, moderation (requires ADMIN role + verified email)

## Environment

Backend `.env`: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `PORT=4000`, `REDIS_URL`, `FRONTEND_URL`, `EXTRA_ORIGINS` (comma-separated), `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

Frontend `.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000`

## Seed Users

All use password `Password123`: marco@example.com, giulia@example.com, luca@example.com, sara@example.com, alessandro@example.com
