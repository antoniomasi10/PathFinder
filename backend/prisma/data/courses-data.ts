import { CourseType } from '@prisma/client';

export type CourseEntry = {
  name: string;
  type: CourseType;
  field?: string;
  tags?: string[];
  internationalOpportunities?: boolean;
};

const T = CourseType.TRIENNALE;
const M = CourseType.MAGISTRALE;
const U = CourseType.CICLO_UNICO;

// Le chiavi corrispondono esattamente ai nomi delle università nel DB
export const UNIVERSITY_COURSES: Record<string, CourseEntry[]> = {

  // ── UNIVERSITÀ DI BOLOGNA ──────────────────────────────────────────────
  'Alma Mater Studiorum – Università di Bologna': [
    { name: 'Informatica', type: T, tags: ['informatica', 'programmazione'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['ingegneria', 'software'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['ingegneria', 'elettronica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['ingegneria', 'meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['ingegneria', 'costruzioni'] },
    { name: 'Ingegneria Biomedica', type: T, tags: ['ingegneria', 'biomedica'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['ingegneria', 'gestione'] },
    { name: 'Economia e Commercio', type: T, tags: ['economia', 'commercio'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia', 'management'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto', 'legge'] },
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina', 'chirurgia'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica', 'relazioni internazionali'] },
    { name: 'Lettere', type: T, tags: ['lettere', 'umanistica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Biologia', type: T, tags: ['biologia', 'scienze naturali'] },
    { name: 'Architettura', type: U, tags: ['architettura', 'design'] },
    { name: 'Ingegneria Informatica', type: M, tags: ['machine learning', 'AI'] },
    { name: 'Artificial Intelligence', type: M, tags: ['AI', 'machine learning'], internationalOpportunities: true },
    { name: 'Business and Economics', type: M, tags: ['business', 'economics'], internationalOpportunities: true },
    { name: 'Biotecnologie', type: T, tags: ['biotech', 'biologia molecolare'] },
  ],

  // ── POLITECNICO DI MILANO ──────────────────────────────────────────────
  'Politecnico di Milano': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica', 'software'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica', 'embedded'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica', 'automotive'] },
    { name: 'Ingegneria Civile', type: T, tags: ['costruzioni', 'strutture'] },
    { name: 'Ingegneria Energetica', type: T, tags: ['energia', 'sostenibilità'] },
    { name: 'Ingegneria Aerospaziale', type: T, tags: ['aerospazio', 'velivoli'] },
    { name: 'Ingegneria Biomedica', type: T, tags: ['biomedica', 'dispositivi medici'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione', 'supply chain'] },
    { name: 'Ingegneria Chimica', type: T, tags: ['chimica', 'processi industriali'] },
    { name: 'Ingegneria delle Telecomunicazioni', type: T, tags: ['TLC', 'reti', '5G'] },
    { name: 'Ingegneria Ambientale', type: T, tags: ['ambiente', 'sostenibilità'] },
    { name: 'Architettura', type: U, tags: ['architettura', 'progettazione'] },
    { name: 'Design del Prodotto Industriale', type: T, tags: ['design', 'prodotto'] },
    { name: 'Design della Comunicazione', type: T, tags: ['design', 'comunicazione'] },
    { name: 'Computer Science and Engineering', type: M, tags: ['CS', 'AI', 'software'], internationalOpportunities: true },
    { name: 'Ingegneria dei Sistemi Medicali', type: M, tags: ['dispositivi medici', 'bioingegneria', 'healthcare'] },
    { name: 'Ingegneria Aerospaziale', type: M, tags: ['aerospazio', 'propulsione'] },
    { name: 'Management Engineering', type: M, tags: ['management', 'innovation'], internationalOpportunities: true },
    { name: 'Automation and Control Engineering', type: M, tags: ['automazione', 'robotica'] },
    { name: 'Materials Engineering and Nanotechnology', type: M, tags: ['materiali', 'nanotecnologie'] },
    { name: 'Nuclear Engineering', type: M, tags: ['nucleare', 'energia'] },
    { name: 'Design & Engineering', type: M, tags: ['design', 'engineering'], internationalOpportunities: true },
  ],

  // ── LA SAPIENZA ────────────────────────────────────────────────────────
  'Università degli Studi di Roma "La Sapienza"': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Odontoiatria', type: U, tags: ['odontoiatria', 'dentistica'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto', 'legge'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica', 'software'] },
    { name: 'Ingegneria Aerospaziale', type: T, tags: ['aerospazio'] },
    { name: 'Ingegneria Civile e Ambientale', type: T, tags: ['civile', 'ambiente'] },
    { name: 'Ingegneria Elettrica', type: T, tags: ['elettrica', 'energia'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Biomedica', type: T, tags: ['biomedica'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Biotecnologie', type: T, tags: ['biotech'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Economia e Management', type: T, tags: ['economia', 'management'] },
    { name: 'Lettere e Filosofia', type: T, tags: ['lettere', 'filosofia'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Comunicazione e Media', type: T, tags: ['comunicazione', 'media'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione', 'pedagogia'] },
    { name: 'Relazioni Internazionali', type: M, tags: ['RI', 'politica internazionale'], internationalOpportunities: true },
    { name: 'Ingegneria Aerospaziale', type: M, tags: ['aerospazio', 'propulsione'] },
  ],

  // ── UNIVERSITÀ DI TORINO ───────────────────────────────────────────────
  'Università degli Studi di Torino': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia', 'management'] },
    { name: 'Economia e Commercio', type: T, tags: ['economia', 'commercio'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lingue e Culture Straniere', type: T, tags: ['lingue', 'culture'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Filosofia', type: T, tags: ['filosofia'] },
    { name: 'Biotecnologie', type: T, tags: ['biotech'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
  ],

  // ── FEDERICO II ───────────────────────────────────────────────────────
  'Università degli Studi di Napoli "Federico II"': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Aerospaziale', type: T, tags: ['aerospazio'] },
    { name: 'Ingegneria Elettrica', type: T, tags: ['elettrica'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria delle Telecomunicazioni', type: T, tags: ['TLC', 'reti'] },
    { name: 'Ingegneria Chimica', type: T, tags: ['chimica'] },
    { name: 'Ingegneria Biomedica', type: M, tags: ['biomedica', 'healthcare'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Scienze Biologiche', type: T, tags: ['biologia'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere Classiche', type: T, tags: ['lettere', 'classica'] },
    { name: 'Agraria', type: T, tags: ['agraria', 'agricoltura'] },
  ],

  // ── UNIVERSITÀ DI FIRENZE ──────────────────────────────────────────────
  'Università degli Studi di Firenze': [
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Scienze della Formazione', type: T, tags: ['educazione'] },
    { name: 'Scienze Biologiche', type: T, tags: ['biologia'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
    { name: 'Design', type: T, tags: ['design', 'moda'] },
  ],

  // ── POLITECNICO DI TORINO ──────────────────────────────────────────────
  'Politecnico di Torino': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica', 'software'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica', 'automotive'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile', 'strutture'] },
    { name: 'Ingegneria Energetica', type: T, tags: ['energia', 'rinnovabili'] },
    { name: 'Ingegneria Aerospaziale', type: T, tags: ['aerospazio'] },
    { name: 'Ingegneria Biomedica', type: T, tags: ['biomedica'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
    { name: 'Ingegneria delle Telecomunicazioni', type: T, tags: ['TLC', '5G'] },
    { name: 'Ingegneria Chimica', type: T, tags: ['chimica'] },
    { name: 'Ingegneria Ambientale', type: T, tags: ['ambiente', 'sostenibilità'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Design e Comunicazione Visiva', type: T, tags: ['design', 'grafica'] },
    { name: 'Ingegneria dei Sistemi Medicali', type: M, tags: ['dispositivi medici', 'healthcare', 'bioingegneria'] },
    { name: 'Computer Engineering', type: M, tags: ['AI', 'cybersecurity'], internationalOpportunities: true },
    { name: 'Mechatronic Engineering', type: M, tags: ['meccatronica', 'robotica'], internationalOpportunities: true },
    { name: 'Ingegneria Gestionale', type: M, tags: ['management', 'operations'] },
    { name: 'Ingegneria per l\'Ambiente e il Territorio', type: M, tags: ['ambiente', 'GIS'] },
    { name: 'Pianificazione Territoriale e Urbanistica', type: M, tags: ['urbanistica', 'pianificazione'] },
  ],

  // ── CA' FOSCARI ────────────────────────────────────────────────────────
  'Università Ca\' Foscari Venezia': [
    { name: 'Economia e Commercio', type: T, tags: ['economia'] },
    { name: 'Economia Aziendale', type: T, tags: ['management'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Filosofia', type: T, tags: ['filosofia'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Storia', type: T, tags: ['storia'] },
    { name: 'Lingue, Culture e Società dell\'Asia e Africa Mediterranea', type: T, tags: ['lingue', 'Asia'] },
    { name: 'Lingue, Civiltà e Scienze del Linguaggio', type: T, tags: ['lingue', 'linguistica'] },
    { name: 'Scienze Ambientali', type: T, tags: ['ambiente', 'sostenibilità'] },
    { name: 'Chimica e Tecnologie Sostenibili', type: T, tags: ['chimica', 'green'] },
    { name: 'Economia e Management', type: M, tags: ['management', 'business'], internationalOpportunities: true },
    { name: 'Global Development and Entrepreneurship', type: M, tags: ['entrepreneurship', 'sviluppo'], internationalOpportunities: true },
    { name: 'Scienze del Linguaggio', type: M, tags: ['linguistica', 'NLP'] },
    { name: 'Digital Management', type: M, tags: ['digital', 'tech management'] },
  ],

  // ── UNIVERSITÀ DI PADOVA ───────────────────────────────────────────────
  'Università degli Studi di Padova': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Biomedica', type: T, tags: ['biomedica'] },
    { name: 'Ingegneria dell\'Energia Elettrica', type: T, tags: ['elettrica'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Agronomia', type: T, tags: ['agraria'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Economia e Management', type: T, tags: ['economia'] },
    { name: 'Lettere Classiche', type: T, tags: ['lettere'] },
    { name: 'Cognitive Neuroscience and Clinical Neuropsychology', type: M, tags: ['neuroscienze', 'psicologia'], internationalOpportunities: true },
    { name: 'Ingegneria Meccatronica', type: M, tags: ['meccatronica', 'robotica'] },
    { name: 'Data Science', type: M, tags: ['data science', 'ML', 'AI'] },
    { name: 'Biotecnologie', type: T, tags: ['biotech'] },
  ],

  // ── UNIVERSITÀ DI PISA ─────────────────────────────────────────────────
  'Università degli Studi di Pisa': [
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica', 'software'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Aerospaziale', type: T, tags: ['aerospazio'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia e Management', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Biotecnologie', type: T, tags: ['biotech'] },
    { name: 'Computer Science', type: M, tags: ['AI', 'software'], internationalOpportunities: true },
    { name: 'Embedded Computing Systems', type: M, tags: ['embedded', 'IoT'] },
  ],

  // ── UNIVERSITÀ DI BARI ─────────────────────────────────────────────────
  'Università degli Studi di Bari "Aldo Moro"': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica', 'software'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
  ],

  // ── UNIVERSITÀ DI BERGAMO ──────────────────────────────────────────────
  'Università degli Studi di Bergamo': [
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Lingue e Letterature Straniere', type: T, tags: ['lingue'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Management e Informatica', type: M, tags: ['management', 'digital'] },
  ],

  // ── UNIVERSITÀ DI BRESCIA ──────────────────────────────────────────────
  'Università degli Studi di Brescia': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
    { name: 'Ingegneria Biomedica', type: T, tags: ['biomedica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
  ],

  // ── UNIVERSITÀ DI CAGLIARI ─────────────────────────────────────────────
  'Università degli Studi di Cagliari': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Elettrica', type: T, tags: ['elettrica'] },
    { name: 'Economia e Management', type: T, tags: ['economia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Scienze Biologiche', type: T, tags: ['biologia'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
  ],

  // ── UNIVERSITÀ DI CAMERINO ─────────────────────────────────────────────
  'Università degli Studi di Camerino': [
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Scienze Biologiche', type: T, tags: ['biologia'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Scienze Ambientali', type: T, tags: ['ambiente'] },
    { name: 'Biotecnologie', type: T, tags: ['biotech'] },
  ],

  // ── VANVITELLI ─────────────────────────────────────────────────────────
  'Università degli Studi della Campania Luigi Vanvitelli': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Aerospaziale', type: T, tags: ['aerospazio'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Architettura e Design Industriale', type: U, tags: ['architettura'] },
  ],

  // ── UNIVERSITÀ DI CASSINO ──────────────────────────────────────────────
  'Università degli Studi di Cassino e del Lazio Meridionale': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Lettere e Filosofia', type: T, tags: ['lettere'] },
    { name: 'Lingue e Letterature Moderne', type: T, tags: ['lingue'] },
  ],

  // ── UNIVERSITÀ DI CATANIA ──────────────────────────────────────────────
  'Università degli Studi di Catania': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria Chimica', type: T, tags: ['chimica'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
  ],

  // ── D'ANNUNZIO ─────────────────────────────────────────────────────────
  "Università degli Studi di Chieti-Pescara \"Gabriele d'Annunzio\"": [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Odontoiatria', type: U, tags: ['odontoiatria'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Lingue Moderne', type: T, tags: ['lingue'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
  ],

  // ── UNICAL ─────────────────────────────────────────────────────────────
  'Università degli Studi della Calabria': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Chimica', type: T, tags: ['chimica'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
  ],

  // ── UNIVERSITÀ DI FERRARA ──────────────────────────────────────────────
  'Università degli Studi di Ferrara': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
  ],

  // ── UNIVERSITÀ DI FOGGIA ───────────────────────────────────────────────
  'Università degli Studi di Foggia': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
    { name: 'Infermieristica', type: T, tags: ['infermieristica'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
  ],

  // ── UNIVERSITÀ DI GENOVA ───────────────────────────────────────────────
  'Università degli Studi di Genova': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Navale', type: T, tags: ['navale', 'marina'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria delle Telecomunicazioni', type: T, tags: ['TLC'] },
    { name: 'Ingegneria Chimica', type: T, tags: ['chimica'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
  ],

  // ── INSUBRIA ───────────────────────────────────────────────────────────
  "Università degli Studi dell'Insubria": [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Scienze Biologiche', type: T, tags: ['biologia'] },
    { name: 'Scienze Ambientali', type: T, tags: ['ambiente'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
  ],

  // ── UNIVAQ ─────────────────────────────────────────────────────────────
  "Università degli Studi dell'Aquila": [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Elettrica', type: T, tags: ['elettrica'] },
    { name: 'Ingegneria delle Telecomunicazioni', type: T, tags: ['TLC'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Scienze Biologiche', type: T, tags: ['biologia'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
  ],

  // ── IUSS ───────────────────────────────────────────────────────────────
  'Istituto Universitario di Studi Superiori – IUSS': [
    { name: 'Scienze e Tecnologie', type: M, tags: ['scienze', 'tecnologia'] },
    { name: 'Scienze Umane e della Vita', type: M, tags: ['umanistica', 'scienze sociali'] },
    { name: 'Governance, Management e Diritto dell\'Impresa', type: M, tags: ['governance', 'diritto'] },
  ],

  // ── IMT LUCCA ──────────────────────────────────────────────────────────
  'IMT Alti Studi Lucca': [
    { name: 'Economics, Networks and Business Analytics', type: M, tags: ['economics', 'analytics'], internationalOpportunities: true },
    { name: 'Computer Science and Systems Engineering', type: M, tags: ['CS', 'sistemi'], internationalOpportunities: true },
    { name: 'Cognitive and Cultural Systems', type: M, tags: ['cognitive science', 'cultura'], internationalOpportunities: true },
    { name: 'Political Systems and Institutional Change', type: M, tags: ['politica', 'istituzioni'], internationalOpportunities: true },
  ],

  // ── UNIVERSITÀ DI MACERATA ─────────────────────────────────────────────
  'Università degli Studi di Macerata': [
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Storia', type: T, tags: ['storia'] },
    { name: 'Filosofia', type: T, tags: ['filosofia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lingue e Letterature Straniere', type: T, tags: ['lingue'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
  ],

  // ── MAGNA GRÆCIA ───────────────────────────────────────────────────────
  'Università degli Studi Magna Græcia di Catanzaro': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Biomedica', type: T, tags: ['biomedica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Infermieristiche', type: T, tags: ['infermieristica'] },
  ],

  // ── MEDITERRANEA DI REGGIO CALABRIA ───────────────────────────────────
  'Università degli Studi Mediterranea di Reggio Calabria': [
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria per l\'Ambiente e il Territorio', type: T, tags: ['ambiente'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
  ],

  // ── UNIVERSITÀ DI MESSINA ──────────────────────────────────────────────
  'Università degli Studi di Messina': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Odontoiatria', type: U, tags: ['odontoiatria'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
  ],

  // ── UNIVERSITÀ DI MILANO ───────────────────────────────────────────────
  'Università degli Studi di Milano': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Odontoiatria', type: U, tags: ['odontoiatria'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia e Management', type: T, tags: ['economia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Biotecnologie', type: T, tags: ['biotech'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Filosofia', type: T, tags: ['filosofia'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Lingue e Letterature Straniere', type: T, tags: ['lingue'] },
    { name: 'Computer Science', type: M, tags: ['AI', 'data science'], internationalOpportunities: true },
  ],

  // ── MILANO-BICOCCA ─────────────────────────────────────────────────────
  'Università degli Studi di Milano-Bicocca': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Biotecnologie', type: T, tags: ['biotech'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Data Science', type: M, tags: ['data science', 'ML'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica', 'software'] },
  ],

  // ── UNIMORERE ─────────────────────────────────────────────────────────
  'Università degli Studi di Modena e Reggio Emilia': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica', 'automotive'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Meccatronica', type: T, tags: ['meccatronica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Design del Veicolo', type: M, tags: ['automotive', 'design'] },
  ],

  // ── UNIVERSITÀ DEL MOLISE ──────────────────────────────────────────────
  'Università degli Studi del Molise': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
  ],

  // ── L'ORIENTALE ───────────────────────────────────────────────────────
  "Università degli Studi di Napoli \"L'Orientale\"": [
    { name: 'Lingue e Culture Orientali', type: T, tags: ['lingue', 'Asia', 'Cina', 'Giappone'] },
    { name: 'Lingue e Letterature Straniere', type: T, tags: ['lingue', 'letteratura'] },
    { name: 'Mediazione Linguistica e Interculturale', type: T, tags: ['mediazione', 'interpretariato'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica', 'relazioni internazionali'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Filosofia', type: T, tags: ['filosofia'] },
    { name: 'Comunicazione e Lingue', type: M, tags: ['comunicazione', 'lingue'], internationalOpportunities: true },
    { name: 'Relazioni Internazionali', type: M, tags: ['RI', 'diplomazia'], internationalOpportunities: true },
  ],

  // ── PARTHENOPE ─────────────────────────────────────────────────────────
  'Università degli Studi di Napoli "Parthenope"': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Civile e dei Sistemi Edilizi', type: T, tags: ['civile'] },
    { name: 'Ingegneria delle Telecomunicazioni', type: T, tags: ['TLC'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Nautiche', type: T, tags: ['nautica', 'marina'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Scienze Motorie e Sportive', type: T, tags: ['sport', 'motorie'] },
    { name: 'Scienze Statistiche', type: T, tags: ['statistica', 'data'] },
    { name: 'Data Science', type: M, tags: ['data science', 'analytics'] },
  ],

  // ── UNIVERSITÀ DI PALERMO ──────────────────────────────────────────────
  'Università degli Studi di Palermo': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Odontoiatria', type: U, tags: ['odontoiatria'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Chimica', type: T, tags: ['chimica'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
  ],

  // ── UNIVERSITÀ DI PARMA ────────────────────────────────────────────────
  'Università degli Studi di Parma': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica', 'automotive'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze degli Alimenti', type: T, tags: ['food science', 'alimentare'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
  ],

  // ── UNIVERSITÀ DI PAVIA ────────────────────────────────────────────────
  'Università degli Studi di Pavia': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria Biomedica', type: T, tags: ['biomedica'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Economia e Management', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere Classiche', type: T, tags: ['lettere'] },
    { name: 'Filosofia', type: T, tags: ['filosofia'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
  ],

  // ── UNIVERSITÀ DI PERUGIA ──────────────────────────────────────────────
  'Università degli Studi di Perugia': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Civile e Ambientale', type: T, tags: ['civile'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
  ],

  // ── PIEMONTE ORIENTALE ─────────────────────────────────────────────────
  'Università degli Studi del Piemonte Orientale "Amedeo Avogadro"': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Scienze Biologiche', type: T, tags: ['biologia'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
  ],

  // ── POLITECNICO DI BARI ────────────────────────────────────────────────
  'Politecnico di Bari': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica', 'software'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Elettrica', type: T, tags: ['elettrica'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria Chimica', type: T, tags: ['chimica'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Ingegneria dei Sistemi Medicali', type: M, tags: ['sistemi medicali', 'bioingegneria', 'healthcare'] },
    { name: 'Ingegneria Aerospaziale', type: M, tags: ['aerospazio'] },
    { name: 'Computer Engineering', type: M, tags: ['AI', 'cybersecurity'] },
  ],

  // ── POLITECNICA DELLE MARCHE ───────────────────────────────────────────
  'Università Politecnica delle Marche': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria delle Costruzioni Navali e Marine', type: T, tags: ['navale'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
    { name: 'Ingegneria Biomedica', type: T, tags: ['biomedica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
  ],

  // ── FORO ITALICO ──────────────────────────────────────────────────────
  'Università degli Studi di Roma "Foro Italico"': [
    { name: 'Scienze Motorie e Sportive', type: T, tags: ['sport', 'scienze motorie'] },
    { name: 'Scienze e Tecniche delle Attività Motorie Preventive e Adattate', type: T, tags: ['motorie', 'riabilitazione'] },
    { name: 'Scienze dello Sport e della Prestazione Fisica', type: M, tags: ['sport', 'performance'] },
    { name: 'Management dello Sport', type: M, tags: ['sport management'] },
  ],

  // ── TOR VERGATA ────────────────────────────────────────────────────────
  'Università degli Studi di Roma Tor Vergata': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria Biomedica', type: T, tags: ['biomedica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria dei Sistemi Medicali', type: M, tags: ['dispositivi medici', 'bioingegneria', 'healthcare'] },
    { name: 'Ingegneria delle Telecomunicazioni', type: T, tags: ['TLC'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Economia e Management', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
  ],

  // ── ROMA TRE ──────────────────────────────────────────────────────────
  'Università degli Studi Roma Tre': [
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica', 'software'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile', 'strutture'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Economia e Commercio', type: T, tags: ['economia', 'commercio'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione', 'media'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Filosofia', type: T, tags: ['filosofia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Relazioni Internazionali', type: M, tags: ['RI', 'diplomazia'], internationalOpportunities: true },
    { name: 'Ingegneria dei Sistemi Medicali', type: M, tags: ['sistemi medicali', 'bioingegneria'] },
    { name: 'Ingegneria Informatica', type: M, tags: ['AI', 'cybersecurity', 'cloud'] },
    { name: 'Economia & Big Data', type: T, tags: ['economia', 'big data', 'data science'] },
  ],

  // ── UNIVERSITÀ DI SALERNO ──────────────────────────────────────────────
  'Università degli Studi di Salerno': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria Chimica', type: T, tags: ['chimica'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
  ],

  // ── UNIVERSITÀ DEL SANNIO ──────────────────────────────────────────────
  'Università degli Studi del Sannio': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Scienze Biologiche e Applicate', type: T, tags: ['biologia'] },
  ],

  // ── UNIVERSITÀ DI SASSARI ──────────────────────────────────────────────
  'Università degli Studi di Sassari': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
    { name: 'Medicina Veterinaria', type: U, tags: ['veterinaria'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
  ],

  // ── SCUOLA NORMALE SUPERIORE ───────────────────────────────────────────
  'Scuola Normale Superiore': [
    { name: 'Scienze', type: M, tags: ['fisica', 'matematica', 'chimica', 'biologia'], internationalOpportunities: true },
    { name: 'Lettere e Filosofia', type: M, tags: ['lettere', 'filosofia', 'storia'], internationalOpportunities: true },
    { name: 'Scienze Politico-Sociali', type: M, tags: ['politica', 'sociologia'], internationalOpportunities: true },
  ],

  // ── SANT'ANNA ──────────────────────────────────────────────────────────
  "Scuola Superiore Sant'Anna": [
    { name: 'Management e Innovazione', type: M, tags: ['management', 'innovazione'], internationalOpportunities: true },
    { name: 'Scienze Giuridiche', type: M, tags: ['diritto', 'legge'], internationalOpportunities: true },
    { name: 'Biotecnologie Mediche e Scienze della Vita', type: M, tags: ['biotech', 'medicina'], internationalOpportunities: true },
    { name: 'Politiche Pubbliche', type: M, tags: ['politica', 'pubblica amministrazione'], internationalOpportunities: true },
    { name: 'Ingegneria dell\'Innovazione', type: M, tags: ['ingegneria', 'innovazione'], internationalOpportunities: true },
  ],

  // ── SCUOLA SUPERIORE MERIDIONALE ──────────────────────────────────────
  'Scuola Superiore Meridionale': [
    { name: 'Filosofia e Scienze Umane', type: M, tags: ['filosofia', 'scienze umane'], internationalOpportunities: true },
    { name: 'Scienze', type: M, tags: ['fisica', 'matematica'], internationalOpportunities: true },
    { name: 'Patrimonio Culturale', type: M, tags: ['cultura', 'patrimonio'], internationalOpportunities: true },
  ],

  // ── UNISALENTO ─────────────────────────────────────────────────────────
  'Università del Salento': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria dell\'Innovazione', type: T, tags: ['innovazione', 'ingegneria'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria dei Materiali', type: T, tags: ['materiali'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Beni Culturali', type: T, tags: ['beni culturali'] },
    { name: 'Scienze Biologiche', type: T, tags: ['biologia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
  ],

  // ── UNIVERSITÀ DI SIENA ────────────────────────────────────────────────
  'Università degli Studi di Siena': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Odontoiatria', type: U, tags: ['odontoiatria'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Filosofia', type: T, tags: ['filosofia'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Biotecnologie Mediche', type: T, tags: ['biotech'] },
  ],

  // ── UNIVERSITÀ DI TERAMO ───────────────────────────────────────────────
  'Università degli Studi di Teramo': [
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Medicina Veterinaria', type: U, tags: ['veterinaria'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Biotecnologie', type: T, tags: ['biotech'] },
    { name: 'Biologia', type: T, tags: ['biologia'] },
  ],

  // ── UNIVERSITÀ DI TRENTO ───────────────────────────────────────────────
  'Università degli Studi di Trento': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Industriale', type: T, tags: ['industriale'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia e Management', type: T, tags: ['economia'] },
    { name: 'Sociologia', type: T, tags: ['sociologia'] },
    { name: 'Scienze della Cognizione e della Comunicazione', type: T, tags: ['cognitive science'] },
    { name: 'Data Science', type: M, tags: ['data science', 'ML'], internationalOpportunities: true },
    { name: 'Computer Science', type: M, tags: ['CS', 'AI'], internationalOpportunities: true },
  ],

  // ── UNIVERSITÀ DI TRIESTE ──────────────────────────────────────────────
  'Università degli Studi di Trieste': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Chimica', type: T, tags: ['chimica'] },
    { name: 'Ingegneria Elettronica', type: T, tags: ['elettronica'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Fisica', type: T, tags: ['fisica'] },
    { name: 'Chimica', type: T, tags: ['chimica'] },
    { name: 'Economia e Management', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
  ],

  // ── UNIVERSITÀ DELLA TUSCIA ────────────────────────────────────────────
  'Università degli Studi della Tuscia': [
    { name: 'Agraria', type: T, tags: ['agraria'] },
    { name: 'Scienze Forestali', type: T, tags: ['foreste', 'ambiente'] },
    { name: 'Scienze Ambientali', type: T, tags: ['ambiente'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Conservazione dei Beni Culturali', type: T, tags: ['beni culturali'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Scienze Biologiche', type: T, tags: ['biologia'] },
    { name: 'Comunicazione', type: T, tags: ['comunicazione'] },
  ],

  // ── UNIVERSITÀ DI UDINE ────────────────────────────────────────────────
  'Università degli Studi di Udine': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Lingue e Letterature Straniere', type: T, tags: ['lingue'] },
    { name: 'Scienze della Formazione', type: T, tags: ['educazione'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
  ],

  // ── UNIVERSITÀ DI URBINO ───────────────────────────────────────────────
  'Università degli Studi di Urbino "Carlo Bo"': [
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Sociologia', type: T, tags: ['sociologia'] },
    { name: 'Scienze Motorie', type: T, tags: ['sport', 'motorie'] },
    { name: 'Biologia Molecolare', type: T, tags: ['biologia molecolare'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
  ],

  // ── IUAV ──────────────────────────────────────────────────────────────
  'Università Iuav di Venezia': [
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Design della Moda', type: T, tags: ['moda', 'design'] },
    { name: 'Design', type: T, tags: ['design', 'prodotto'] },
    { name: 'Urbanistica', type: T, tags: ['urbanistica', 'pianificazione'] },
    { name: 'Architettura e Innovazione', type: M, tags: ['architettura', 'innovazione'], internationalOpportunities: true },
    { name: 'Design della Comunicazione', type: M, tags: ['design', 'comunicazione'] },
    { name: 'Arti Visive e dello Spettacolo', type: T, tags: ['arti', 'spettacolo'] },
  ],

  // ── UNIVERSITÀ DI VERONA ───────────────────────────────────────────────
  'Università degli Studi di Verona': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Lingue e Letterature Straniere', type: T, tags: ['lingue'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Biotecnologie', type: T, tags: ['biotech'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Applied Mathematics', type: M, tags: ['matematica applicata', 'data science'], internationalOpportunities: true },
  ],

  // ── STRANIERI DI PERUGIA ───────────────────────────────────────────────
  'Università per Stranieri di Perugia': [
    { name: 'Lingua e Cultura Italiana', type: T, tags: ['italiano', 'lingua', 'cultura'] },
    { name: 'Mediazione Linguistica e Culturale', type: T, tags: ['mediazione', 'lingue'] },
    { name: 'Cooperazione e Sviluppo', type: T, tags: ['cooperazione', 'sviluppo'] },
    { name: 'Comunicazione Internazionale per il Turismo', type: M, tags: ['turismo', 'comunicazione'], internationalOpportunities: true },
    { name: 'Lingua e Cultura Italiana per Stranieri', type: M, tags: ['italiano L2', 'didattica'], internationalOpportunities: true },
  ],

  // ── STRANIERI DI SIENA ────────────────────────────────────────────────
  'Università per Stranieri di Siena': [
    { name: 'Mediazione Linguistica e Interculturale', type: T, tags: ['mediazione', 'lingue'] },
    { name: 'Lingua e Cultura Italiana', type: T, tags: ['italiano', 'cultura'] },
    { name: 'Comunicazione e Didattica dell\'Italiano', type: M, tags: ['didattica italiano', 'comunicazione'] },
    { name: 'Lingue e Comunicazione Interculturale', type: M, tags: ['lingue', 'interculturalità'], internationalOpportunities: true },
  ],

  // ── UNIVERSITÀ DELLA BASILICATA ───────────────────────────────────────
  'Università degli Studi della Basilicata': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Ingegneria Industriale', type: T, tags: ['industriale'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Agraria', type: T, tags: ['agraria'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Scienze Geologiche', type: T, tags: ['geologia'] },
  ],

  // ── CATTOLICA ─────────────────────────────────────────────────────────
  'Università Cattolica del Sacro Cuore': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia', 'management'] },
    { name: 'Economia e Gestione Aziendale', type: T, tags: ['economia', 'management'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Filosofia', type: T, tags: ['filosofia'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Lingue e Letterature Straniere', type: T, tags: ['lingue'] },
    { name: 'Agraria', type: T, tags: ['agraria', 'alimentare'] },
    { name: 'Matematica', type: T, tags: ['matematica'] },
    { name: 'Marketing', type: M, tags: ['marketing', 'brand'] },
  ],

  // ── BOCCONI ───────────────────────────────────────────────────────────
  'Università Commerciale Luigi Bocconi': [
    { name: 'Economia Aziendale', type: T, tags: ['economia', 'management'] },
    { name: 'Economia e Management', type: T, tags: ['economia', 'management'] },
    { name: 'Economia e Finanza', type: T, tags: ['finanza', 'economia'] },
    { name: 'Economics and Management for Arts, Culture, Media and Entertainment', type: T, tags: ['arts', 'management', 'entertainment'] },
    { name: 'Finance', type: M, tags: ['finanza', 'investimenti'], internationalOpportunities: true },
    { name: 'Accounting, Financial Management and Control', type: M, tags: ['accounting', 'finance'] },
    { name: 'Economics and Management of Innovation and Technology', type: M, tags: ['innovazione', 'tech management'] },
    { name: 'Marketing Management', type: M, tags: ['marketing', 'brand management'] },
    { name: 'Management', type: M, tags: ['management', 'strategy'], internationalOpportunities: true },
    { name: 'Data Science and Business Analytics', type: M, tags: ['data science', 'analytics'] },
    { name: 'Law', type: M, tags: ['diritto', 'business law'], internationalOpportunities: true },
  ],

  // ── LUISS ─────────────────────────────────────────────────────────────
  'LUISS – Libera Università Internazionale degli Studi Sociali': [
    { name: 'Economia e Management', type: T, tags: ['economia', 'management'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto', 'legge'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica', 'relazioni internazionali'] },
    { name: 'Comunicazione, Tecnologie Digitali e Media', type: T, tags: ['comunicazione', 'digital'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica', 'software'] },
    { name: 'Corporate Finance', type: M, tags: ['finanza', 'corporate'], internationalOpportunities: true },
    { name: 'Business Administration', type: M, tags: ['business', 'management'], internationalOpportunities: true },
    { name: 'International Relations', type: M, tags: ['RI', 'diplomazia'], internationalOpportunities: true },
    { name: 'Diritto dell\'Impresa', type: M, tags: ['diritto', 'impresa'] },
    { name: 'Data Science and Management', type: M, tags: ['data science', 'analytics'] },
    { name: 'Giornalismo e Comunicazione', type: M, tags: ['giornalismo', 'media'] },
  ],

  // ── IULM ──────────────────────────────────────────────────────────────
  'IULM – Libera Università di Lingue e Comunicazione': [
    { name: 'Comunicazione e Media', type: T, tags: ['comunicazione', 'media'] },
    { name: 'Lingue e Comunicazione per le Imprese e le Organizzazioni', type: T, tags: ['lingue', 'comunicazione'] },
    { name: 'Comunicazione, Marketing e Consulenza per le Imprese', type: M, tags: ['marketing', 'comunicazione'] },
    { name: 'Marketing Management', type: M, tags: ['marketing', 'brand'] },
    { name: 'Turismo, Territorio e Sviluppo Locale', type: M, tags: ['turismo'] },
    { name: 'Relazioni Pubbliche e Comunicazione d\'Impresa', type: T, tags: ['PR', 'comunicazione'] },
    { name: 'Cinema', type: T, tags: ['cinema', 'audiovisivo'] },
    { name: 'Arti Visive e Moda', type: T, tags: ['moda', 'arti visive'] },
  ],

  // ── LUMSA ─────────────────────────────────────────────────────────────
  'LUMSA – Libera Università Maria Santissima Assunta': [
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Comunicazione e Media', type: T, tags: ['comunicazione'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Marketing e Gestione d\'Impresa', type: M, tags: ['marketing', 'management'] },
  ],

  // ── SUOR ORSOLA ───────────────────────────────────────────────────────
  'Università degli Studi "Suor Orsola Benincasa"': [
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Comunicazione e Marketing', type: T, tags: ['comunicazione', 'marketing'] },
    { name: 'Lingue e Letterature Straniere', type: T, tags: ['lingue'] },
    { name: 'Sociologia', type: T, tags: ['sociologia'] },
    { name: 'Beni Culturali', type: T, tags: ['beni culturali'] },
    { name: 'Progettazione e Gestione del Turismo Culturale', type: M, tags: ['turismo', 'cultura'] },
  ],

  // ── CAMPUS BIO-MEDICO ─────────────────────────────────────────────────
  'Università Campus Bio-Medico di Roma': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina', 'chirurgia'] },
    { name: 'Ingegneria Biomedica', type: T, tags: ['biomedica', 'dispositivi'] },
    { name: 'Infermieristica', type: T, tags: ['infermieristica'] },
    { name: 'Fisioterapia', type: T, tags: ['fisioterapia', 'riabilitazione'] },
    { name: 'Ingegneria dei Sistemi Medicali', type: M, tags: ['sistemi medicali', 'healthcare'] },
    { name: 'Nutritional Science', type: T, tags: ['nutrizione', 'dietetica'] },
  ],

  // ── UNIVERSITÀ EUROPEA DI ROMA ────────────────────────────────────────
  'Università Europea di Roma': [
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Design', type: T, tags: ['design'] },
    { name: 'Scienze Motorie', type: T, tags: ['sport', 'motorie'] },
  ],

  // ── VITA-SALUTE SAN RAFFAELE ──────────────────────────────────────────
  'Università Vita-Salute San Raffaele': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina', 'ricerca'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Filosofia', type: T, tags: ['filosofia', 'bioetica'] },
    { name: 'Infermieristica', type: T, tags: ['infermieristica'] },
    { name: 'Biotecnologie Mediche', type: T, tags: ['biotech', 'medicina'] },
    { name: 'Cognitive Neuroscience', type: M, tags: ['neuroscienze', 'cognitivo'], internationalOpportunities: true },
  ],

  // ── HUMANITAS ─────────────────────────────────────────────────────────
  'Humanitas University': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina', 'chirurgia'], internationalOpportunities: true },
    { name: 'Infermieristica', type: T, tags: ['infermieristica'] },
    { name: 'Fisioterapia', type: T, tags: ['fisioterapia'] },
    { name: 'Biomedical Sciences', type: T, tags: ['biomedica', 'scienze'], internationalOpportunities: true },
    { name: 'Ingegneria Biomedica', type: M, tags: ['biomedica', 'dispositivi'], internationalOpportunities: true },
  ],

  // ── LIUC ──────────────────────────────────────────────────────────────
  'LIUC – Università Cattaneo': [
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione', 'industriale'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza per l\'Impresa', type: U, tags: ['diritto', 'impresa'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Supply Chain Management', type: M, tags: ['supply chain', 'logistics'] },
    { name: 'Business Administration', type: M, tags: ['business', 'management'], internationalOpportunities: true },
  ],

  // ── UNISG ─────────────────────────────────────────────────────────────
  'Università degli Studi di Scienze Gastronomiche': [
    { name: 'Scienze Gastronomiche', type: T, tags: ['gastronomia', 'food', 'enogastronomia'] },
    { name: 'Viticoltura e Cultura del Vino', type: M, tags: ['vino', 'viticoltura'] },
    { name: 'Food Culture and Communications', type: M, tags: ['food', 'comunicazione', 'media'], internationalOpportunities: true },
  ],

  // ── GIUSTINO FORTUNATO ────────────────────────────────────────────────
  'Università degli Studi "Giustino Fortunato"': [
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
  ],

  // ── LINK CAMPUS ───────────────────────────────────────────────────────
  'Link Campus University': [
    { name: 'Comunicazione e Media', type: T, tags: ['comunicazione', 'media'] },
    { name: 'Scienze Politiche', type: T, tags: ['politica', 'sicurezza'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Cybersecurity', type: M, tags: ['cybersecurity', 'sicurezza informatica'] },
    { name: 'Intelligence e Sicurezza', type: M, tags: ['intelligence', 'sicurezza'] },
  ],

  // ── UNINT ─────────────────────────────────────────────────────────────
  'Università degli Studi Internazionali di Roma – UNINT': [
    { name: 'Lingue e Comunicazione Internazionale', type: T, tags: ['lingue', 'comunicazione'] },
    { name: 'Economia e Management', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Scienze della Mediazione Linguistica', type: T, tags: ['mediazione', 'traduzione'] },
    { name: 'Marketing Internazionale e Comunicazione', type: M, tags: ['marketing', 'comunicazione'], internationalOpportunities: true },
    { name: 'Traduzione Specializzata e Interpretariato di Conferenza', type: M, tags: ['traduzione', 'interpretariato'], internationalOpportunities: true },
  ],

  // ── LIBERA UNIVERSITÀ DI BOLZANO ──────────────────────────────────────
  'Libera Università di Bolzano': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Design e Arti', type: T, tags: ['design', 'arti'] },
    { name: 'Scienze della Formazione Primaria', type: U, tags: ['educazione', 'insegnamento'] },
    { name: 'Computer Science', type: M, tags: ['CS', 'software'], internationalOpportunities: true },
    { name: 'Ingegneria delle Tecnologie dell\'Informazione', type: M, tags: ['informatica', 'IoT'] },
    { name: 'Imprenditorialità e Innovazione', type: M, tags: ['startup', 'innovazione'], internationalOpportunities: true },
  ],

  // ── UNIVERSITÀ DELLA VALLE D'AOSTA ────────────────────────────────────
  "Università della Valle d'Aosta": [
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Lingue e Comunicazione per l\'Impresa e il Turismo', type: T, tags: ['lingue', 'turismo'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Management del Turismo', type: M, tags: ['turismo', 'management'] },
  ],

  // ── UNIVERSITÀ KORE ───────────────────────────────────────────────────
  'Università degli Studi di Enna "Kore"': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Scienze Motorie', type: T, tags: ['sport', 'motorie'] },
  ],

  // ── SAN RAFFAELE ROMA ─────────────────────────────────────────────────
  'Università degli Studi San Raffaele Roma': [
    { name: 'Medicina e Chirurgia', type: U, tags: ['medicina'] },
    { name: 'Farmacia', type: U, tags: ['farmacia'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
  ],

  // ── TELEMATICHE ───────────────────────────────────────────────────────
  'Università telematica eCampus': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Design', type: T, tags: ['design'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
  ],

  'Università telematica Pegaso': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Ingegneria Gestionale', type: T, tags: ['gestione'] },
  ],

  'Università telematica Niccolò Cusano – UNICUSANO': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Architettura', type: U, tags: ['architettura'] },
  ],

  'Università telematica Internazionale Uninettuno': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Ingegneria Civile', type: T, tags: ['civile'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Lettere', type: T, tags: ['lettere'] },
    { name: 'Ingegneria Meccanica', type: T, tags: ['meccanica'] },
  ],

  'Università telematica Leonardo da Vinci': [
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
  ],

  'UNITELMA Sapienza': [
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Informatica', type: T, tags: ['informatica'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
  ],

  'Università telematica Mercatorum': [
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Marketing e Comunicazione d\'Impresa', type: M, tags: ['marketing', 'comunicazione'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
  ],

  'Università telematica San Raffaele Roma': [
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Psicologia', type: T, tags: ['psicologia'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
  ],

  'Università telematica IUL': [
    { name: 'Scienze dell\'Educazione', type: T, tags: ['educazione'] },
    { name: 'Lingue e Comunicazione', type: T, tags: ['lingue', 'comunicazione'] },
    { name: 'Management e Formazione', type: M, tags: ['management', 'HR'] },
  ],

  'Università telematica Giustino Fortunato': [
    { name: 'Giurisprudenza', type: U, tags: ['diritto'] },
    { name: 'Economia Aziendale', type: T, tags: ['economia'] },
    { name: 'Scienze della Comunicazione', type: T, tags: ['comunicazione'] },
    { name: 'Ingegneria Informatica', type: T, tags: ['informatica'] },
  ],

  // ── NUOVE UNIVERSITÀ (GSSI E SISSA) ───────────────────────────────────
  'Gran Sasso Science Institute': [
    { name: 'Astrofisica, Particelle e Cosmologia', type: M, tags: ['fisica', 'astrofisica'], internationalOpportunities: true },
    { name: 'Matematica in Scienze Naturali, Sociali e della Vita', type: M, tags: ['matematica', 'data science'], internationalOpportunities: true },
    { name: 'Informatica', type: M, tags: ['informatica', 'CS'], internationalOpportunities: true },
    { name: 'Scienze Sociali Regionali e Urbane', type: M, tags: ['scienze sociali', 'urbanistica'], internationalOpportunities: true },
  ],

  'SISSA – Scuola Internazionale Superiore di Studi Avanzati': [
    { name: 'Fisica', type: M, tags: ['fisica', 'quantum'], internationalOpportunities: true },
    { name: 'Matematica', type: M, tags: ['matematica'], internationalOpportunities: true },
    { name: 'Neuroscienze', type: M, tags: ['neuroscienze', 'cognitive science'], internationalOpportunities: true },
    { name: 'Astrofisica e Cosmologia', type: M, tags: ['astrofisica', 'cosmologia'], internationalOpportunities: true },
    { name: 'Genomica Funzionale', type: M, tags: ['genomica', 'biotech'], internationalOpportunities: true },
  ],
};
