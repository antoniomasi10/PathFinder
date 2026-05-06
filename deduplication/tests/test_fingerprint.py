"""Test Livello 1 — Fingerprint hash."""

from deduplication.fingerprint import genera_fingerprint, _normalizza_testo


class TestNormalizzaTesto:
    def test_lowercase(self) -> None:
        assert _normalizza_testo("Software ENGINEER") == "software engineer"

    def test_punteggiatura(self) -> None:
        assert _normalizza_testo("C++ Developer (m/f)") == "c developer mf"

    def test_spazi_extra(self) -> None:
        assert _normalizza_testo("  Data   Analyst  ") == "data analyst"

    def test_sinonimo_stage(self) -> None:
        assert "internship" in _normalizza_testo("Stage en entreprise")

    def test_sinonimo_tirocinio(self) -> None:
        assert "internship" in _normalizza_testo("Tirocinio formativo")

    def test_sinonimo_traineeship(self) -> None:
        assert "internship" in _normalizza_testo("Traineeship in marketing")

    def test_accenti(self) -> None:
        assert _normalizza_testo("ingegnere gestionale") == "ingegnere gestionale"
        assert _normalizza_testo("ingénieur") == "ingenieur"

    def test_none(self) -> None:
        assert _normalizza_testo(None) == ""


class TestGeneraFingerprint:
    def test_identico(self) -> None:
        offerta = {"titolo": "Software Intern", "azienda": "ACME Corp", "paese": "IT"}
        assert genera_fingerprint(offerta) == genera_fingerprint(offerta)

    def test_case_insensitive(self) -> None:
        a = {"titolo": "Software Intern", "azienda": "ACME Corp", "paese": "IT"}
        b = {"titolo": "software intern", "azienda": "acme corp", "paese": "it"}
        assert genera_fingerprint(a) == genera_fingerprint(b)

    def test_sinonimi_producono_stesso_hash(self) -> None:
        a = {"titolo": "Stage marketing", "azienda": "BigCo", "paese": "IT"}
        b = {"titolo": "Internship marketing", "azienda": "BigCo", "paese": "IT"}
        assert genera_fingerprint(a) == genera_fingerprint(b)

    def test_tirocinio_uguale_internship(self) -> None:
        a = {"titolo": "Tirocinio sviluppo web", "azienda": "Startup Srl", "paese": "IT"}
        b = {"titolo": "Internship sviluppo web", "azienda": "Startup Srl", "paese": "IT"}
        assert genera_fingerprint(a) == genera_fingerprint(b)

    def test_azienda_diversa_hash_diverso(self) -> None:
        a = {"titolo": "Intern", "azienda": "AAA", "paese": "IT"}
        b = {"titolo": "Intern", "azienda": "BBB", "paese": "IT"}
        assert genera_fingerprint(a) != genera_fingerprint(b)

    def test_paese_diverso_hash_diverso(self) -> None:
        a = {"titolo": "Intern", "azienda": "AAA", "paese": "IT"}
        b = {"titolo": "Intern", "azienda": "AAA", "paese": "DE"}
        assert genera_fingerprint(a) != genera_fingerprint(b)

    def test_punteggiatura_non_cambia_hash(self) -> None:
        a = {"titolo": "Software Engineer (Junior)", "azienda": "Co.", "paese": "IT"}
        b = {"titolo": "Software Engineer Junior", "azienda": "Co", "paese": "IT"}
        assert genera_fingerprint(a) == genera_fingerprint(b)

    def test_campi_mancanti(self) -> None:
        offerta = {"titolo": "Intern"}
        fp = genera_fingerprint(offerta)
        assert isinstance(fp, str)
        assert len(fp) == 64  # SHA-256 hex
