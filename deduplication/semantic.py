"""
Livello 3 — Embedding semantici.

Confronta le descrizioni di due offerte usando un modello sentence-transformers
multilingue (italiano + inglese). Cattura duplicati dove il testo e' parafrasato
o tradotto.

Il modello viene caricato una volta sola (singleton) per evitare reload ad ogni chiamata.
Se sentence-transformers non e' installato, le funzioni ritornano False con un warning.
"""

import logging
import warnings
from typing import Any

logger = logging.getLogger(__name__)

# Soglia di similarita' coseno sopra la quale le descrizioni sono considerate duplicate.
_SOGLIA_SEMANTICA = 0.85

# Singleton per il modello.
_modello: Any = None
_modello_caricato = False
_modello_disponibile: bool | None = None  # None = non ancora verificato


def _carica_modello() -> Any:
    """Carica il modello sentence-transformers (singleton)."""
    global _modello, _modello_caricato, _modello_disponibile

    if _modello_caricato:
        return _modello

    _modello_caricato = True

    try:
        from sentence_transformers import SentenceTransformer  # type: ignore[import-untyped]
        _modello = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        _modello_disponibile = True
        logger.info("Modello sentence-transformers caricato con successo.")
        return _modello
    except ImportError:
        _modello_disponibile = False
        warnings.warn(
            "sentence-transformers non installato: il Livello 3 (embedding semantici) "
            "verra' saltato. Installa con: pip install sentence-transformers torch",
            stacklevel=2,
        )
        return None
    except Exception as e:
        _modello_disponibile = False
        logger.error("Errore nel caricamento del modello: %s", e)
        return None


def embedding_disponibile() -> bool:
    """Controlla se il modello di embedding e' disponibile.

    Tenta il caricamento se non ancora fatto.
    """
    if _modello_disponibile is None:
        _carica_modello()
    return bool(_modello_disponibile)


def similarita_descrizioni(desc_a: str, desc_b: str) -> float:
    """Calcola la similarita' coseno tra due descrizioni.

    Args:
        desc_a: prima descrizione.
        desc_b: seconda descrizione.

    Returns:
        Similarita' coseno tra 0.0 e 1.0, oppure 0.0 se il modello non e' disponibile.
    """
    modello = _carica_modello()
    if modello is None:
        return 0.0

    embeddings = modello.encode([desc_a, desc_b], convert_to_tensor=True)

    from sentence_transformers import util  # type: ignore[import-untyped]
    sim = util.cos_sim(embeddings[0], embeddings[1])
    return float(sim.item())


def sono_duplicati_semantici(a: dict, b: dict) -> bool:
    """Determina se due offerte sono duplicati tramite similarita' semantica delle descrizioni.

    Ritorna False se:
    - una o entrambe le descrizioni sono None/vuote
    - il modello non e' disponibile
    - la similarita' e' sotto la soglia 0.85

    Args:
        a: prima offerta.
        b: seconda offerta.

    Returns:
        True se le descrizioni sono semanticamente quasi identiche.
    """
    desc_a = (a.get("descrizione") or "").strip()
    desc_b = (b.get("descrizione") or "").strip()

    if not desc_a or not desc_b:
        return False

    if not embedding_disponibile():
        return False

    sim = similarita_descrizioni(desc_a, desc_b)
    return sim > _SOGLIA_SEMANTICA
