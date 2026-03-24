import { PrismaClient, GpaRange, EnglishLevel, WillingnessToRelocate, OpportunityType, CourseType } from '@prisma/client';
import bcrypt from 'bcrypt';

if (process.env.NODE_ENV === 'production') {
  console.error('Seed non può essere eseguito in produzione!');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.postComment.deleteMany();
  await prisma.postLike.deleteMany();
  await prisma.post.deleteMany();
  await prisma.pathMatesMessage.deleteMany();
  await prisma.pathMatesGroup.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.friendRequest.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.opportunity.deleteMany();
  await prisma.course.deleteMany();
  await prisma.university.deleteMany();

  // ============ UNIVERSITIES ============
  const universities = await Promise.all([
    prisma.university.create({
      data: {
        name: 'Università di Bologna',
        city: 'Bologna',
        description: 'La più antica università del mondo occidentale, fondata nel 1088. Eccellenza nella ricerca e nella formazione con una forte vocazione internazionale.',
        websiteUrl: 'https://www.unibo.it',
        alumniCount: 85000,
        avgRating: 4.5,
      },
    }),
    prisma.university.create({
      data: {
        name: 'Politecnico di Milano',
        city: 'Milano',
        description: 'Eccellenza italiana nell\'ingegneria, architettura e design. Tra le prime università tecniche in Europa per ricerca e innovazione.',
        websiteUrl: 'https://www.polimi.it',
        alumniCount: 95000,
        avgRating: 4.7,
      },
    }),
    prisma.university.create({
      data: {
        name: 'Sapienza Università di Roma',
        city: 'Roma',
        description: 'La più grande università d\'Europa, con un\'offerta formativa vastissima e centri di ricerca d\'eccellenza in tutti i campi del sapere.',
        websiteUrl: 'https://www.uniroma1.it',
        alumniCount: 112000,
        avgRating: 4.3,
      },
    }),
    prisma.university.create({
      data: {
        name: 'Università di Torino',
        city: 'Torino',
        description: 'Ateneo con forte tradizione nella ricerca scientifica e umanistica, situato nel cuore di una città innovativa e tecnologica.',
        websiteUrl: 'https://www.unito.it',
        alumniCount: 70000,
        avgRating: 4.2,
      },
    }),
    prisma.university.create({
      data: {
        name: 'Università Federico II',
        city: 'Napoli',
        description: 'Fondata nel 1224, è una delle più antiche università pubbliche al mondo. Leader nella ricerca scientifica del Sud Italia.',
        websiteUrl: 'https://www.unina.it',
        alumniCount: 80000,
        avgRating: 4.1,
      },
    }),
    prisma.university.create({
      data: {
        name: 'Università di Firenze',
        city: 'Firenze',
        description: 'Ateneo di grande tradizione nel cuore del Rinascimento, con eccellenze in discipline umanistiche, scientifiche e mediche.',
        websiteUrl: 'https://www.unifi.it',
        alumniCount: 55000,
        avgRating: 4.2,
      },
    }),
    prisma.university.create({
      data: {
        name: 'Politecnico di Torino',
        city: 'Torino',
        description: 'Eccellenza nell\'ingegneria e nell\'architettura, con forti legami con il mondo industriale e dell\'innovazione.',
        websiteUrl: 'https://www.polito.it',
        alumniCount: 60000,
        avgRating: 4.6,
      },
    }),
    prisma.university.create({
      data: {
        name: 'Università Ca\' Foscari',
        city: 'Venezia',
        description: 'Prima business school in Italia, oggi eccellenza in lingue, economia, scienze ambientali e digital humanities.',
        websiteUrl: 'https://www.unive.it',
        alumniCount: 35000,
        avgRating: 4.3,
      },
    }),
    prisma.university.create({
      data: {
        name: 'Università di Padova',
        city: 'Padova',
        description: 'Tra le più antiche e prestigiose d\'Europa, con eccellenze in medicina, ingegneria e scienze. Fondata nel 1222.',
        websiteUrl: 'https://www.unipd.it',
        alumniCount: 65000,
        avgRating: 4.5,
      },
    }),
    prisma.university.create({
      data: {
        name: 'Università di Pisa',
        city: 'Pisa',
        description: 'Ateneo di prestigio con la Scuola Normale Superiore, eccellenza nella ricerca scientifica e nella formazione d\'élite.',
        websiteUrl: 'https://www.unipi.it',
        alumniCount: 50000,
        avgRating: 4.4,
      },
    }),
  ]);

  const [bologna, polimi, sapienza, torino, federicoII, firenze, polito, caFoscari, padova, pisa] = universities;

  // ============ COURSES ============
  const coursesData = [
    { universityId: polimi.id, name: 'Ingegneria Informatica', type: CourseType.TRIENNALE },
    { universityId: polimi.id, name: 'Computer Science and Engineering', type: CourseType.MAGISTRALE },
    { universityId: polimi.id, name: 'Design della Comunicazione', type: CourseType.TRIENNALE },
    { universityId: bologna.id, name: 'Informatica', type: CourseType.TRIENNALE },
    { universityId: bologna.id, name: 'Economia e Commercio', type: CourseType.TRIENNALE },
    { universityId: bologna.id, name: 'Giurisprudenza', type: CourseType.CICLO_UNICO },
    { universityId: sapienza.id, name: 'Medicina e Chirurgia', type: CourseType.CICLO_UNICO },
    { universityId: sapienza.id, name: 'Ingegneria Aerospaziale', type: CourseType.MAGISTRALE },
    { universityId: torino.id, name: 'Economia Aziendale', type: CourseType.TRIENNALE },
    { universityId: federicoII.id, name: 'Ingegneria Biomedica', type: CourseType.MAGISTRALE },
    { universityId: firenze.id, name: 'Architettura', type: CourseType.CICLO_UNICO },
    { universityId: polito.id, name: 'Ingegneria Meccanica', type: CourseType.TRIENNALE },
    { universityId: caFoscari.id, name: 'Economia e Management', type: CourseType.TRIENNALE },
    { universityId: padova.id, name: 'Psicologia', type: CourseType.TRIENNALE },
    { universityId: pisa.id, name: 'Matematica', type: CourseType.TRIENNALE },
  ];

  await prisma.course.createMany({ data: coursesData });

  // ============ OPPORTUNITIES ============
  const opportunities = [
    // INTERNSHIPS
    { title: 'Software Engineer Intern', description: 'Unisciti al team di sviluppo di una delle startup più innovative d\'Italia. Lavorerai su progetti React e Node.js in un ambiente dinamico e collaborativo.', type: OpportunityType.INTERNSHIP, company: 'Satispay', location: 'Milano', tags: ['tech', 'startup', 'react', 'nodejs'], requiredEnglishLevel: EnglishLevel.B1_B2, minGpa: GpaRange.GPA_25_27, universityId: polimi.id },
    { title: 'Data Science Intern', description: 'Analizza grandi volumi di dati per estrarre insight strategici. Utilizzerai Python, SQL e strumenti di machine learning per risolvere problemi reali.', type: OpportunityType.INTERNSHIP, company: 'Enel', location: 'Roma', tags: ['data', 'python', 'ml'], requiredEnglishLevel: EnglishLevel.B1_B2, minGpa: GpaRange.GPA_25_27 },
    { title: 'Marketing Intern', description: 'Supporta il team marketing nella creazione di campagne digitali, analisi di mercato e gestione dei social media per brand internazionali.', type: OpportunityType.INTERNSHIP, company: 'Barilla', location: 'Parma', tags: ['marketing', 'social', 'digital'], minGpa: GpaRange.GPA_21_24 },
    { title: 'UX Design Intern', description: 'Collabora con designer senior per creare esperienze utente intuitive. Prototipazione in Figma, ricerca utente e test di usabilità.', type: OpportunityType.INTERNSHIP, company: 'Bending Spoons', location: 'Milano', isRemote: true, tags: ['design', 'ux', 'figma'], requiredEnglishLevel: EnglishLevel.C1, minGpa: GpaRange.GPA_25_27 },
    { title: 'Business Analyst Intern', description: 'Supporta il team di consulenza strategica in progetti di trasformazione digitale per grandi aziende italiane ed europee.', type: OpportunityType.INTERNSHIP, company: 'McKinsey & Company', location: 'Milano', tags: ['consulting', 'strategy', 'business'], requiredEnglishLevel: EnglishLevel.C1, minGpa: GpaRange.GPA_28_30 },
    { title: 'Frontend Developer Intern', description: 'Sviluppa interfacce web moderne con React e TypeScript. Ambiente giovane con code review e mentoring dedicato.', type: OpportunityType.INTERNSHIP, company: 'Subito.it', location: 'Milano', isRemote: true, tags: ['tech', 'frontend', 'react', 'typescript'], requiredEnglishLevel: EnglishLevel.B1_B2, minGpa: GpaRange.GPA_21_24 },
    // STAGES
    { title: 'Stage in Revisione Contabile', description: 'Partecipa a progetti di revisione per aziende quotate. Formazione continua e possibilità di crescita in un ambiente internazionale.', type: OpportunityType.STAGE, company: 'PwC', location: 'Roma', tags: ['finance', 'audit', 'consulting'], requiredEnglishLevel: EnglishLevel.B1_B2, minGpa: GpaRange.GPA_25_27 },
    { title: 'Stage in Ricerca e Sviluppo', description: 'Contribuisci alla ricerca su materiali innovativi e processi produttivi sostenibili nel settore automotive.', type: OpportunityType.STAGE, company: 'Ferrari', location: 'Maranello', tags: ['engineering', 'r&d', 'automotive'], requiredEnglishLevel: EnglishLevel.B1_B2, minGpa: GpaRange.GPA_28_30 },
    { title: 'Stage in Comunicazione Aziendale', description: 'Supporta il team comunicazione nella creazione di contenuti, gestione PR e organizzazione eventi corporate.', type: OpportunityType.STAGE, company: 'Luxottica', location: 'Milano', tags: ['communication', 'pr', 'events'], minGpa: GpaRange.GPA_21_24 },
    { title: 'Stage in Cybersecurity', description: 'Entra nel team di sicurezza informatica. Vulnerability assessment, penetration testing e incident response su infrastrutture critiche.', type: OpportunityType.STAGE, company: 'Leonardo', location: 'Roma', tags: ['tech', 'security', 'cybersecurity'], requiredEnglishLevel: EnglishLevel.C1, minGpa: GpaRange.GPA_25_27 },
    { title: 'Stage in Supply Chain', description: 'Ottimizza i processi logistici e di approvvigionamento per uno dei leader mondiali della moda.', type: OpportunityType.STAGE, company: 'Gucci', location: 'Firenze', tags: ['logistics', 'fashion', 'operations'], requiredEnglishLevel: EnglishLevel.B1_B2, minGpa: GpaRange.GPA_21_24, universityId: firenze.id },
    // EXTRACURRICULAR
    { title: 'TEDxPolimi Speaker Program', description: 'Partecipa come speaker al prossimo evento TEDx del Politecnico. Formazione su public speaking e storytelling inclusa.', type: OpportunityType.EXTRACURRICULAR, location: 'Milano', tags: ['speaking', 'leadership', 'community'], universityId: polimi.id },
    { title: 'JEBologna - Junior Enterprise', description: 'Entra nella Junior Enterprise di Bologna. Lavora su progetti di consulenza per PMI, sviluppa competenze manageriali e imprenditoriali.', type: OpportunityType.EXTRACURRICULAR, location: 'Bologna', tags: ['consulting', 'entrepreneurship', 'teamwork'], universityId: bologna.id },
    { title: 'Hackathon IoT & Smart Cities', description: '48 ore di hackathon sulle smart cities. Premi in palio, mentoring da esperti del settore e networking con aziende tech.', type: OpportunityType.EXTRACURRICULAR, location: 'Torino', tags: ['tech', 'iot', 'hackathon', 'innovation'] },
    { title: 'Orchestra Universitaria di Padova', description: 'Unisciti all\'orchestra universitaria. Prove settimanali, concerti in teatro e tournée in Italia ed Europa.', type: OpportunityType.EXTRACURRICULAR, location: 'Padova', tags: ['music', 'culture', 'performance'], universityId: padova.id },
    { title: 'Volontariato Tutoring Migranti', description: 'Insegna italiano e competenze digitali a rifugiati e migranti. Formazione pedagogica inclusa e certificato di volontariato.', type: OpportunityType.EXTRACURRICULAR, location: 'Roma', tags: ['social', 'teaching', 'volunteering'] },
    { title: 'Club di Dibattito UniTo', description: 'Migliora le tue capacità argomentative e di public speaking. Partecipazione a tornei nazionali e internazionali.', type: OpportunityType.EXTRACURRICULAR, location: 'Torino', tags: ['debate', 'speaking', 'critical_thinking'], universityId: torino.id },
    // EVENTS
    { title: 'Career Day Polimi 2024', description: 'Incontra oltre 100 aziende in cerca di talenti. Porta il tuo CV, partecipa a workshop e colloqui sul posto.', type: OpportunityType.EVENT, location: 'Milano', tags: ['career', 'networking', 'recruitment'], universityId: polimi.id },
    { title: 'Startup Weekend Bologna', description: 'Un weekend per trasformare un\'idea in un progetto concreto. Team multidisciplinari, mentoring e pitch finale davanti a investitori.', type: OpportunityType.EVENT, location: 'Bologna', tags: ['startup', 'entrepreneurship', 'pitching'] },
    { title: 'Festival della Scienza', description: 'Il più grande evento di divulgazione scientifica in Italia. Workshop, laboratori e talk con ricercatori di fama mondiale.', type: OpportunityType.EVENT, location: 'Genova', tags: ['science', 'research', 'education'] },
    { title: 'Salone del Libro - Programma Giovani', description: 'Partecipa al programma speciale per studenti universitari al Salone del Libro di Torino. Incontri con autori e laboratori.', type: OpportunityType.EVENT, location: 'Torino', tags: ['culture', 'literature', 'events'] },
    // FELLOWSHIPS
    { title: 'Fondazione CRT - Fellowship Innovazione', description: 'Fellowship di 6 mesi per progetti di innovazione sociale. Borsa di studio, mentoring e accesso a un network di imprenditori sociali.', type: OpportunityType.FELLOWSHIP, location: 'Torino', isAbroad: false, tags: ['innovation', 'social', 'fellowship'], requiredEnglishLevel: EnglishLevel.B1_B2, minGpa: GpaRange.GPA_25_27 },
    { title: 'CERN Summer Student Programme', description: 'Trascorri l\'estate al CERN di Ginevra. Lavora con fisici e ingegneri di fama mondiale su esperimenti all\'avanguardia.', type: OpportunityType.FELLOWSHIP, company: 'CERN', location: 'Ginevra', isAbroad: true, tags: ['research', 'physics', 'international'], requiredEnglishLevel: EnglishLevel.C1, minGpa: GpaRange.GPA_28_30 },
    { title: 'EIT Digital Master School', description: 'Programma di doppia laurea con mobilità europea in innovazione e imprenditorialità digitale. Borsa di studio completa.', type: OpportunityType.FELLOWSHIP, location: 'Milano / Europa', isAbroad: true, tags: ['tech', 'entrepreneurship', 'international'], requiredEnglishLevel: EnglishLevel.C1, minGpa: GpaRange.GPA_25_27, universityId: polimi.id },
    { title: 'Google STEP Internship', description: 'Programma di stage per studenti del primo e secondo anno. Mentoring, progetti reali e immersione nella cultura Google.', type: OpportunityType.INTERNSHIP, company: 'Google', location: 'Milano', tags: ['tech', 'google', 'mentoring'], requiredEnglishLevel: EnglishLevel.C1, minGpa: GpaRange.GPA_25_27 },
    { title: 'Erasmus+ Traineeship', description: 'Programma di tirocinio all\'estero con borsa di studio UE. Destinazioni in tutta Europa, durata 2-12 mesi.', type: OpportunityType.STAGE, location: 'Europa', isAbroad: true, tags: ['international', 'erasmus', 'experience'], requiredEnglishLevel: EnglishLevel.B1_B2 },
    { title: 'Amazon Future Engineer', description: 'Programma di mentoring e stage per studenti STEM. Formazione in cloud computing, AI e software development.', type: OpportunityType.INTERNSHIP, company: 'Amazon', location: 'Milano', isRemote: true, tags: ['tech', 'cloud', 'ai'], requiredEnglishLevel: EnglishLevel.C1, minGpa: GpaRange.GPA_25_27 },
    { title: 'Stage in Sostenibilità Ambientale', description: 'Contribuisci ai progetti di sostenibilità e economia circolare di uno dei leader energetici italiani.', type: OpportunityType.STAGE, company: 'Eni', location: 'Milano', tags: ['sustainability', 'environment', 'energy'], requiredEnglishLevel: EnglishLevel.B1_B2, minGpa: GpaRange.GPA_21_24 },
    { title: 'UniCredit Graduate Program', description: 'Programma rotazionale di 18 mesi nelle diverse aree della banca. Formazione intensiva, mentoring e percorso di carriera accelerato.', type: OpportunityType.FELLOWSHIP, company: 'UniCredit', location: 'Milano', tags: ['finance', 'banking', 'graduate'], requiredEnglishLevel: EnglishLevel.C1, minGpa: GpaRange.GPA_28_30 },
    { title: 'Design Week Volunteer', description: 'Diventa volontario alla Milano Design Week. Accesso esclusivo agli eventi, networking con designer internazionali.', type: OpportunityType.EVENT, location: 'Milano', tags: ['design', 'events', 'networking'] },
    { title: 'Progetto AIESEC - Global Volunteer', description: 'Esperienza di volontariato internazionale di 6-8 settimane. Progetti in educazione, ambiente e sviluppo sostenibile in paesi emergenti.', type: OpportunityType.EXTRACURRICULAR, location: 'Internazionale', isAbroad: true, tags: ['volunteering', 'international', 'social'], requiredEnglishLevel: EnglishLevel.B1_B2 },
  ];

  const createdOpps = [];
  for (const opp of opportunities) {
    const deadline = new Date();
    deadline.setMonth(deadline.getMonth() + Math.floor(Math.random() * 6) + 1);
    createdOpps.push(await prisma.opportunity.create({
      data: { ...opp, deadline },
    }));
  }

  // ============ DEMO USERS ============
  const passwordHash = await bcrypt.hash('Password123', 10);

  const user1 = await prisma.user.create({
    data: {
      name: 'Marco Rossi',
      email: 'marco@example.com',
      passwordHash,
      emailVerified: true,
      universityId: polimi.id,
      courseOfStudy: 'Ingegneria Informatica',
      yearOfStudy: 3,
      gpa: GpaRange.GPA_28_30,
      englishLevel: EnglishLevel.C1,
      willingToRelocate: WillingnessToRelocate.YES,
      profileCompleted: true,
      bio: 'Appassionato di tech e startup. Sempre alla ricerca di nuove sfide.',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      name: 'Giulia Bianchi',
      email: 'giulia@example.com',
      passwordHash,
      emailVerified: true,
      universityId: bologna.id,
      courseOfStudy: 'Economia e Commercio',
      yearOfStudy: 2,
      gpa: GpaRange.GPA_25_27,
      englishLevel: EnglishLevel.B1_B2,
      willingToRelocate: WillingnessToRelocate.MAYBE,
      profileCompleted: true,
      bio: 'Economia e sostenibilità. Sogno di lavorare nell\'innovazione sociale.',
    },
  });

  const user3 = await prisma.user.create({
    data: {
      name: 'Luca Verdi',
      email: 'luca@example.com',
      passwordHash,
      emailVerified: true,
      universityId: sapienza.id,
      courseOfStudy: 'Ingegneria Aerospaziale',
      yearOfStudy: 4,
      gpa: GpaRange.GPA_28_30,
      englishLevel: EnglishLevel.C2_PLUS,
      willingToRelocate: WillingnessToRelocate.YES,
      profileCompleted: true,
      bio: 'Futuro ingegnere aerospaziale. Appassionato di fisica e spazio.',
    },
  });

  const user4 = await prisma.user.create({
    data: {
      name: 'Sara Ferrari',
      email: 'sara@example.com',
      passwordHash,
      emailVerified: true,
      universityId: firenze.id,
      courseOfStudy: 'Architettura',
      yearOfStudy: 3,
      gpa: GpaRange.GPA_25_27,
      englishLevel: EnglishLevel.B1_B2,
      willingToRelocate: WillingnessToRelocate.NO,
      profileCompleted: true,
      bio: 'Design e architettura sostenibile. Amo creare spazi che raccontano storie.',
    },
  });

  const user5 = await prisma.user.create({
    data: {
      name: 'Alessandro Conti',
      email: 'alessandro@example.com',
      passwordHash,
      emailVerified: true,
      universityId: caFoscari.id,
      courseOfStudy: 'Economia e Management',
      yearOfStudy: 1,
      gpa: GpaRange.GPA_21_24,
      englishLevel: EnglishLevel.A2,
      willingToRelocate: WillingnessToRelocate.MAYBE,
      profileCompleted: true,
      bio: 'Matricola con grandi sogni imprenditoriali.',
    },
  });

  // ============ USER PROFILES ============
  await Promise.all([
    prisma.userProfile.create({
      data: {
        userId: user1.id,
        primaryInterest: 'tech',
        naturalActivity: 'analizzare_dati',
        freeTimeActivity: 'progetto_personale',
        problemSolvingStyle: 'analitico',
        riskTolerance: 'alto',
        careerVision: 'imprenditore',
        professionalGoal: 'crescita',
        passions: ['informatica', 'imprenditoria'],
        clusterTag: 'Analista',
        completedAt: new Date(),
      },
    }),
    prisma.userProfile.create({
      data: {
        userId: user2.id,
        primaryInterest: 'business',
        naturalActivity: 'organizzare_team',
        freeTimeActivity: 'socializzare',
        problemSolvingStyle: 'collaborativo',
        riskTolerance: 'medio',
        careerVision: 'sociale',
        professionalGoal: 'impatto',
        passions: ['imprenditoria', 'lettura', 'viaggi'],
        clusterTag: 'Leader',
        completedAt: new Date(),
      },
    }),
    prisma.userProfile.create({
      data: {
        userId: user3.id,
        primaryInterest: 'tech',
        naturalActivity: 'risolvere_problemi',
        freeTimeActivity: 'leggere_imparare',
        problemSolvingStyle: 'analitico',
        riskTolerance: 'medio',
        careerVision: 'leader',
        professionalGoal: 'crescita',
        passions: ['informatica', 'lettura', 'sport'],
        clusterTag: 'Analista',
        completedAt: new Date(),
      },
    }),
    prisma.userProfile.create({
      data: {
        userId: user4.id,
        primaryInterest: 'creative',
        naturalActivity: 'creare_contenuti',
        freeTimeActivity: 'creare',
        problemSolvingStyle: 'creativo',
        riskTolerance: 'medio',
        careerVision: 'creativo',
        professionalGoal: 'liberta',
        passions: ['creativo', 'musica', 'viaggi'],
        clusterTag: 'Creativo',
        completedAt: new Date(),
      },
    }),
    prisma.userProfile.create({
      data: {
        userId: user5.id,
        primaryInterest: 'business',
        naturalActivity: 'organizzare_team',
        freeTimeActivity: 'socializzare',
        problemSolvingStyle: 'intuitivo',
        riskTolerance: 'alto',
        careerVision: 'imprenditore',
        professionalGoal: 'liberta',
        passions: ['imprenditoria', 'sport'],
        clusterTag: 'Imprenditore',
        completedAt: new Date(),
      },
    }),
  ]);

  // ============ FRIEND CONNECTIONS ============
  // All 10 pairs among 5 users, all ACCEPTED
  await Promise.all([
    prisma.friendRequest.create({ data: { fromUserId: user1.id, toUserId: user2.id, status: 'ACCEPTED' } }),
    prisma.friendRequest.create({ data: { fromUserId: user1.id, toUserId: user3.id, status: 'ACCEPTED' } }),
    prisma.friendRequest.create({ data: { fromUserId: user1.id, toUserId: user4.id, status: 'ACCEPTED' } }),
    prisma.friendRequest.create({ data: { fromUserId: user1.id, toUserId: user5.id, status: 'ACCEPTED' } }),
    prisma.friendRequest.create({ data: { fromUserId: user2.id, toUserId: user3.id, status: 'ACCEPTED' } }),
    prisma.friendRequest.create({ data: { fromUserId: user2.id, toUserId: user4.id, status: 'ACCEPTED' } }),
    prisma.friendRequest.create({ data: { fromUserId: user2.id, toUserId: user5.id, status: 'ACCEPTED' } }),
    prisma.friendRequest.create({ data: { fromUserId: user3.id, toUserId: user4.id, status: 'ACCEPTED' } }),
    prisma.friendRequest.create({ data: { fromUserId: user3.id, toUserId: user5.id, status: 'ACCEPTED' } }),
    prisma.friendRequest.create({ data: { fromUserId: user4.id, toUserId: user5.id, status: 'ACCEPTED' } }),
  ]);

  // ============ SAMPLE MESSAGES ============
  await prisma.pathMatesMessage.createMany({
    data: [
      { senderId: user1.id, receiverId: user2.id, content: 'Ciao Giulia! Hai visto lo stage alla Ferrari?' },
      { senderId: user2.id, receiverId: user1.id, content: 'Sì! Incredibile, ma serve una media alta 😅' },
      { senderId: user1.id, receiverId: user2.id, content: 'Proviamoci comunque, il peggio che può succedere è un no!' },
      { senderId: user1.id, receiverId: user3.id, content: 'Luca, ti iscrivi anche tu all\'hackathon IoT?' },
      { senderId: user3.id, receiverId: user1.id, content: 'Assolutamente! Formiamo un team?' },
    ],
  });

  // ============ SAMPLE POSTS ============
  const post1 = await prisma.post.create({
    data: {
      authorId: user1.id,
      content: 'Appena completato il mio primo progetto open source! Chi vuole contribuire? 💻 #OpenSource #Tech',
    },
  });

  const post2 = await prisma.post.create({
    data: {
      authorId: user2.id,
      content: 'Qualcuno ha esperienza con le Junior Enterprise? Sto valutando di entrare in JEBologna 🚀',
    },
  });

  const post3 = await prisma.post.create({
    data: {
      authorId: user4.id,
      content: 'La Design Week di Milano è stata incredibile! Quante ispirazioni per il mio progetto di tesi 🎨✨',
    },
  });

  await Promise.all([
    prisma.postLike.create({ data: { postId: post1.id, userId: user2.id } }),
    prisma.postLike.create({ data: { postId: post1.id, userId: user3.id } }),
    prisma.postLike.create({ data: { postId: post2.id, userId: user1.id } }),
    prisma.postLike.create({ data: { postId: post3.id, userId: user1.id } }),
    prisma.postLike.create({ data: { postId: post3.id, userId: user2.id } }),
  ]);

  await Promise.all([
    prisma.postComment.create({ data: { postId: post1.id, authorId: user3.id, content: 'Grandissimo! Manda il link del repo!' } }),
    prisma.postComment.create({ data: { postId: post2.id, authorId: user1.id, content: 'JE è un\'esperienza fantastica, ti la consiglio!' } }),
    prisma.postComment.create({ data: { postId: post3.id, authorId: user2.id, content: 'Bellissimo! Condividi qualche foto!' } }),
  ]);

  console.log('Seed completed successfully!');
  console.log(`- ${universities.length} universities`);
  console.log(`- ${coursesData.length} courses`);
  console.log(`- ${createdOpps.length} opportunities`);
  console.log(`- 5 demo users (password: Password123)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
