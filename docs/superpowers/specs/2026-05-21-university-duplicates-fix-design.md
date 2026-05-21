# Fix: Università duplicate nella schermata di registrazione

**Data:** 2026-05-21
**Branch:** fix/university-duplicates

---

## Problema

La schermata di registrazione mostra università duplicate nella dropdown di selezione. La stessa università appare due volte — una volta con ID UUID (dal seed), una volta con ID `mur-XXXXX` (dall'import MUR).

### Causa radice

Due sorgenti dati separate creano le stesse università senza alcun vincolo di unicità sul nome:

- **`seed.ts`**: crea università con ID UUID auto-generati, `sourceId: null`, dati ricchi (description, alumniCount, avgRating)
- **`mur.import.ts`**: upsert keyed su `id` con `id = 'mur-XXXXX'` — non coincide mai con i record del seed, quindi crea record separati

Il modello `University` non ha `@unique` su `name`, quindi i duplicati coesistono silenziosamente nel DB. La `GET /universities` li restituisce entrambi.

---

## Soluzione

Approccio A: aggiungere `@unique` su `name` + cleanup dei duplicati esistenti + MUR import aggiornato.

### Componenti

#### 1. Script di cleanup (`backend/scripts/cleanup-university-duplicates.ts`)

- Recupera tutte le università
- Raggruppa per nome normalizzato (lowercase) per identificare i duplicati
- Per ogni gruppo con >1 record:
  - **Mantiene** il record senza `sourceId` (versione seed, dati più ricchi)
  - Riassegna `users`, `courses`, `opportunities` dalla versione MUR a quella seed via `updateMany`
  - Elimina il record MUR
- Log dettagliato di ogni operazione (università mantenuta, eliminata, relazioni spostate)

Eseguito manualmente sia in locale che in produzione prima del deploy della migration.

#### 2. Migration Prisma

Modifica al modello `University` in `schema.prisma`:

```prisma
model University {
  name  String  @unique   // aggiunto
  // ... resto invariato
}
```

Eseguita con `npx prisma migrate dev --name add-university-name-unique` dopo il cleanup.

#### 3. MUR import (`backend/src/services/import/mur.import.ts`)

Aggiunta di un helper di normalizzazione:
```ts
function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}
```

Cambio dell'upsert da keyed su `id` a keyed su `name`:
```ts
// PRIMA
await prisma.university.upsert({
  where: { id: sid },
  create: { id: sid, name: ..., city: ..., sourceId: sid, ... },
});

// DOPO
const normalizedName = normalizeName(name);
await prisma.university.upsert({
  where: { name: normalizedName },
  update: { city: validated.city, isActive: true, sourceId: sid, lastSyncedAt: now },
  create: { name: normalizedName, city: validated.city, country: 'Italia', sourceId: sid, lastSyncedAt: now },
});
```

La prima esecuzione post-deploy **aggiorna** i record seed esistenti aggiungendo `sourceId` e `lastSyncedAt`, senza creare duplicati.

---

## Ordine di esecuzione

1. `ts-node backend/scripts/cleanup-university-duplicates.ts` — locale e produzione
2. `npx prisma migrate dev` (locale) → `npx prisma migrate deploy` (produzione)
3. Deploy backend con MUR import aggiornato

---

## Componenti non modificati

- `frontend/app/register/page.tsx` — nessuna modifica necessaria
- `backend/src/routes/university.routes.ts` — nessuna modifica necessaria
- `seed.ts` — già protetto da guardia produzione, già esegue `deleteMany` prima di inserire

---

## Rischi

- **Nomi MUR diversi dal seed**: se il CSV MUR usa formattazioni diverse (es. maiuscole extra), il `normalizeName` di base (trim + collapse whitespace) potrebbe non essere sufficiente. Da verificare sui dati reali durante il cleanup.
- **Migration fallisce se cleanup incompleto**: il `@unique` su `name` rifiuta la migration se esistono ancora duplicati — il cleanup deve essere eseguito prima e verificato.
