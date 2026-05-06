"""
Livello 1 — Fingerprint hash.

Genera un'impronta digitale deterministica per ogni offerta.
Due offerte con titolo, azienda e paese equivalenti producono lo stesso hash,
anche se differiscono per maiuscole, punteggiatura o sinonimi
(es. "stage" vs "internship" vs "tirocinio").
"""

import hashlib
import re
import unicodedata

# Mappa sinonimi → forma canonica.
# Ordine: prima i più lunghi per evitare match parziali.
_SINONIMI: list[tuple[str, str]] = [
    ("traineeship", "internship"),
    ("trainee", "internship"),
    ("tirocinio curriculare", "internship"),
    ("tirocinio extracurriculare", "internship"),
    ("tirocinio formativo", "internship"),
    ("tirocinio", "internship"),
    ("stage", "internship"),
    ("apprendistato", "apprenticeship"),
    ("primo impiego", "junior"),
    ("neolaureato", "junior"),
]


def _normalizza_testo(testo: str | None) -> str:
    """Normalizza una stringa: lowercase, rimuovi accenti, punteggiatura e spazi extra."""
    if not testo:
        return ""
    # Lowercase
    t = testo.lower().strip()
    # Rimuovi accenti (è→e, ü→u, …)
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    # Sostituisci sinonimi
    for vecchio, nuovo in _SINONIMI:
        t = t.replace(vecchio, nuovo)
    # Rimuovi punteggiatura (tieni lettere, cifre, spazi)
    t = re.sub(r"[^a-z0-9\s]", "", t)
    # Collassa spazi multipli
    t = re.sub(r"\s+", " ", t).strip()
    return t


def genera_fingerprint(offerta: dict) -> str:
    """Genera un fingerprint SHA-256 deterministico per un'offerta.

    La chiave si basa su: normalizza(titolo) | normalizza(azienda) | paese.
    Il risultato e' un hex digest di 64 caratteri.

    Args:
        offerta: dizionario con almeno "titolo"; "azienda" e "paese" opzionali.

    Returns:
        Stringa SHA-256 hex digest.
    """
    titolo = _normalizza_testo(offerta.get("titolo"))
    azienda = _normalizza_testo(offerta.get("azienda"))
    paese = (offerta.get("paese") or "").upper().strip()

    chiave = f"{titolo}|{azienda}|{paese}"
    return hashlib.sha256(chiave.encode("utf-8")).hexdigest()
