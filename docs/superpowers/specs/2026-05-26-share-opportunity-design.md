# Share Opportunity — Design Spec

**Data:** 2026-05-26  
**Branch:** PF-104  

---

## Problema

Il pulsante "condividi" nella schermata opportunità presenta due problemi:

1. **Bug in-app:** il modal mostra solo utenti con cui l'utente ha già conversazioni attive (`/messages/conversations`). Gli amici (Pathmates) con cui non si è mai chattato non compaiono.
2. **Mancanza condivisione esterna:** non è possibile condividere l'opportunità su WhatsApp, AirDrop, Messaggi, ecc.

---

## Soluzione

Sostituire `ShareOpportunityModal.tsx` con un nuovo `ShareSheet.tsx` — un bottom sheet con due sezioni: condivisione esterna via Web Share API e condivisione in-app con i propri Pathmates.

---

## Architettura & Componenti

Il componente `ShareOpportunityModal.tsx` viene rimosso e sostituito da `ShareSheet.tsx`. La pagina `/app/(main)/opportunities/[id]/page.tsx` istanzia il nuovo componente al posto del vecchio.

```
ShareSheet
├── Header (titolo opportunità + pulsante X)
├── Sezione "Condividi esternamente"
│   └── Pulsante → navigator.share() oppure copia link negli appunti
└── Sezione "Condividi con un amico"
    ├── Barra di ricerca (filtra in locale)
    └── Lista Pathmates (fetch da GET /api/friends?status=accepted)
```

---

## Sezione 1 — Fix condivisione in-app

**Lista utenti:** il `ShareSheet` chiama `GET /api/friends?status=accepted` per ottenere i Pathmates. Ogni voce mostra avatar + nome + cognome. La ricerca filtra in locale per nome.

**Invio messaggio:** invariato rispetto all'attuale — POST `/messages` con `{ receiverId, type: 'opportunity', opportunityId }`.

**Contenuto messaggio in chat:** aggiornare il fetch dei messaggi nel backend per includere i dati dell'opportunità collegata (join su `opportunityId`). La chat renderizza una card:

```
┌─────────────────────────────┐
│ 📎 Opportunità condivisa     │
│ [Titolo]                     │
│ [Descrizione breve, 2 righe] │
│ → Vedi opportunità           │
└─────────────────────────────┘
```

I messaggi OPPORTUNITY privi di dati joined mostrano il fallback testuale "📎 Opportunità condivisa" (retrocompatibilità garantita).

---

## Sezione 2 — Condivisione esterna (Web Share API)

```ts
navigator.share({
  title: opportunityTitle,
  text: `${opportunityTitle}\n${opportunityDescription}`,
  url: `https://app.coha.it/opportunities/${opportunityId}`
})
```

Il sistema operativo apre il native share sheet (WhatsApp, AirDrop, Messaggi, Mail, ecc.) senza librerie esterne.

**Fallback desktop:** se `navigator.share` non è disponibile, il pulsante copia il link negli appunti e mostra il toast "Link copiato negli appunti".

**Label dinamica:**
- Mobile (share API disponibile): "Condividi su..."
- Desktop (share API assente): "Copia link"

**Annullamento utente:** la promise di `navigator.share()` rigetta con `AbortError` — catturato silenziosamente, nessun toast di errore.

---

## Sezione 3 — Gestione errori & edge cases

| Caso | Comportamento |
|---|---|
| Nessun Pathmate | Messaggio vuoto: "Non hai ancora amici su COhA" |
| Pathmate con `messagePrivacy` disabilitato | Backend risponde 403 → toast "Questo utente non accetta messaggi" |
| Doppio invio | Pulsante disabilitato durante la chiamata API |
| `navigator.share()` annullato | `AbortError` catturato silenziosamente |
| Opportunità senza URL esterno | Condivisione esterna usa sempre il link interno all'app |

---

## File coinvolti

### Frontend
- `frontend/components/ShareOpportunityModal.tsx` — **rimosso**
- `frontend/components/ShareSheet.tsx` — **nuovo**
- `frontend/app/(main)/opportunities/[id]/page.tsx` — aggiorna import e uso
- `frontend/app/(main)/messages/[id]/page.tsx` (o componente chat) — aggiorna rendering messaggi OPPORTUNITY

### Backend
- `backend/src/routes/message.routes.ts` — aggiunge join su `opportunity` nel GET messaggi per includere titolo e descrizione

---

## Fuori scope

- Condivisione di altri tipi di contenuto (post, profili)
- Deep link con autenticazione
- Tracking analitico della condivisione esterna
