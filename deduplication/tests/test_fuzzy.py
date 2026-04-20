"""Test Livello 2 — Fuzzy match."""

from deduplication.fuzzy_match import sono_duplicati_fuzzy, punteggio_fuzzy, stessa_azienda


class TestStessaAzienda:
    def test_identica(self) -> None:
        a = {"azienda": "GI Group S.p.A."}
        b = {"azienda": "gi group spa"}
        assert stessa_azienda(a, b)

    def test_diversa(self) -> None:
        a = {"azienda": "AAA"}
        b = {"azienda": "BBB"}
        assert not stessa_azienda(a, b)

    def test_none(self) -> None:
        a = {"azienda": None}
        b = {"azienda": "AAA"}
        assert not stessa_azienda(a, b)


class TestDuplicatiFuzzy:
    def test_duplicato_chiaro(self) -> None:
        """Stessa azienda, titolo quasi identico, stesso paese."""
        a = {
            "titolo": "Software Engineering Internship",
            "azienda": "ACME Corp",
            "paese": "IT",
            "data_pubblicazione": "2026-01-15",
        }
        b = {
            "titolo": "Software Engineer Intern",
            "azienda": "Acme Corp",
            "paese": "IT",
            "data_pubblicazione": "2026-01-20",
        }
        assert sono_duplicati_fuzzy(a, b)

    def test_chiaramente_diverso(self) -> None:
        """Stessa azienda ma ruoli completamente diversi."""
        a = {
            "titolo": "Data Scientist Junior",
            "azienda": "BigTech Srl",
            "paese": "IT",
            "data_pubblicazione": "2026-03-01",
        }
        b = {
            "titolo": "Marketing Manager Senior",
            "azienda": "BigTech Srl",
            "paese": "IT",
            "data_pubblicazione": "2026-03-01",
        }
        assert not sono_duplicati_fuzzy(a, b)

    def test_azienda_diversa_blocca(self) -> None:
        """Titolo identico ma azienda diversa: non duplicato."""
        a = {"titolo": "Intern", "azienda": "AAA", "paese": "IT"}
        b = {"titolo": "Intern", "azienda": "BBB", "paese": "IT"}
        assert not sono_duplicati_fuzzy(a, b)

    def test_date_lontane_penalizza(self) -> None:
        """Stesso titolo/azienda ma date a 60 giorni di distanza."""
        a = {
            "titolo": "Junior Analyst",
            "azienda": "FinCo",
            "paese": "IT",
            "data_pubblicazione": "2026-01-01",
        }
        b = {
            "titolo": "Junior Analyst",
            "azienda": "FinCo",
            "paese": "IT",
            "data_pubblicazione": "2026-03-15",
        }
        # Titolo identico (0.5) + paese uguale (0.25) + data lontana (0.0) = 0.75 < 0.80
        assert not sono_duplicati_fuzzy(a, b)

    def test_sinonimi_titolo(self) -> None:
        """Stage e internship nel titolo, stessa azienda."""
        a = {
            "titolo": "Stage in Data Analysis",
            "azienda": "DataCo",
            "paese": "IT",
            "data_pubblicazione": "2026-02-01",
        }
        b = {
            "titolo": "Internship in Data Analysis",
            "azienda": "DataCo",
            "paese": "IT",
            "data_pubblicazione": "2026-02-05",
        }
        assert sono_duplicati_fuzzy(a, b)


class TestPunteggioFuzzy:
    def test_identico_vale_1(self) -> None:
        a = {
            "titolo": "Intern",
            "azienda": "Co",
            "paese": "IT",
            "data_pubblicazione": "2026-01-01",
        }
        score = punteggio_fuzzy(a, a)
        assert score > 0.95

    def test_completamente_diverso(self) -> None:
        a = {"titolo": "AAA", "azienda": "X", "paese": "IT", "data_pubblicazione": "2026-01-01"}
        b = {"titolo": "ZZZ", "azienda": "Y", "paese": "DE", "data_pubblicazione": "2025-01-01"}
        score = punteggio_fuzzy(a, b)
        assert score < 0.5
