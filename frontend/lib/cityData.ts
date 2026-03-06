// Zone residenziali per citta universitarie italiane.
// Prezzi: medie Immobiliare.it / Idealista Q1 2026. Coordinate da Google Maps.
// Colori: #22C55E = economico (<€450), #F59E0B = medio (€450-650), #EF4444 = caro (>€650)

export interface LivingZone {
  id: string;
  name: string;
  description: string;
  center: [number, number];
  polygon: [number, number][];
  color: string;
  rentAvg: number;
  rentRange: [number, number];
  timeToUni: string;
  transport: string[];
  traits: string[];
  immobiliareUrl: string;
}

export interface CityLivingData {
  campus: [number, number];
  campusName: string;
  zones: LivingZone[];
}

function z(
  id: string, name: string, desc: string,
  center: [number, number], size: number,
  color: string, avg: number, range: [number, number],
  time: string, transport: string[], traits: string[], slug: string, city: string,
): LivingZone {
  const h = size / 2;
  return {
    id, name, description: desc, center,
    polygon: [[center[0]+h, center[1]-h], [center[0]+h, center[1]+h], [center[0]-h, center[1]+h], [center[0]-h, center[1]-h]],
    color, rentAvg: avg, rentRange: range, timeToUni: time, transport, traits,
    immobiliareUrl: `https://www.immobiliare.it/affitto-case/${city}/${slug}/`,
  };
}

const CITY_DATA: Record<string, CityLivingData> = {

  // ══════════════════════════════════════
  // MILANO — 22 quartieri
  // ══════════════════════════════════════
  Milano: {
    campus: [45.4784, 9.2275],
    campusName: 'Politecnico - Campus Leonardo',
    zones: [
      // --- EST ---
      z('citta-studi', 'Citta Studi', 'Quartiere universitario per eccellenza, a ridosso del Politecnico',
        [45.4780, 9.2300], 0.008, '#F59E0B', 650, [500, 800], '5 min a piedi',
        ['Metro M2 Piola', 'Tram 33', 'Bus 90/91'], ['Cuore studentesco', 'Molti servizi', 'Vita notturna'], 'citta-studi', 'milano'),
      z('lambrate', 'Lambrate', 'Zona creativa a est del PoliMi, design district in sviluppo',
        [45.4870, 9.2540], 0.009, '#F59E0B', 550, [420, 700], '10 min in bici',
        ['Metro M2 Lambrate', 'Treni suburbani S'], ['Zona emergente', 'Design district', 'Prezzi ok'], 'lambrate', 'milano'),
      z('ortica', 'Ortica', 'Quartiere storico operaio in forte riqualificazione artistica',
        [45.4750, 9.2470], 0.007, '#22C55E', 450, [350, 580], '12 min in bici',
        ['Metro M4 Argonne (vicina)', 'Bus 54'], ['Street art', 'In riqualificazione', 'Economica'], 'ortica', 'milano'),
      z('rubattino', 'Rubattino', 'Ex zona industriale riqualificata, residenziale e moderna',
        [45.4770, 9.2650], 0.008, '#22C55E', 480, [380, 620], '15 min in bus',
        ['Bus 54/73', 'Metro M4 (vicina)'], ['Riqualificata', 'Moderna', 'Parco Lambro vicino'], 'rubattino', 'milano'),
      z('forlanini', 'Forlanini', 'Zona est verso Linate, verde e tranquilla',
        [45.4650, 9.2580], 0.009, '#22C55E', 430, [340, 560], '20 min in bus',
        ['Bus 73', 'Metro M4 Forlanini'], ['Parco Forlanini', 'Vicino Linate', 'Tranquilla'], 'forlanini', 'milano'),

      // --- NORD ---
      z('loreto', 'Loreto', 'Snodo trasporti a nord del PoliMi, vivace e commerciale',
        [45.4855, 9.2195], 0.008, '#F59E0B', 620, [480, 780], '8 min in metro',
        ['Metro M1/M2 Loreto', 'Bus 55/81'], ['Snodo trasporti', 'Vivace', 'Commerciale'], 'loreto', 'milano'),
      z('bicocca', 'Bicocca', 'Polo universitario moderno a nord, residenziale',
        [45.5180, 9.2110], 0.009, '#22C55E', 480, [380, 600], '20 min in metro',
        ['Metro M5 Bicocca', 'Bus 87/51'], ['Campus UniBicocca', 'Tranquilla', 'Economica'], 'bicocca', 'milano'),
      z('greco', 'Greco-Pirelli', 'Zona residenziale nord, economica e con treni suburbani',
        [45.5310, 9.1990], 0.008, '#22C55E', 430, [350, 560], '22 min in metro/treno',
        ['Stazione Greco Pirelli', 'Bus 51'], ['Economica', 'Residenziale', 'Treni suburbani'], 'greco', 'milano'),
      z('zara', 'Zara-Istria', 'Zona nord in rapida trasformazione, ottimi collegamenti',
        [45.4950, 9.1970], 0.007, '#F59E0B', 580, [450, 740], '15 min in metro',
        ['Metro M3/M5 Zara', 'Tram 7'], ['Trasporti eccellenti', 'In trasformazione', 'Porta Nuova vicina'], 'zara', 'milano'),
      z('niguarda', 'Niguarda', 'Zona nord con ospedale, residenziale e verde',
        [45.5130, 9.1880], 0.009, '#22C55E', 420, [330, 550], '25 min in metro',
        ['Metro M5 Ca Granda', 'Bus 42/51'], ['Economica', 'Ospedale', 'Verde'], 'niguarda', 'milano'),
      z('maciachini', 'Maciachini-Maggiolina', 'Zona residenziale nordovest in riqualificazione',
        [45.4990, 9.1830], 0.007, '#F59E0B', 550, [430, 700], '18 min in metro',
        ['Metro M3 Maciachini', 'Bus 82/43'], ['In riqualificazione', 'Buoni trasporti', 'Residenziale'], 'maciachini', 'milano'),

      // --- OVEST ---
      z('bovisa', 'Bovisa', 'Secondo campus PoliMi, zona in forte riqualificazione',
        [45.5040, 9.1560], 0.008, '#22C55E', 480, [380, 620], '15 min in treno S',
        ['Stazione Bovisa FN', 'Bus 82/92'], ['Campus PoliMi Bovisa', 'Economica', 'In sviluppo'], 'bovisa', 'milano'),
      z('portello', 'Portello', 'Nuova zona residenziale con CityLife, moderna',
        [45.4810, 9.1700], 0.007, '#EF4444', 700, [540, 900], '18 min in metro',
        ['Metro M5 Portello/Tre Torri', 'Bus 68'], ['CityLife', 'Moderna', 'Shopping'], 'portello', 'milano'),
      z('san-siro', 'San Siro', 'Zona ovest con stadio, residenziale e ben collegata',
        [45.4760, 9.1480], 0.009, '#F59E0B', 520, [400, 680], '25 min in metro',
        ['Metro M5 San Siro', 'Tram 16'], ['Stadio', 'Residenziale', 'Verde'], 'san-siro', 'milano'),
      z('certosa', 'Certosa', 'Zona nordovest periferica, economica e tranquilla',
        [45.5000, 9.1380], 0.009, '#22C55E', 400, [310, 520], '25 min in treno',
        ['Stazione Certosa FN', 'Bus 78'], ['Periferica', 'Molto economica', 'Tranquilla'], 'certosa', 'milano'),

      // --- SUD ---
      z('porta-romana', 'Porta Romana', 'Quartiere elegante e verde a sud del centro',
        [45.4510, 9.2040], 0.008, '#EF4444', 720, [550, 900], '20 min in tram',
        ['Metro M3 Porta Romana', 'Tram 9/16'], ['Elegante', 'Verde', 'Residenziale'], 'porta-romana', 'milano'),
      z('navigli', 'Navigli', 'Zona movida lungo i canali storici',
        [45.4470, 9.1730], 0.008, '#EF4444', 750, [580, 1000], '25 min in metro',
        ['Metro M2 P.ta Genova', 'Tram 3/9'], ['Movida', 'Canali storici', 'Locali'], 'navigli', 'milano'),
      z('porta-venezia', 'Porta Venezia', 'Quartiere multiculturale e vivace, giardini Montanelli',
        [45.4755, 9.2080], 0.007, '#EF4444', 780, [600, 1000], '15 min in metro',
        ['Metro M1 Porta Venezia', 'Tram 9/33'], ['Centrale', 'Multiculturale', 'Vivace'], 'porta-venezia', 'milano'),
      z('rogoredo', 'Rogoredo-Santa Giulia', 'Zona sud-est in sviluppo, stazione alta velocita',
        [45.4360, 9.2330], 0.009, '#22C55E', 450, [360, 580], '20 min in metro',
        ['Metro M3 Rogoredo', 'Treni AV'], ['In sviluppo', 'Alta velocita', 'Moderna'], 'rogoredo', 'milano'),
      z('corvetto', 'Corvetto', 'Zona sud popolare, multietnica e economica',
        [45.4440, 9.2250], 0.008, '#22C55E', 400, [310, 520], '15 min in metro',
        ['Metro M3 Corvetto', 'Bus 77/95'], ['Economica', 'Multietnica', 'Ben collegata'], 'corvetto', 'milano'),
      z('ripamonti', 'Ripamonti', 'Zona sud residenziale lungo viale Ripamonti',
        [45.4380, 9.2080], 0.008, '#F59E0B', 520, [400, 680], '22 min in tram',
        ['Tram 24', 'Bus 65/79'], ['Residenziale', 'Viale alberato', 'Tranquilla'], 'ripamonti', 'milano'),
      z('ticinese', 'Ticinese-Colonne', 'Zona storica con Colonne di San Lorenzo, vivace',
        [45.4560, 9.1810], 0.006, '#EF4444', 700, [530, 900], '20 min in tram',
        ['Tram 3/14', 'Bus 94'], ['Storica', 'Colonne', 'Vita notturna'], 'ticinese', 'milano'),
    ],
  },

  // ══════════════════════════════════════
  // BOLOGNA — 15 quartieri
  // ══════════════════════════════════════
  Bologna: {
    campus: [44.4967, 11.3525],
    campusName: 'Alma Mater - Via Zamboni',
    zones: [
      z('zona-universitaria', 'Zona Universitaria', 'Cuore studentesco, Via Zamboni e Via Belle Arti',
        [44.4975, 11.3530], 0.006, '#F59E0B', 520, [400, 700], '5 min a piedi',
        ['Bus 11/13/20', 'Piste ciclabili'], ['Zona vivace', 'Studenti ovunque', 'Locali'], 'zona-universitaria', 'bologna'),
      z('irnerio', 'Irnerio', 'Nord del centro storico, studentesca e vivace',
        [44.5000, 11.3430], 0.005, '#F59E0B', 490, [380, 630], '10 min a piedi',
        ['Bus 11/20', 'A piedi'], ['Studentesca', 'Vicina al campus', 'Vivace'], 'irnerio', 'bologna'),
      z('centro-storico-bo', 'Centro Storico', 'Piazza Maggiore e Due Torri, cuore medievale',
        [44.4940, 11.3430], 0.006, '#EF4444', 620, [480, 800], '8 min a piedi',
        ['Tutto a piedi', 'Bus T1/T2'], ['Prestigiosa', 'Architettura storica', 'Prezzi elevati'], 'centro-storico', 'bologna'),
      z('santo-stefano', 'Santo Stefano', 'Elegante, vicina ai Giardini Margherita',
        [44.4900, 11.3500], 0.006, '#EF4444', 600, [460, 780], '10 min a piedi',
        ['Bus 13/30', 'A piedi'], ['Elegante', 'Giardini Margherita', 'Prestigiosa'], 'santo-stefano', 'bologna'),
      z('san-donato', 'San Donato', 'Nord-est del centro, residenziale e tranquilla',
        [44.5060, 11.3650], 0.008, '#22C55E', 420, [320, 550], '15 min in bus',
        ['Bus 14/27', 'Piste ciclabili'], ['Tranquilla', 'Prezzi competitivi', 'Parchi'], 'san-donato', 'bologna'),
      z('san-vitale', 'San Vitale', 'Est del centro, residenziale con giardini',
        [44.5020, 11.3680], 0.007, '#22C55E', 430, [340, 570], '12 min in bici',
        ['Bus 32/33', 'Piste ciclabili'], ['Residenziale', 'Giardini', 'Accessibile'], 'san-vitale', 'bologna'),
      z('mazzini', 'Mazzini', 'Est del centro, buon compromesso prezzo-posizione',
        [44.4920, 11.3600], 0.006, '#F59E0B', 460, [360, 600], '12 min in bici',
        ['Bus 32/33', 'Piste ciclabili'], ['Buon compromesso', 'Residenziale', 'Verde'], 'mazzini', 'bologna'),
      z('bolognina', 'Bolognina', 'Nord della stazione, multiculturale e in riqualificazione',
        [44.5060, 11.3440], 0.008, '#22C55E', 380, [300, 500], '15 min in bus',
        ['Bus 25/27', 'Stazione Centrale'], ['Economica', 'Multiculturale', 'In riqualificazione'], 'bolognina', 'bologna'),
      z('navile', 'Navile', 'Nord, zona ex-industriale in trasformazione con Manifattura',
        [44.5120, 11.3500], 0.008, '#22C55E', 360, [280, 470], '20 min in bus',
        ['Bus 27/28', 'Treno SFM'], ['Economica', 'In trasformazione', 'Manifattura Tabacchi'], 'navile', 'bologna'),
      z('saffi', 'Saffi', 'Sud-ovest, residenziale con ospedale Maggiore',
        [44.4900, 11.3280], 0.007, '#F59E0B', 450, [350, 580], '20 min in bus',
        ['Bus 21/36', 'Piste ciclabili'], ['Residenziale', 'Buoni servizi', 'Ospedale vicino'], 'saffi', 'bologna'),
      z('porto-saragozza', 'Porto-Saragozza', 'Verso le colline, Portico di San Luca',
        [44.4880, 11.3340], 0.006, '#EF4444', 580, [450, 750], '20 min in bus',
        ['Bus 20/32', 'A piedi dal centro'], ['Elegante', 'Colline', 'Tranquilla'], 'saragozza', 'bologna'),
      z('borgo-panigale', 'Borgo Panigale', 'Ovest, la piu economica, vicino aeroporto',
        [44.5070, 11.2950], 0.010, '#22C55E', 350, [280, 450], '25 min in bus',
        ['Bus 19/87', 'People mover'], ['Molto economica', 'Tranquilla', 'Aeroporto'], 'borgo-panigale', 'bologna'),
      z('savena', 'Savena', 'Sud-est, residenziale e verde con parchi',
        [44.4830, 11.3620], 0.008, '#22C55E', 400, [310, 520], '18 min in bus',
        ['Bus 27/32', 'Piste ciclabili'], ['Residenziale', 'Verde', 'Familiare'], 'savena', 'bologna'),
      z('corticella', 'Corticella', 'Periferia nord, molto economica',
        [44.5200, 11.3480], 0.008, '#22C55E', 330, [260, 430], '25 min in bus',
        ['Bus 27/97', 'Treno SFM'], ['Molto economica', 'Periferica', 'Tranquilla'], 'corticella', 'bologna'),
      z('costa-andrea', 'Andrea Costa', 'Ovest del centro, residenziale e ben collegata',
        [44.4930, 11.3200], 0.007, '#F59E0B', 460, [360, 600], '18 min in bus',
        ['Bus 20/21', 'Piste ciclabili'], ['Residenziale', 'Stadio vicino', 'Ben collegata'], 'andrea-costa', 'bologna'),
    ],
  },

  // ══════════════════════════════════════
  // ROMA — 22 quartieri
  // ══════════════════════════════════════
  Roma: {
    campus: [41.9020, 12.5148],
    campusName: 'Sapienza - Citta Universitaria',
    zones: [
      // --- CENTRO-EST ---
      z('san-lorenzo-rm', 'San Lorenzo', 'Quartiere studentesco storico, vivace e accessibile',
        [41.8975, 12.5170], 0.007, '#F59E0B', 520, [400, 680], '10 min a piedi',
        ['Tram 3/19', 'Stazione Tiburtina (vicina)'], ['Quartiere studentesco', 'Vita notturna', 'Street art'], 'san-lorenzo', 'roma'),
      z('tiburtina-rm', 'Tiburtina', 'Grande stazione, ben collegata e in sviluppo',
        [41.9110, 12.5300], 0.008, '#22C55E', 450, [350, 580], '15 min in bus',
        ['Metro B Tiburtina', 'Treni regionali/AV'], ['Ben collegata', 'In sviluppo', 'Stazione AV'], 'tiburtina', 'roma'),
      z('pigneto-rm', 'Pigneto', 'Trendy e multiculturale, vita notturna alternativa',
        [41.8890, 12.5260], 0.007, '#F59E0B', 480, [370, 620], '20 min in tram',
        ['Tram 5/14', 'Bus 105/409'], ['Trendy', 'Multiculturale', 'Vita notturna'], 'pigneto', 'roma'),
      z('torpignattara-rm', 'Torpignattara', 'Quartiere popolare multietnico, in riqualificazione',
        [41.8830, 12.5380], 0.008, '#22C55E', 400, [310, 520], '25 min in bus',
        ['Bus 105/409', 'Metro C Malatesta'], ['Economica', 'Multietnica', 'In riqualificazione'], 'torpignattara', 'roma'),
      z('prenestino-rm', 'Prenestino', 'Zona est popolare lungo Via Prenestina',
        [41.8890, 12.5460], 0.008, '#22C55E', 420, [330, 550], '25 min in metro',
        ['Metro C', 'Bus 412/451'], ['Popolare', 'Economica', 'Metro C'], 'prenestino', 'roma'),
      z('casilino-rm', 'Casilino', 'Periferia est, molto economica con metro C',
        [41.8770, 12.5560], 0.009, '#22C55E', 370, [290, 480], '30 min in metro',
        ['Metro C Gardenie/Mirti', 'Bus 552'], ['Molto economica', 'Periferica', 'Metro C'], 'casilino', 'roma'),

      // --- NORD ---
      z('bologna-rm', 'Quartiere Bologna', 'A nord della Sapienza, residenziale con metro',
        [41.9160, 12.5180], 0.007, '#F59E0B', 520, [400, 680], '12 min in bus',
        ['Metro B Bologna', 'Bus 36/490'], ['Residenziale', 'Metro B', 'Tranquillo'], 'bologna', 'roma'),
      z('nomentano-rm', 'Nomentano', 'Zona residenziale elegante a nord del campus',
        [41.9100, 12.5070], 0.006, '#EF4444', 650, [500, 850], '10 min in bus',
        ['Bus 36/90', 'Tram 3/19'], ['Elegante', 'Residenziale', 'Vicina al campus'], 'nomentano', 'roma'),
      z('montesacro-rm', 'Montesacro', 'Nord-est, residenziale e verde, economica',
        [41.9340, 12.5220], 0.009, '#22C55E', 420, [330, 550], '25 min in bus',
        ['Metro B1 Conca d\'Oro', 'Bus 60/82'], ['Economica', 'Verde', 'Residenziale'], 'montesacro', 'roma'),
      z('africano-rm', 'Africano', 'Nord, zona residenziale tranquilla con servizi',
        [41.9230, 12.5110], 0.007, '#F59E0B', 480, [380, 620], '18 min in bus',
        ['Metro B1 Libia', 'Bus 92/310'], ['Residenziale', 'Tranquilla', 'Servizi'], 'africano', 'roma'),
      z('salario-rm', 'Salario-Trieste', 'Zona nord elegante, ottimi collegamenti',
        [41.9120, 12.4970], 0.007, '#EF4444', 680, [520, 880], '15 min in bus',
        ['Bus 63/83/92', 'Metro B1 Sant\'Agnese'], ['Elegante', 'Ben collegata', 'Commerciale'], 'salario-trieste', 'roma'),

      // --- SUD ---
      z('ostiense-rm', 'Ostiense', 'Ex industriale riconvertita, sede Roma Tre',
        [41.8700, 12.4810], 0.007, '#F59E0B', 530, [400, 700], '25 min in metro',
        ['Metro B Garbatella/Basilica S. Paolo', 'Bus 23/769'], ['Roma Tre', 'Ex industriale', 'Locali'], 'ostiense', 'roma'),
      z('garbatella-rm', 'Garbatella', 'Storico popolare a sud, architettura unica',
        [41.8650, 12.4920], 0.007, '#22C55E', 450, [350, 580], '25 min in metro',
        ['Metro B Garbatella', 'Bus 670/716'], ['Storico', 'Comunita forte', 'Economico'], 'garbatella', 'roma'),
      z('testaccio-rm', 'Testaccio', 'Popolare storico con mercato rionale e locali',
        [41.8770, 12.4770], 0.006, '#F59E0B', 580, [440, 750], '25 min in metro',
        ['Metro B Piramide', 'Tram 3'], ['Mercato rionale', 'Popolare', 'Vita notturna'], 'testaccio', 'roma'),
      z('san-paolo-rm', 'San Paolo', 'Zona sud con Basilica, residenziale e accessibile',
        [41.8580, 12.4790], 0.008, '#22C55E', 430, [340, 560], '30 min in metro',
        ['Metro B Marconi/San Paolo', 'Bus 23/128'], ['Residenziale', 'Basilica', 'Economica'], 'san-paolo', 'roma'),
      z('marconi-rm', 'Marconi', 'Zona residenziale sud, pratica e economica',
        [41.8530, 12.4730], 0.007, '#22C55E', 410, [320, 540], '30 min in metro',
        ['Metro B Marconi', 'Bus 128/170'], ['Economica', 'Pratica', 'Tranquilla'], 'marconi', 'roma'),

      // --- OVEST ---
      z('trastevere-rm', 'Trastevere', 'Storico e caratteristico sulla riva ovest del Tevere',
        [41.8890, 12.4690], 0.007, '#EF4444', 700, [530, 950], '30 min in tram',
        ['Tram 8', 'Bus H/780'], ['Caratteristico', 'Vita notturna', 'Turistico'], 'trastevere', 'roma'),
      z('prati-rm', 'Prati', 'Elegante a ovest, vicino Vaticano e Castel Sant\'Angelo',
        [41.9060, 12.4560], 0.007, '#EF4444', 720, [550, 950], '30 min in metro',
        ['Metro A Lepanto/Ottaviano', 'Bus 70/280'], ['Elegante', 'Vaticano', 'Commerciale'], 'prati', 'roma'),
      z('della-vittoria-rm', 'Della Vittoria', 'Zona residenziale ovest, tranquilla e ben servita',
        [41.9160, 12.4530], 0.007, '#F59E0B', 560, [430, 720], '30 min in bus',
        ['Bus 32/69', 'Metro A (vicina)'], ['Residenziale', 'Tranquilla', 'Foro Italico vicino'], 'della-vittoria', 'roma'),
      z('aurelio-rm', 'Aurelio', 'Zona ovest oltre il Vaticano, economica e collegata',
        [41.9000, 12.4360], 0.008, '#22C55E', 440, [340, 570], '35 min in metro',
        ['Metro A Baldo degli Ubaldi/Valle Aurelia', 'Bus 247'], ['Economica', 'Periferica', 'Metro A'], 'aurelio', 'roma'),
      z('portuense-rm', 'Portuense', 'Zona sud-ovest residenziale, prezzi contenuti',
        [41.8700, 12.4500], 0.008, '#22C55E', 420, [330, 550], '35 min in bus',
        ['Treno FL1 Trastevere', 'Bus 170/871'], ['Economica', 'Residenziale', 'Stazione Trastevere'], 'portuense', 'roma'),
    ],
  },

  // ══════════════════════════════════════
  // TORINO — 18 quartieri
  // ══════════════════════════════════════
  Torino: {
    campus: [45.0628, 7.6620],
    campusName: 'Politecnico - Corso Duca degli Abruzzi',
    zones: [
      // --- VICINI AL CAMPUS ---
      z('cenisia', 'Cenisia', 'A ridosso del PoliTo, molto studentesco',
        [45.0650, 7.6550], 0.008, '#22C55E', 400, [300, 520], '5 min a piedi',
        ['Bus 56/58', 'Tram 10'], ['Vicinissimo al PoliTo', 'Studenti', 'Servizi'], 'cenisia', 'torino'),
      z('crocetta-to', 'Crocetta', 'Elegante e tranquillo, adiacente al campus sud',
        [45.0580, 7.6620], 0.007, '#F59E0B', 480, [380, 620], '5 min a piedi',
        ['Metro Nizza/Dante', 'Tram 4/10'], ['Elegante', 'Tranquillo', 'Adiacente PoliTo'], 'crocetta', 'torino'),
      z('san-paolo-to', 'San Paolo', 'Ovest del centro, residenziale e ben servito',
        [45.0710, 7.6430], 0.008, '#22C55E', 380, [290, 490], '12 min in tram',
        ['Tram 3/10', 'Bus 56'], ['Residenziale', 'Economica', 'Mercato rionale'], 'san-paolo', 'torino'),

      // --- CENTRO ---
      z('san-salvario-to', 'San Salvario', 'Vivace e multiculturale, cuore della movida',
        [45.0560, 7.6740], 0.007, '#F59E0B', 420, [320, 550], '15 min in bici',
        ['Metro Nizza', 'Bus 18/67', 'Tram 4'], ['Movida', 'Multiculturale', 'Piazza Carlina'], 'san-salvario', 'torino'),
      z('vanchiglia-to', 'Vanchiglia', 'Universitario storico, bohemien e campus UniTo',
        [45.0710, 7.6930], 0.007, '#F59E0B', 430, [340, 570], '15 min in bus',
        ['Bus 61/68', 'A piedi dal centro'], ['Bohemien', 'Campus UniTo', 'Caratteristico'], 'vanchiglia', 'torino'),
      z('centro-to', 'Centro-Quadrilatero', 'Cuore storico di Torino, Via Po e Piazza Castello',
        [45.0700, 7.6830], 0.006, '#EF4444', 650, [500, 850], '15 min in bus',
        ['Metro Porta Nuova', 'Tram 13/15'], ['Centrale', 'Storico', 'Prestigioso'], 'centro', 'torino'),

      // --- NORD ---
      z('aurora-to', 'Aurora', 'Popolare a nord, Porta Palazzo e multietnico',
        [45.0790, 7.6830], 0.008, '#22C55E', 350, [270, 460], '15 min in bus',
        ['Bus 51/57', 'Tram 4/16'], ['Molto economica', 'Porta Palazzo', 'Multietnico'], 'aurora', 'torino'),
      z('barriera-to', 'Barriera di Milano', 'Nord, popolare e in riqualificazione',
        [45.0880, 7.7000], 0.008, '#22C55E', 320, [250, 420], '20 min in bus',
        ['Bus 49/51', 'Tram 3'], ['Molto economica', 'In riqualificazione', 'Popolare'], 'barriera-di-milano', 'torino'),
      z('rebaudengo-to', 'Rebaudengo', 'Periferia nord, economica con stazione Dora',
        [45.0950, 7.6920], 0.008, '#22C55E', 310, [240, 400], '22 min in bus',
        ['Stazione Dora', 'Bus 46/57'], ['Periferica', 'Molto economica', 'Stazione Dora'], 'rebaudengo', 'torino'),

      // --- EST ---
      z('borgo-po-to', 'Borgo Po', 'Sulla riva destra del Po, tranquillo con collina',
        [45.0580, 7.6990], 0.007, '#F59E0B', 460, [360, 600], '20 min in bus',
        ['Bus 53/73', 'Lungo Po ciclabile'], ['Tranquillo', 'Verde', 'Vista collina'], 'borgo-po', 'torino'),
      z('crimea-to', 'Crimea', 'Est del centro, zona residenziale elegante',
        [45.0650, 7.6980], 0.006, '#F59E0B', 500, [390, 650], '18 min in bus',
        ['Bus 61/68', 'Lungo Po'], ['Elegante', 'Residenziale', 'Lungo Po'], 'crimea', 'torino'),
      z('madonna-pilone-to', 'Madonna del Pilone', 'Oltre il Po, residenziale e verde',
        [45.0530, 7.7100], 0.008, '#22C55E', 380, [300, 500], '25 min in bus',
        ['Bus 53/56', 'GTT'], ['Residenziale', 'Verde', 'Tranquilla'], 'madonna-del-pilone', 'torino'),

      // --- SUD ---
      z('santa-rita-to', 'Santa Rita', 'Residenziale tranquilla a sud, famiglie',
        [45.0450, 7.6500], 0.008, '#22C55E', 350, [280, 450], '20 min in bus',
        ['Metro Lingotto (vicina)', 'Bus 63/35'], ['Economica', 'Tranquilla', 'Familiare'], 'santa-rita', 'torino'),
      z('lingotto-to', 'Lingotto', 'Ex FIAT riqualificata, moderna con centro commerciale',
        [45.0310, 7.6660], 0.008, '#22C55E', 380, [300, 500], '20 min in metro',
        ['Metro Lingotto', 'Bus 1/34'], ['Moderna', 'Centro commerciale', 'In sviluppo'], 'lingotto', 'torino'),
      z('mirafiori-to', 'Mirafiori Nord', 'Periferia sud-ovest, molto economica',
        [45.0360, 7.6370], 0.009, '#22C55E', 320, [250, 420], '25 min in bus',
        ['Bus 63/34'], ['Molto economica', 'Periferica', 'Tranquilla'], 'mirafiori', 'torino'),
      z('nizza-millefonti-to', 'Nizza-Millefonti', 'Sud lungo il Po, zona in trasformazione',
        [45.0430, 7.6750], 0.007, '#22C55E', 400, [310, 520], '18 min in bus',
        ['Bus 18/45', 'Metro (vicina)'], ['In trasformazione', 'Lungo Po', 'Economica'], 'nizza-millefonti', 'torino'),

      // --- OVEST ---
      z('pozzo-strada-to', 'Pozzo Strada', 'Ovest, residenziale e ben collegata, Juventus Stadium',
        [45.0720, 7.6200], 0.009, '#22C55E', 360, [280, 470], '20 min in bus',
        ['Bus 36/56', 'Treno Collegno'], ['Residenziale', 'Stadium', 'Economica'], 'pozzo-strada', 'torino'),
      z('parella-to', 'Parella', 'Nordovest, residenziale e tranquilla',
        [45.0810, 7.6370], 0.008, '#22C55E', 370, [290, 480], '20 min in bus',
        ['Bus 36/64', 'Tram 3'], ['Residenziale', 'Tranquilla', 'Economica'], 'parella', 'torino'),
    ],
  },
};

export function getCityData(city: string): CityLivingData | null {
  return CITY_DATA[city] || null;
}
