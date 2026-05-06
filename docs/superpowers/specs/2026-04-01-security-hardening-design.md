# Security Hardening — Design Spec

**Date:** 2026-04-01
**Scope:** Fix all security vulnerabilities identified in the PathFinder audit
**Priority:** P0 — deploy ASAP

---

## 1. RBAC (Role-Based Access Control)

### Schema Changes
- New enum `Role`: `USER` (default), `MODERATOR`, `ADMIN`
- New field `role Role @default(USER)` on User model
- JWT payload includes `role` field to avoid DB query per request

### Admin Assignment
- **CLI script only** (`npm run admin:create -- --email <email>`) — promotes an existing user to ADMIN directly in DB
- No `ADMIN_EMAIL` env variable, no automatic promotion at login
- Script validates user exists and is email-verified before promoting

### New Middleware
- `adminMiddleware`: checks `req.user.role === 'ADMIN'`, returns 403 otherwise
- `moderatorMiddleware`: checks `req.user.role` is `ADMIN` or `MODERATOR`

### Protected Endpoints
All `/api/import/*` endpoints require `adminMiddleware`:
- `POST /api/import/mur/universities`
- `POST /api/import/mur/courses`
- `POST /api/import/eures`
- `POST /api/import/eu-youth`
- `POST /api/import/almalaurea`
- `POST /api/import/cleanup`
- `POST /api/import/all`
- `GET /api/import/status`

### Admin Endpoints
- `PATCH /api/admin/users/:id/role` — ADMIN only, change user role
  - Cannot remove own ADMIN role if sole admin in system
  - Generates notification to affected user + audit log entry
- `GET /api/admin/users` — ADMIN only, paginated user list with roles, search, filters

### Role Permissions Matrix
| Action | USER | MODERATOR | ADMIN |
|--------|------|-----------|-------|
| Import data | - | - | yes |
| Manage roles | - | - | yes |
| Delete others' posts/comments | - | yes | yes |
| Ban users | - | - | yes |
| View admin panel | - | yes | yes |

---

## 2. Input Sanitization & XSS Protection

### Server-side (defense layer 1)
- Install `sanitize-html` as backend dependency
- Utility function `sanitizeText(input: string): string` strips all HTML tags
- Applied in service layer before DB save:
  - Post content (`post.service.ts`)
  - Comments (`post.service.ts` → `createComment`)
  - Messages (`message.service.ts` + Socket.IO handler in `chatHandler.ts`)
  - Username and bio in profile
- Zod validation added to Socket.IO handlers (`send_group_message`, `send_direct_message`):
  - `content`: string, min 1, max 5000
  - `groupId`/`toUserId`: UUID format
  - `images`: optional array, max 5 items

### Frontend (defense layer 2)
- Audit all uses of `dangerouslySetInnerHTML` — remove or wrap with DOMPurify
- Verify all user-generated content rendered via JSX (auto-escaped by React)

### Image Validation
- Explicitly block `image/svg+xml` in allowed MIME types (SVG can contain scripts)
- Check MIME type against allowlist BEFORE regex match, not after
- Allowed types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`

---

## 3. Token Revocation & Session Management

### Redis Blacklist
- On logout: refresh token added to Redis as `blacklist:{sha256(token)}` with TTL = remaining time to token expiry
- On password change: all user's refresh tokens invalidated via `user_tokens:{userId}` Redis set
- Every `/api/auth/refresh` call checks blacklist before issuing new tokens

### Rate Limiting Fixes
- `/api/auth/refresh` NO LONGER skips auth rate limiter (was skipped before)
- `/api/auth/resend-otp` NO LONGER skips auth rate limiter
- Dedicated rate limiter for `resend-otp`: max 3 requests per 15 minutes

### verifiedMiddleware Fix
- Convert from `.then()` callback to `async/await` to eliminate race condition
- Middleware becomes `async` and does `await prisma.user.findUnique(...)` before calling `next()`

### Socket.IO Token Refresh
- When frontend detects 401 and refreshes token, emits `socket_reauthenticate` event with new token
- Server verifies new token and updates `socket.userId`
- If token not refreshed within 30s of expiry, server disconnects the socket

---

## 4. Socket.IO Security

### Connection Rate Limiting
- Max 5 simultaneous connections per user
- Max 20 new connections/minute per IP
- Implemented as Socket.IO middleware with Redis counters
- Excess connections rejected with `connection_limit_exceeded` error

### Message Validation
- Zod validation on all Socket.IO handlers (`send_group_message`, `send_direct_message`)
- Same rules as REST: content max 5000 chars, groupId UUID format, images validated
- Invalid messages → emit `error` to client, message discarded

### Buffer Limits
- `maxHttpBufferSize` stays at 5MB (needed for images)
- Max 5 images per message (consistent with REST)

---

## 5. Miscellaneous Fixes

### CORS Production
- `localhost:3000` allowed only when `NODE_ENV !== 'production'`
- Remove hardcoded localhost from production CORS origins

### Password Reset Token Hashing
- SHA-256 hash before saving to DB (`passwordResetToken` field stores hash, not plaintext)
- On reset: user sends plaintext token, server hashes with SHA-256 and does DB lookup
- No change to bcrypt for passwords (different use case)

### Friend Status Privacy
- `GET /api/friends/status/:userId` no longer exposes `fromUserId`
- Response returns only `status` and `requestId`

### Logging Improvements
- Remove email addresses and sensitive data from log metadata
- Add request correlation ID (UUID) via Express middleware, propagated in all logs for same request
- Sanitize error objects before logging (strip stack traces in production)

---

## Files Affected (estimated)

### New Files
- `backend/src/middleware/admin.ts` — admin/moderator middleware
- `backend/src/routes/admin.routes.ts` — admin endpoints
- `backend/src/utils/sanitize.ts` — sanitization utility
- `backend/src/middleware/correlationId.ts` — request ID middleware
- `backend/scripts/admin-create.ts` — CLI script for admin promotion

### Modified Files
- `backend/prisma/schema.prisma` — Role enum, role field on User
- `backend/src/utils/jwt.ts` — include role in JWT payload
- `backend/src/middleware/auth.ts` — fix verifiedMiddleware async, extract role from JWT
- `backend/src/routes/import.routes.ts` — add adminMiddleware
- `backend/src/routes/post.routes.ts` — sanitize input
- `backend/src/routes/message.routes.ts` — sanitize input
- `backend/src/services/post.service.ts` — sanitize before save
- `backend/src/services/auth.service.ts` — token blacklist on logout/password change, SHA-256 reset tokens
- `backend/src/routes/auth.routes.ts` — rate limiter fixes
- `backend/src/socket/chatHandler.ts` — Zod validation, connection rate limiting, reauthenticate event
- `backend/src/routes/friend.routes.ts` — remove fromUserId from response
- `backend/src/index.ts` — CORS fix, correlation ID middleware, Socket.IO connection limiting
- `backend/src/utils/logger.ts` — sanitize sensitive data, correlation ID support
- `backend/src/utils/imageValidation.ts` — block SVG, enforce MIME check order
- `backend/package.json` — add sanitize-html dependency, admin:create script
- `frontend/lib/socket.ts` — socket reauthenticate on token refresh

### New Migration
- Add `role` field to User table with default `USER`
