"""
Livello 2 — Fuzzy match.

Confronta coppie di offerte usando similarita' testuale pesata.
Viene applicato solo tra offerte della stessa azienda (normalizzata)
per ridurre il numero di confronti.

Pesi:
  - similarita' titolo (token_sort_ratio)  50%
  - match paese                            25%
  - vicinanza date pubblicazione (<=30gg)  25%
"""

from datetime import datetime, timedelta

from fuzzywuzzy import fuzz  # type: ignore[import-untyped]

from .fingerprint import _normalizza_testo

# Soglia sopra la quale due offerte sono considerate duplicati fuzzy.
_SOGLIA_FUZZY = 0.80

# Due offerte con date a piu' di 30 giorni di distanza non ottengono punti data.
_MAX_DISTANZA_GIORNI_DATA = 30


def _parse_data(valore: str | None) -> datetime | None:
    """Prova a parsare una data ISO 8601 o formati comuni."""
    if not valore:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(valore[:19], fmt)
        except ValueError:
            continue
    return None


def _punteggio_data(a: dict, b: dict) -> float:
    """Ritorna 1.0 se le date sono entro 30 giorni, 0.0 altrimenti."""
    da = _parse_data(a.get("data_pubblicazione"))
    db = _parse_data(b.get("data_pubblicazione"))
    if da is None or db is None:
        # Se manca una data, assegna un punteggio neutro (0.5)
        return 0.5
    diff = abs((da - db).days)
    return 1.0 if diff <= _MAX_DISTANZA_GIORNI_DATA else 0.0


def stessa_azienda(a: dict, b: dict) -> bool:
    """Controlla se due offerte hanno la stessa azienda (confronto normalizzato)."""
    az_a = _normalizza_testo(a.get("azienda"))
    az_b = _normalizza_testo(b.get("azienda"))
    if not az_a or not az_b:
        return False
    return az_a == az_b


def punteggio_fuzzy(a: dict, b: dict) -> float:
    """Calcola il punteggio fuzzy combinato tra due offerte.

    Returns:
        Punteggio tra 0.0 e 1.0.
    """
    # Similarita' titolo (token_sort_ratio normalizzato a 0-1)
    titolo_a = _normalizza_testo(a.get("titolo"))
    titolo_b = _normalizza_testo(b.get("titolo"))
    sim_titolo = fuzz.token_sort_ratio(titolo_a, titolo_b) / 100.0

    # Match paese
    paese_a = (a.get("paese") or "").upper().strip()
    paese_b = (b.get("paese") or "").upper().strip()
    if not paese_a or not paese_b:
        sim_paese = 0.5  # neutro se manca
    else:
        sim_paese = 1.0 if paese_a == paese_b else 0.0

    # Vicinanza date
    sim_data = _punteggio_data(a, b)

    return sim_titolo * 0.50 + sim_paese * 0.25 + sim_data * 0.25


def sono_duplicati_fuzzy(a: dict, b: dict) -> bool:
    """Determina se due offerte sono probabili duplicati tramite fuzzy matching.

    Ritorna False immediatamente se le aziende sono diverse.
    Altrimenti calcola un punteggio pesato e confronta con la soglia 0.80.

    Args:
        a: prima offerta.
        b: seconda offerta.

    Returns:
        True se le offerte sono probabili duplicati.
    """
    if not stessa_azienda(a, b):
        return False
    return punteggio_fuzzy(a, b) > _SOGLIA_FUZZY
