# Share Opportunity — Piano di Implementazione

**Spec di riferimento:** `2026-05-26-share-opportunity-design.md`  
**Data:** 2026-05-26  
**Branch:** PF-104

---

## Contesto tecnico rilevante

- `ShareOpportunityModal.tsx` — componente da sostituire; usa `/messages/conversations` (bug)
- `OpportunityMessageCard.tsx` — già gestisce il rendering in chat dei messaggi OPPORTUNITY (fetch client-side di `/opportunities/:id`); nessuna modifica backend necessaria
- `GET /api/friends` — ritorna array `{ id, name, surname, avatar, avatarBgColor }` dei Pathmates accettati
- `POST /api/messages` — già accetta `{ receiverId, type: 'opportunity', opportunityId }`
- `networking/page.tsx:1502` — renderizza `<OpportunityMessageCard>` quando `msg.type === 'OPPORTUNITY'`

---

## Step 1 — Crea `ShareSheet.tsx`

**File:** `frontend/components/ShareSheet.tsx`  
**Sostituisce:** `ShareOpportunityModal.tsx`

### Props

```ts
interface Props {
  isOpen: boolean;
  onClose: () => void;
  opportunityId: string;
  opportunityTitle: string;
  opportunityDescription?: string; // per il testo di condivisione esterna
}
```

### Struttura UI

Bottom sheet con stile coerente con gli altri modal dell'app (`borderRadius: 24`, sfondo `#fbf8ff`, backdrop blur).

```
┌─────────────────────────────────┐
│ Header: titolo + X              │
├─────────────────────────────────┤
│ [Condividi su... / Copia link]  │  ← pulsante singolo, label dinamica
├─────────────────────────────────┤
│ Condividi con un amico          │
│ ┌─────────────────────────────┐ │
│ │ 🔍 Cerca un amico...        │ │
│ └─────────────────────────────┘ │
│  Avatar  Nome Cognome    →      │
│  Avatar  Nome Cognome    →      │
│  ...                            │
└─────────────────────────────────┘
```

### Logica condivisione esterna

```ts
const appUrl = `${window.location.origin}/opportunities/${opportunityId}`;
const canShare = typeof navigator !== 'undefined' && !!navigator.share;

const handleExternalShare = async () => {
  if (canShare) {
    try {
      await navigator.share({
        title: opportunityTitle,
        text: opportunityDescription
          ? `${opportunityTitle}\n${opportunityDescription}`
          : opportunityTitle,
        url: appUrl,
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') showToast('Errore nella condivisione', 'error');
    }
  } else {
    await navigator.clipboard.writeText(appUrl);
    showToast('Link copiato negli appunti', 'success');
  }
};
```

**Label pulsante:** `canShare ? 'Condividi su...' : 'Copia link'`  
**Icona:** lucide `Share2` (mobile) / lucide `Copy` (desktop fallback)

### Logica lista amici

```ts
// fetch al mount quando isOpen === true
const [friends, setFriends] = useState([]);
useEffect(() => {
  if (!isOpen) return;
  api.get('/friends').then(({ data }) => setFriends(data)).catch(() => setFriends([]));
}, [isOpen]);
```

Filtro ricerca locale su `name + surname`.

**Empty state:** "Non hai ancora amici su COhA"

### Logica invio in-app

Invariata rispetto al modal attuale:
```ts
await api.post('/messages', { receiverId, type: 'opportunity', opportunityId });
```
Errore 403 → toast "Questo utente non accetta messaggi"  
Doppio invio → `sending` flag sul pulsante

### Gestione history (back gesture)

Stessa logica del modal attuale: `pushState` all'apertura, listener `popstate` alla chiusura.

---

## Step 2 — Aggiorna `opportunities/[id]/page.tsx`

**File:** `frontend/app/(main)/opportunities/[id]/page.tsx`

1. Sostituisci import `ShareOpportunityModal` → `ShareSheet`
2. Aggiungi `opportunityDescription` alle props passate (usa il campo `descriptionIt || description` dell'opportunità, troncato a 150 caratteri)
3. Il pulsante share esistente (riga ~639) rimane invariato — cambia solo il componente che apre

```tsx
// Prima
<ShareOpportunityModal isOpen={showShareModal} onClose={...} opportunityId={...} opportunityTitle={...} />

// Dopo
<ShareSheet
  isOpen={showShareModal}
  onClose={() => setShowShareModal(false)}
  opportunityId={opportunity.id}
  opportunityTitle={opportunity.title}
  opportunityDescription={(opportunity.descriptionIt || opportunity.description || '').slice(0, 150)}
/>
```

---

## Step 3 — Rimuovi `ShareOpportunityModal.tsx`

**File:** `frontend/components/ShareOpportunityModal.tsx`  
Cancella il file dopo aver verificato che non ci siano altri import.

```bash
grep -r "ShareOpportunityModal" frontend/ --include="*.tsx" --include="*.ts"
```

---

## Ordine di esecuzione

| # | Step | File | Note |
|---|---|---|---|
| 1 | Crea `ShareSheet.tsx` | `components/ShareSheet.tsx` | Nuovo componente |
| 2 | Aggiorna pagina opportunità | `app/(main)/opportunities/[id]/page.tsx` | Cambia import e props |
| 3 | Verifica no altri import | grep | Prima di cancellare |
| 4 | Rimuovi `ShareOpportunityModal.tsx` | `components/ShareOpportunityModal.tsx` | |
| 5 | Test manuale | — | Vedi checklist sotto |

---

## Checklist test manuale

- [ ] Pulsante share apre il bottom sheet
- [ ] Su mobile: "Condividi su..." lancia il native share sheet
- [ ] Su desktop: "Copia link" copia l'URL e mostra toast
- [ ] Lista amici mostra i Pathmates (non le conversazioni)
- [ ] Ricerca filtra correttamente per nome
- [ ] Invio a un amico: appare il messaggio in chat come card opportunità
- [ ] Invio a utente con privacy disabilitata: toast errore
- [ ] Back gesture / swipe chiude il bottom sheet
- [ ] Empty state se non si hanno amici

---

## File non toccati

- `backend/` — nessuna modifica necessaria
- `OpportunityMessageCard.tsx` — già funzionante, nessuna modifica
- `networking/page.tsx` — nessuna modifica
