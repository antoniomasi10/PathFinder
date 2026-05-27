# Persistent Session with 7-Day Sliding Window

**Date:** 2026-05-27  
**Status:** Approved

## Context

Every time a user reopens the PWA (including from the iOS home screen shortcut), they are forced to log in again even if they used the app minutes earlier. This creates significant friction, especially for users who have added COhA to their home screen and expect app-like behavior.

The root cause is that the refresh token cookie is saved without an explicit `expires` field, making it a *session cookie*. Browsers and PWA containers on iOS/Android delete session cookies when the app is closed. Additionally, there is a maxAge mismatch between the backend (14 days) and the BFF layer (7 days), causing premature expiry.

## Goal

Users stay logged in as long as they use the app at least once every 7 days. If 7 days pass without any app usage, they are asked to log in again.

## Design

### Sliding Window Mechanism

The sliding window is already implemented via **token rotation**: every time the refresh endpoint is called, a new refresh token is issued and the old one is blacklisted. By setting each new cookie with a fresh `expires` of +7 days from the current time, the window automatically resets on every app use.

No changes are needed to AuthProvider, the Axios interceptor, or the token rotation logic.

### Changes Required

**1. Backend — `backend/src/controllers/auth.controller.ts`**

Where the `refreshToken` cookie is set (both on login and on refresh):
- Change `maxAge` from `14 * 24 * 60 * 60 * 1000` to `7 * 24 * 60 * 60 * 1000`
- Add `expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)` to the cookie options

This ensures the backend always issues a 7-day persistent cookie.

**2. Backend — `backend/src/utils/jwt.ts`**

Change the refresh token JWT expiry from `'14d'` to `'7d'` so the token lifetime matches the cookie lifetime.

**3. Frontend BFF — `frontend/app/api/bff/_helpers.ts`**

Where the BFF re-sets the refresh cookie from the backend response:
- Keep `maxAge: 7 * 24 * 60 * 60` (already correct)
- Add `expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)`

Without `expires`, Safari and iOS PWA containers treat the cookie as a session cookie regardless of `maxAge`.

### Cookie Options Summary (final state)

```
httpOnly: true
secure: true (production)
sameSite: 'lax'
maxAge: 604800        // 7 days in seconds
expires: Date         // 7 days from now (absolute)
path: '/'
```

## Security Considerations

- Refresh tokens remain httpOnly — no XSS exposure
- Token rotation (blacklisting old tokens) is unchanged — replay attacks are still blocked
- Shortening from 14 to 7 days reduces the attack window if a refresh token is stolen
- No changes to access token lifetime (15 min)

## Verification

1. Log in on the app, then close the browser/PWA completely
2. Reopen — should land on the home page without login prompt
3. Verify the refresh token cookie in DevTools: `Expires` field should show a date ~7 days in the future
4. Verify that after using the app, the cookie `Expires` updates to a new +7 day date (sliding window)
5. Test on iOS home screen shortcut specifically
