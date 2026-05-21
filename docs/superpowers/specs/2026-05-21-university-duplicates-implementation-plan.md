# Piano di implementazione: Fix università duplicate

**Spec di riferimento:** `docs/superpowers/specs/2026-05-21-university-duplicates-fix-design.md`
**Branch:** fix/university-duplicates

---

## Step 1 — Script di cleanup dei duplicati

**File:** `backend/scripts/cleanup-university-duplicates.ts` (nuovo)

Creare lo script con la seguente logica:

1. Recuperare tutte le università con `prisma.university.findMany()`
2. Raggruppare per `name.trim().toLowerCase()` per trovare i duplicati
3. Per ogni gruppo con più di un record:
   - Identificare il record da **mantenere**: quello con `sourceId === null` (versione seed); se non esiste, tenere il primo per ordine di creazione
   - Identificare i record da **eliminare**: tutti gli altri del gruppo
   - Per ogni record da eliminare:
     - `prisma.user.updateMany({ where: { universityId: toDelete.id }, data: { universityId: toKeep.id } })`
     - `prisma.course.updateMany({ where: { universityId: toDelete.id }, data: { universityId: toKeep.id } })`
     - `prisma.opportunity.updateMany({ where: { universityId: toDelete.id }, data: { universityId: toKeep.id } })`
     - `prisma.university.delete({ where: { id: toDelete.id } })`
   - Loggare: nome università, ID mantenuto, ID/i eliminati, numero relazioni spostate
4. Loggare il totale: quanti gruppi duplicati trovati, quanti record eliminati

Aggiungere script `package.json` nel backend: `"cleanup:universities": "ts-node scripts/cleanup-university-duplicates.ts"`

---

## Step 2 — Modifica schema Prisma e migration

**File:** `backend/prisma/schema.prisma`

Modificare il modello `University`:
```prisma
name  String  @unique
```
(sostituisce `name  String`)

Eseguire:
```bash
npx prisma migrate dev --name add-university-name-unique
```

Verificare che la migration venga generata correttamente in `backend/prisma/migrations/`.

---

## Step 3 — Aggiornamento MUR import

**File:** `backend/src/services/import/mur.import.ts`

### 3a. Aggiungere helper `normalizeName`

Aggiungere subito dopo le costanti CSV URL:
```ts
function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}
```

### 3b. Aggiornare la funzione `importUniversities`

Sostituire il blocco upsert (righe ~107-124) con:
```ts
const normalizedName = normalizeName(name);

await prisma.university.upsert({
  where: { name: normalizedName },
  update: {
    city: validated.city,
    isActive: true,
    sourceId: sid,
    lastSyncedAt: now,
  },
  create: {
    name: normalizedName,
    city: validated.city,
    country: 'Italia',
    sourceId: sid,
    lastSyncedAt: now,
  },
});
```

Notare: rimossa la riga `id: sid` dal blocco `create` — Prisma usa il default `uuid()`.

---

## Step 4 — Invalidare la cache università

**File:** `backend/src/routes/university.routes.ts`

Dopo il deploy, la cache Redis con chiave `cache:universities:all` (TTL 1 ora) potrebbe ancora servire la lista vecchia con duplicati. Verificare se esiste un modo per forzare l'invalidazione (es. riavvio del backend è sufficiente se la cache è in-memory, oppure eseguire `DEL cache:universities:all` su Redis se è persistente).

---

## Ordine di esecuzione in locale

```bash
# 1. Eseguire cleanup
cd backend && npm run cleanup:universities

# 2. Applicare migration
npx prisma migrate dev --name add-university-name-unique

# 3. Riavviare il backend e verificare che /api/universities non restituisca duplicati
npm run dev:backend
```

## Ordine di esecuzione in produzione

```bash
# 1. Eseguire cleanup sul DB di produzione
# (con DATABASE_URL di produzione)
DATABASE_URL=<prod-url> ts-node backend/scripts/cleanup-university-duplicates.ts

# 2. Deploy della migration
npx prisma migrate deploy

# 3. Deploy del backend aggiornato
```

---

## Verifica

- `GET /api/universities` non restituisce nomi duplicati
- Un nuovo utente può registrarsi selezionando un'università senza vedere duplicati
- Il MUR import (prossima esecuzione schedulata) aggiorna i record esistenti senza crearne di nuovi
- Lo schema del DB ha il constraint `UNIQUE` sulla colonna `name` della tabella `University`
