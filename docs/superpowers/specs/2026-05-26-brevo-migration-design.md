# Brevo Migration Design
**Data:** 2026-05-26  
**Branch:** da creare da `develop`  
**Scope:** Sostituzione completa di OneSignal con Brevo per email transazionali, email marketing e notifiche push web

---

## Contesto

COhA usava OneSignal come provider per:
- Email marketing (weekly digest, expiring alert, daily opportunity, spot recommendation) — via `oneSignal.service.ts`
- Notifiche push web — via OneSignal SDK nel frontend + `oneSignalPlayerId` sul DB

In parallelo esisteva un sistema VAPID nativo (`webPush.service.ts` + tabella `PushSubscription`) non usato dal frontend e considerato codice morto.

Le email transazionali (verifica account, reset password, contatti, segnalazioni) usavano nodemailer con SMTP.

Il provider è stato cambiato a **Brevo**. Questa migration porta tutto su Brevo: email transazionali via Brevo API, email marketing via Brevo API, push via Brevo Web Push SDK.

---

## Architettura post-migrazione

### Canali email
| Tipo | Mittente | Destinatario | API |
|---|---|---|---|
| Transazionale (verifica, reset, contatti) | `email.service.ts` | email utente diretta | Brevo `/v3/smtp/email` |
| Marketing (digest, alert, spot) | `emailCampaigns.service.ts` → `brevo.service.ts` | email utente diretta | Brevo `/v3/smtp/email` |

Con Brevo non serve più registrare un "email player" — l'email dell'utente è sufficiente come identificatore. I campi `oneSignalEmailPlayerId` vengono rimossi.

### Canale push
Il frontend carica Brevo Web Push SDK. Al consenso, il SDK registra silenziosamente il device e restituisce un `subscriberId`. Il frontend lo invia al backend via `POST /notifications/push/brevo-register`, che lo salva su `User.brevoSubscriberId`. Il backend usa questo ID per notifiche push mirate via Brevo API.

**Utenti con push già attive:** nessuna re-approvazione richiesta. Se `Notification.permission === 'granted'`, Brevo SDK ri-registra il device silenziosamente al primo caricamento post-deploy. Le vecchie sottoscrizioni OneSignal diventano inattive ma vengono sostituite automaticamente.

---

## Componenti coinvolti

### Backend — file modificati

**`services/brevo.service.ts`** *(nuovo, sostituisce `oneSignal.service.ts`)*  
Funzioni esposte (stessa firma dei caller esistenti):
```ts
isBrevoConfigured(): boolean
sendEmailToUser(userId: string, subject: string, html: string): Promise<void>
sendEmailToUsers(userIds: string[], subject: string, html: string): Promise<void>
sendPushToUser(userId: string, payload: BrevoPayload): Promise<void>
sendPushToUsers(userIds: string[], payload: BrevoPayload): Promise<void>
```
Per email: `fetch POST https://api.brevo.com/v3/smtp/email` con `sender`, `to`, `subject`, `htmlContent`. Lookup email da DB per `sendEmailToUser`. Chunk da 1000 per `sendEmailToUsers`.  
Per push: `fetch POST https://api.brevo.com/v3/webpush/notifications` con `subscriberId` letto da `User.brevoSubscriberId`.

**`services/email.service.ts`** *(riscrittura — rimuove nodemailer)*  
Stessa interfaccia pubblica: `sendVerificationEmail`, `sendPasswordResetEmail`, `sendContactEmail`, `sendReportEmail`, `generateOTP`. Internamente usa fetch verso Brevo `/v3/smtp/email`. Rimuove la dipendenza nodemailer.

**`services/emailCampaigns.service.ts`** *(import swap)*  
`import { sendEmailToUser } from './oneSignal.service'` → `import { sendEmailToUser } from './brevo.service'`

**`services/auth.service.ts`** *(pulizia)*  
Rimuovere le due chiamate a `registerEmailPlayer` (riga ~166 e ~340). Non necessario con Brevo.

**`routes/notification.routes.ts`** *(aggiornamento route push)*
- Rimuovere `POST /push/onesignal-register` → aggiungere `POST /push/brevo-register` (salva `brevoSubscriberId` su User)
- `POST /push/test`: usa `brevo.service.sendPushToUser`
- `GET /push/status`: rimuove `oneSignalConfigured`/`oneSignalPlayerId`, espone `brevoConfigured`/`brevoSubscriberId`
- Rimuovere import di `oneSignalService` e `webPushService`

### Backend — file eliminati

- `services/oneSignal.service.ts`
- `services/webPush.service.ts` (VAPID nativo — non usato dal frontend)

### Database — migration Prisma

```prisma
// Modello User — rimuovere:
oneSignalPlayerId      String?
oneSignalEmailPlayerId String?

// Modello User — aggiungere:
brevoSubscriberId      String?
```

Droppare la tabella `PushSubscription` (VAPID nativo, codice morto).

Nessuna migrazione dati: i valori OneSignal non sono trasferibili a Brevo. Gli utenti attivi vengono ri-registrati automaticamente da Brevo SDK al primo accesso.

### Frontend — file modificati

**`lib/brevoManager.ts`** *(nuovo, sostituisce `oneSignalManager.ts`)*  
Interfaccia pubblica identica a quella usata da `pushManager.ts`:
```ts
isBrevoAvailable(): boolean
initBrevo(): Promise<void>
requestBrevoPermission(): Promise<boolean>
getBrevoSnapshot(): Promise<{ available, permission, subscriberId, optedIn }>
optOutBrevo(): Promise<void>
```
Carica Brevo SDK tramite `window.BrevoNotifications` (o equivalente SDK Brevo). Al consenso ottiene `subscriberId` e lo invia a `POST /notifications/push/brevo-register`.

**`lib/pushManager.ts`** *(import swap)*  
Aggiornare import da `oneSignalManager` a `brevoManager`. Le funzioni esposte (`subscribeToPush`, `unsubscribeFromPush`, `ensurePushInitialized`, `sendTestPush`) restano invariate — `notificationContext.tsx` non cambia.

**`app/layout.tsx`**  
Sostituire `<Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js">` con lo script SDK Brevo Web Push.

**`next.config.js`**  
Aggiornare CSP: rimuovere tutti i domini `onesignal.com` / `cdn.onesignal.com`, aggiungere domini Brevo (`cdn.brevo.com`, `api.brevo.com`) in `script-src` e `connect-src`.

### Frontend — file eliminati / sostituiti

- `lib/oneSignalManager.ts` → eliminare
- `public/OneSignalSDKWorker.js` → sostituire con service worker Brevo

---

## Variabili d'ambiente

### Backend `.env` — aggiungere
```
BREVO_API_KEY=
BREVO_SENDER_EMAIL=info@cohaapp.com
BREVO_SENDER_NAME=COhA
```

### Backend `.env` — rimuovere
```
ONESIGNAL_APP_ID
ONESIGNAL_REST_API_KEY
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_SECURE
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_EMAIL
```

### Frontend `.env.local` — aggiungere
```
NEXT_PUBLIC_BREVO_APP_ID=
```

### Frontend `.env.local` — rimuovere
```
NEXT_PUBLIC_ONESIGNAL_APP_ID
```

---

## Ordine di implementazione

1. **Backend — nuovi servizi:** scrivi `brevo.service.ts`, riscrivi `email.service.ts`
2. **Backend — aggiorna caller:** `emailCampaigns.service.ts`, `auth.service.ts`, `notification.routes.ts`
3. **Database:** migration Prisma (rimuovi campi OneSignal, droppa `PushSubscription`, aggiungi `brevoSubscriberId`)
4. **Backend — elimina vecchio codice:** `oneSignal.service.ts`, `webPush.service.ts`
5. **Frontend:** scrivi `brevoManager.ts`, aggiorna `pushManager.ts`, `layout.tsx`, `next.config.js`
6. **Frontend — pulizia:** rimuovi `oneSignalManager.ts`, sostituisci service worker
7. **Env:** aggiorna `.env`, `.env.local`, `.env.example`

---

## Rischi e note

- **Nessuna migrazione dati necessaria** per i campi OneSignal — i player ID non sono trasferibili.
- **Push per utenti già attivi:** re-registrazione automatica e silenziosa al primo accesso (permission già granted). Nessun prompt aggiuntivo.
- **Utenti inattivi post-deploy:** riceveranno push di nuovo solo alla prossima visita.
- **Email marketing non interrotte:** le campagne usano email diretta, non player ID. Zero gap.
- **Dipendenza nodemailer** rimossa completamente — verificare che `package.json` backend non abbia altri usi.
