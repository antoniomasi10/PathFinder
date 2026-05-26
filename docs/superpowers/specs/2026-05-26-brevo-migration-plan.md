# Brevo Migration — Piano di Implementazione
**Data:** 2026-05-26  
**Spec di riferimento:** `2026-05-26-brevo-migration-design.md`  
**Branch:** da creare da `develop`

---

## Step 1 — `backend/src/services/brevo.service.ts` (nuovo)

Creare il file che sostituisce `oneSignal.service.ts`. Espone:
- `isBrevoConfigured()` — verifica che `BREVO_API_KEY` sia settata
- `sendEmailToUser(userId, subject, html)` — lookup email da DB, chiama `POST /v3/smtp/email`
- `sendEmailToUsers(userIds, subject, html)` — bulk con chunk da 1000, usa email da DB
- `sendPushToUser(userId, payload)` — lookup `brevoSubscriberId` da DB, chiama Brevo Web Push API
- `sendPushToUsers(userIds, payload)` — bulk push con chunk

Helper interno `callBrevoEmail(to, subject, html)` e `callBrevoMail` per non duplicare la logica fetch.

---

## Step 2 — `backend/src/services/email.service.ts` (riscrittura)

Rimuovere nodemailer. Sostituire il transporter con una funzione `sendBrevoEmail(to, subject, html)` che chiama `POST https://api.brevo.com/v3/smtp/email`.

Le 4 funzioni pubbliche (`sendVerificationEmail`, `sendPasswordResetEmail`, `sendContactEmail`, `sendReportEmail`) mantengono firma identica — solo l'invio interno cambia.

Rimuovere `nodemailer` da `backend/package.json`.

---

## Step 3 — `backend/src/services/emailCampaigns.service.ts` (import swap)

Riga 11: cambiare  
`import { sendEmailToUser } from './oneSignal.service'`  
→ `import { sendEmailToUser } from './brevo.service'`

---

## Step 4 — `backend/src/services/auth.service.ts` (pulizia)

- Rimuovere `import { registerEmailPlayer } from './oneSignal.service'`
- Rimuovere chiamata a `registerEmailPlayer` a riga ~166
- Rimuovere chiamata a `registerEmailPlayer` a riga ~340

---

## Step 5 — `backend/src/routes/notification.routes.ts` (aggiornamento)

- Rimuovere `import * as oneSignalService from '../services/oneSignal.service'`
- Rimuovere `import * as webPushService from '../services/webPush.service'`
- Aggiungere `import * as brevoService from '../services/brevo.service'`
- Rimuovere route `POST /push/onesignal-register`
- Aggiungere route `POST /push/brevo-register` che salva `brevoSubscriberId` su User
- Aggiornare `POST /push/test`: verifica `brevoService.isBrevoConfigured()`, legge `brevoSubscriberId`, chiama `brevoService.sendPushToUser`
- Aggiornare `GET /push/status`: espone `brevoConfigured` e `brevoSubscriberId` invece dei campi OneSignal
- Rimuovere route `GET /push/vapid-key`, `POST /push/subscribe`, `DELETE /push/unsubscribe` (erano per VAPID nativo)

---

## Step 6 — Prisma schema + migration

Modificare `backend/prisma/schema.prisma`:
- Modello `User`: rimuovere `oneSignalPlayerId String?` e `oneSignalEmailPlayerId String?`, aggiungere `brevoSubscriberId String?`
- Rimuovere il modello `PushSubscription` completo

Eseguire:
```bash
cd backend && npx prisma migrate dev --name brevo-migration
```

---

## Step 7 — Eliminare file backend obsoleti

- `rm backend/src/services/oneSignal.service.ts`
- `rm backend/src/services/webPush.service.ts`

---

## Step 8 — `frontend/lib/brevoManager.ts` (nuovo)

Sostituisce `oneSignalManager.ts`. Gestisce:
- Caricamento SDK Brevo Web Push (via `window` global iniettata dallo script esterno)
- `initBrevo()` — idempotente, inizializza SDK con `NEXT_PUBLIC_BREVO_APP_ID`
- `requestBrevoPermission()` — richiede consenso, ottiene `subscriberId`, chiama `POST /notifications/push/brevo-register`
- `getBrevoSnapshot()` — stato corrente per pagina diagnostica
- `optOutBrevo()` — unsubscribe device corrente
- Log diagnostico con stessa struttura di `oneSignalManager.ts` (stesso formato `PushDiagnostic`)

---

## Step 9 — `frontend/lib/pushManager.ts` (import swap)

Aggiornare import:
```ts
// Prima:
import { isOneSignalAvailable, initOneSignal, requestOneSignalPermission, optOutOneSignal } from '@/lib/oneSignalManager'

// Dopo:
import { isBrevoAvailable, initBrevo, requestBrevoPermission, optOutBrevo } from '@/lib/brevoManager'
```

Aggiornare le funzioni interne che chiamano queste (4 righe di cambio nomi).

---

## Step 10 — `frontend/app/layout.tsx`

Sostituire:
```tsx
<Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" ... />
```
con lo script SDK Brevo Web Push (URL da dashboard Brevo).

---

## Step 11 — `frontend/next.config.js` (CSP)

Nei blocchi `script-src`, `style-src`, `connect-src`:
- Rimuovere: `https://onesignal.com`, `https://cdn.onesignal.com`, `https://*.onesignal.com`
- Aggiungere: `https://cdn.brevo.com` in `script-src`, `https://api.brevo.com` in `connect-src`

Aggiornare anche la route rewrite per il service worker:
```js
// Prima:
{ source: '/OneSignalSDKWorker.js', destination: '/OneSignalSDKWorker.js' }

// Dopo: rimuovere o aggiornare con path service worker Brevo
```

---

## Step 12 — Frontend pulizia file

- `rm frontend/lib/oneSignalManager.ts`
- `rm frontend/public/OneSignalSDKWorker.js`
- Aggiungere service worker Brevo in `frontend/public/` (file fornito da Brevo dashboard)

---

## Step 13 — Variabili d'ambiente

**`backend/.env`:**
- Aggiungere: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`
- Rimuovere: `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`

**`frontend/.env.local`:**
- Aggiungere: `NEXT_PUBLIC_BREVO_APP_ID`
- Rimuovere: `NEXT_PUBLIC_ONESIGNAL_APP_ID`

Aggiornare `backend/.env.example` e `frontend/.env.example` se esistono.

---

## Checklist finale

- [ ] `brevo.service.ts` — email e push funzionanti
- [ ] `email.service.ts` — nodemailer rimosso, Brevo API usata
- [ ] `emailCampaigns.service.ts` — import aggiornato
- [ ] `auth.service.ts` — `registerEmailPlayer` rimosso
- [ ] `notification.routes.ts` — route aggiornate, vecchi import rimossi
- [ ] Prisma migration applicata — campo `brevoSubscriberId` presente, `PushSubscription` droppata
- [ ] `oneSignal.service.ts` eliminato
- [ ] `webPush.service.ts` eliminato
- [ ] `brevoManager.ts` — init, permission request, snapshot, opt-out
- [ ] `pushManager.ts` — import aggiornati
- [ ] `layout.tsx` — script Brevo caricato
- [ ] `next.config.js` — CSP aggiornata
- [ ] `oneSignalManager.ts` eliminato
- [ ] Service worker Brevo in `public/`
- [ ] Env vars aggiornate
- [ ] `nodemailer` rimosso da `backend/package.json`
