"""Test Pipeline end-to-end."""

from deduplication.pipeline import deduplica


def _offerta(
    id_esterno: str,
    sorgente: str,
    titolo: str,
    azienda: str | None = None,
    paese: str = "IT",
    data_pub: str = "2026-03-01",
    descrizione: str | None = None,
) -> dict:
    """Helper per creare un'offerta di test."""
    return {
        "id_esterno": id_esterno,
        "sorgente": sorgente,
        "sorgente_url": f"https://{sorgente}.example.com/{id_esterno}",
        "data_scraping": "2026-04-09T10:00:00",
        "titolo": titolo,
        "descrizione": descrizione or f"Descrizione per {titolo} presso {azienda}.",
        "tipo": "internship",
        "azienda": azienda,
        "paese": paese,
        "citta": None,
        "data_pubblicazione": data_pub,
        "scadenza": None,
        "retribuita": None,
        "durata_mesi": None,
    }


# ── Dataset di test ──────────────────────────────────────────────────────

OFFERTE_TEST: list[dict] = [
    # Gruppo 1: duplicato certo (fingerprint identico) — "Stage" vs "Internship"
    _offerta("E001", "eures", "Stage Data Analyst", "BigData Srl", "IT", "2026-03-01"),
    _offerta("S001", "stage4eu", "Internship Data Analyst", "BigData Srl", "IT", "2026-03-05"),

    # Gruppo 2: duplicato fuzzy — titolo leggermente diverso, stessa azienda
    _offerta("E002", "eures", "Software Engineering Internship", "TechCo SpA", "IT", "2026-03-10"),
    _offerta("G001", "greenhouse", "Software Engineer Intern", "TechCo SpA", "IT", "2026-03-12"),

    # Gruppo 3: stessa azienda ma ruoli diversi — NON duplicati
    _offerta("E003", "eures", "Marketing Manager", "UniCorp", "IT", "2026-03-01"),
    _offerta("L001", "lever", "Data Scientist Junior", "UniCorp", "IT", "2026-03-01"),

    # Gruppo 4: offerta unica senza duplicati
    _offerta("E004", "eures", "Tirocinio Architettura", "Studio Rossi", "IT", "2026-02-15"),

    # Gruppo 5: stessa offerta ma date troppo lontane (>90 giorni) — NON unire
    _offerta("E005", "eures", "Stage Marketing", "AdvCo", "IT", "2026-01-01"),
    _offerta("S005", "stage4eu", "Internship Marketing", "AdvCo", "IT", "2026-06-01"),

    # Gruppo 6: offerta unica da sorgente diversa
    _offerta("L002", "lever", "UX Designer Trainee", "DesignStudio", "DE", "2026-03-20"),
]


class TestPipelineEndToEnd:
    def test_riduce_il_numero(self) -> None:
        """La pipeline deve ridurre le 10 offerte a meno di 10."""
        risultati = deduplica(OFFERTE_TEST)
        assert len(risultati) < len(OFFERTE_TEST)

    def test_conteggio_atteso(self) -> None:
        """Ci aspettiamo 8 gruppi finali:
        - Gruppo 1: 2 -> 1 (fingerprint)
        - Gruppo 2: 2 -> 1 (fuzzy)
        - Gruppo 3: 2 separati (ruoli diversi)
        - Gruppo 4: 1 unica
        - Gruppo 5: 2 separati (finestra temporale)
        - Gruppo 6: 1 unica
        Totale: 1 + 1 + 2 + 1 + 2 + 1 = 8
        """
        risultati = deduplica(OFFERTE_TEST)
        assert len(risultati) == 8

    def test_master_ha_fonti(self) -> None:
        """Ogni master record deve avere il campo 'fonti'."""
        risultati = deduplica(OFFERTE_TEST)
        for r in risultati:
            assert "fonti" in r
            assert isinstance(r["fonti"], list)
            assert len(r["fonti"]) >= 1

    def test_duplicato_certo_ha_due_fonti(self) -> None:
        """Il gruppo 1 (fingerprint match) deve avere 2 fonti."""
        risultati = deduplica(OFFERTE_TEST)
        # Trova il master che contiene "Data Analyst" nel titolo
        masters_da = [r for r in risultati if "data analyst" in r["titolo"].lower()]
        assert len(masters_da) == 1
        assert len(masters_da[0]["fonti"]) == 2

    def test_duplicato_fuzzy_ha_due_fonti(self) -> None:
        """Il gruppo 2 (fuzzy match) deve avere 2 fonti."""
        risultati = deduplica(OFFERTE_TEST)
        masters_se = [
            r for r in risultati
            if "software" in r["titolo"].lower() and "techco" in (r.get("azienda") or "").lower()
        ]
        assert len(masters_se) == 1
        assert len(masters_se[0]["fonti"]) == 2

    def test_ruoli_diversi_non_uniti(self) -> None:
        """Marketing Manager e Data Scientist di UniCorp restano separati."""
        risultati = deduplica(OFFERTE_TEST)
        unicorp = [r for r in risultati if (r.get("azienda") or "").lower() == "unicorp"]
        assert len(unicorp) == 2

    def test_finestra_temporale_non_unisce(self) -> None:
        """Le offerte di AdvCo a 5 mesi di distanza restano separate."""
        risultati = deduplica(OFFERTE_TEST)
        advco = [r for r in risultati if "advco" in (r.get("azienda") or "").lower()]
        assert len(advco) == 2

    def test_master_usa_descrizione_piu_lunga(self) -> None:
        """Il master record deve avere la descrizione piu' lunga del gruppo."""
        offerte = [
            _offerta("A1", "eures", "Test Intern", "Co", descrizione="Breve."),
            _offerta("A2", "stage4eu", "Internship Test", "Co", descrizione="Questa e' una descrizione molto piu' lunga e dettagliata dell'offerta."),
        ]
        risultati = deduplica(offerte)
        assert len(risultati) == 1
        assert "molto piu' lunga" in risultati[0]["descrizione"]

    def test_fonti_contengono_sorgente_e_id(self) -> None:
        """Ogni fonte deve avere sorgente, id_esterno, sorgente_url, data_scraping."""
        risultati = deduplica(OFFERTE_TEST)
        for r in risultati:
            for fonte in r["fonti"]:
                assert "sorgente" in fonte
                assert "id_esterno" in fonte
                assert "sorgente_url" in fonte
                assert "data_scraping" in fonte

    def test_lista_vuota(self) -> None:
        assert deduplica([]) == []

    def test_singola_offerta(self) -> None:
        offerta = _offerta("X1", "eures", "Test", "Co")
        risultati = deduplica([offerta])
        assert len(risultati) == 1
        assert len(risultati[0]["fonti"]) == 1
