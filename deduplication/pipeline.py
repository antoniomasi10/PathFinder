"""
Pipeline di deduplicazione a 3 livelli.

Flusso:
  1. Fingerprint hash  — raggruppa duplicati certi (stesso titolo/azienda/paese normalizzati)
  2. Fuzzy match        — trova probabili duplicati tra le rimanenti (stessa azienda, titolo simile)
  3. Embedding semantici — conferma finale sulle coppie candidate dal livello 2

Regole aggiuntive:
  - Finestra temporale: offerte con data_pubblicazione distante > 90 giorni
    non vengono mai unite, anche se identiche nel contenuto.
  - Master record: per ogni gruppo di duplicati, il record con la descrizione
    piu' lunga diventa la base, con un campo `fonti` che elenca tutte le sorgenti.
"""

import logging
from collections import defaultdict
from datetime import datetime

from .fingerprint import genera_fingerprint
from .fuzzy_match import sono_duplicati_fuzzy, _parse_data
from .semantic import sono_duplicati_semantici, embedding_disponibile

logger = logging.getLogger(__name__)

# Offerte con data_pubblicazione distante piu' di 90 giorni non vengono mai unite.
_MAX_DISTANZA_GIORNI_MERGE = 90


def _entro_finestra_temporale(a: dict, b: dict) -> bool:
    """Controlla se due offerte sono entro la finestra temporale di 90 giorni."""
    da = _parse_data(a.get("data_pubblicazione"))
    db = _parse_data(b.get("data_pubblicazione"))
    if da is None or db is None:
        # Se manca una data, non possiamo escludere il merge
        return True
    return abs((da - db).days) <= _MAX_DISTANZA_GIORNI_MERGE


def _crea_fonte(offerta: dict) -> dict:
    """Estrae i metadati di sorgente da un'offerta."""
    return {
        "sorgente": offerta.get("sorgente", ""),
        "id_esterno": offerta.get("id_esterno", ""),
        "sorgente_url": offerta.get("sorgente_url", ""),
        "data_scraping": offerta.get("data_scraping", ""),
    }


def _crea_master(gruppo: list[dict]) -> dict:
    """Crea un master record da un gruppo di offerte duplicate.

    Sceglie come base il record con la descrizione piu' lunga,
    poi aggiunge il campo `fonti` con tutte le sorgenti.
    """
    # Ordina per lunghezza descrizione decrescente
    gruppo.sort(key=lambda o: len(o.get("descrizione") or ""), reverse=True)
    master = dict(gruppo[0])
    master["fonti"] = [_crea_fonte(o) for o in gruppo]
    return master


class _UnionFind:
    """Struttura Union-Find per raggruppare efficientemente gli indici duplicati."""

    def __init__(self, n: int) -> None:
        self._parent = list(range(n))
        self._rank = [0] * n

    def find(self, x: int) -> int:
        while self._parent[x] != x:
            self._parent[x] = self._parent[self._parent[x]]
            x = self._parent[x]
        return x

    def union(self, x: int, y: int) -> None:
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return
        if self._rank[rx] < self._rank[ry]:
            rx, ry = ry, rx
        self._parent[ry] = rx
        if self._rank[rx] == self._rank[ry]:
            self._rank[rx] += 1


def deduplica(offerte: list[dict]) -> list[dict]:
    """Deduplica una lista di offerte usando la pipeline a 3 livelli.

    Args:
        offerte: lista di dizionari, ciascuno con almeno "id_esterno", "sorgente", "titolo".

    Returns:
        Lista di master record deduplicati, ciascuno con un campo `fonti`
        che elenca tutte le sorgenti originali.
    """
    if not offerte:
        return []

    n = len(offerte)
    logger.info("Pipeline deduplicazione: %d offerte in ingresso", n)

    uf = _UnionFind(n)

    # ── Livello 1: Fingerprint hash ──────────────────────────────────────
    # Raggruppa le offerte con fingerprint identico.
    fp_map: dict[str, list[int]] = defaultdict(list)
    for i, offerta in enumerate(offerte):
        fp = genera_fingerprint(offerta)
        fp_map[fp].append(i)

    duplicati_fp = 0
    for indici in fp_map.values():
        if len(indici) > 1:
            for j in indici[1:]:
                if _entro_finestra_temporale(offerte[indici[0]], offerte[j]):
                    uf.union(indici[0], j)
                    duplicati_fp += 1

    logger.info("Livello 1 (fingerprint): %d duplicati trovati", duplicati_fp)

    # ── Livello 2: Fuzzy match ───────────────────────────────────────────
    # Raggruppa per azienda normalizzata, poi confronta a coppie dentro ogni gruppo.
    from .fingerprint import _normalizza_testo

    azienda_map: dict[str, list[int]] = defaultdict(list)
    for i, offerta in enumerate(offerte):
        az = _normalizza_testo(offerta.get("azienda"))
        if az:
            azienda_map[az].append(i)

    candidati_semantici: list[tuple[int, int]] = []
    duplicati_fuzzy = 0

    for indici in azienda_map.values():
        if len(indici) < 2:
            continue
        for ii in range(len(indici)):
            for jj in range(ii + 1, len(indici)):
                i, j = indici[ii], indici[jj]
                # Gia' nello stesso gruppo? Salta.
                if uf.find(i) == uf.find(j):
                    continue
                # Fuori finestra temporale? Salta.
                if not _entro_finestra_temporale(offerte[i], offerte[j]):
                    continue
                if sono_duplicati_fuzzy(offerte[i], offerte[j]):
                    # Candidato per il Livello 3
                    candidati_semantici.append((i, j))
                    duplicati_fuzzy += 1

    logger.info("Livello 2 (fuzzy): %d coppie candidate", duplicati_fuzzy)

    # ── Livello 3: Embedding semantici ───────────────────────────────────
    # Applicato solo sui candidati dal Livello 2.
    duplicati_semantici = 0

    if candidati_semantici and embedding_disponibile():
        for i, j in candidati_semantici:
            if uf.find(i) == uf.find(j):
                continue
            if sono_duplicati_semantici(offerte[i], offerte[j]):
                uf.union(i, j)
                duplicati_semantici += 1
        logger.info("Livello 3 (semantico): %d duplicati confermati", duplicati_semantici)
    elif candidati_semantici:
        # Embedding non disponibile: unisci comunque i candidati fuzzy
        # (il Livello 2 e' gia' abbastanza affidabile)
        for i, j in candidati_semantici:
            uf.union(i, j)
        duplicati_semantici = len(candidati_semantici)
        logger.info(
            "Livello 3 (semantico): non disponibile, uniti %d candidati fuzzy direttamente",
            duplicati_semantici,
        )

    # ── Creazione master records ─────────────────────────────────────────
    gruppi: dict[int, list[int]] = defaultdict(list)
    for i in range(n):
        gruppi[uf.find(i)].append(i)

    risultati: list[dict] = []
    for indici in gruppi.values():
        gruppo = [offerte[i] for i in indici]
        risultati.append(_crea_master(gruppo))

    logger.info(
        "Pipeline completata: %d offerte -> %d uniche (%d rimosse)",
        n, len(risultati), n - len(risultati),
    )
    return risultati
