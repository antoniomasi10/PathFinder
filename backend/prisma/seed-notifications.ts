import { PrismaClient, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const marco = await prisma.user.findUnique({ where: { email: 'marco@example.com' } });
  if (!marco) {
    console.error('Utente marco@example.com non trovato. Esegui prima npm run db:seed.');
    process.exit(1);
  }

  await prisma.notification.deleteMany({ where: { userId: marco.id } });

  const now = new Date();
  const yesterday = new Date(now.getTime() - 86400000);
  const twoDaysAgo = new Date(now.getTime() - 86400000 * 2);
  const fourDaysAgo = new Date(now.getTime() - 86400000 * 4);

  const h = (hours: number) => new Date(now.getTime() - hours * 3600000);

  await prisma.notification.createMany({
    data: [
      // — OGGI (unread) —
      {
        userId: marco.id,
        type: NotificationType.NEW_OPPORTUNITY,
        content: 'Nuova opportunità!\nGoogle ha pubblicato un nuovo stage in Product Design. Candidati entro il 30 giugno.',
        isRead: false,
        createdAt: h(0.5),
      },
      {
        userId: marco.id,
        type: NotificationType.POST_COMMENT,
        content: 'Messaggio da Giulia\nCiao! Hai visto gli appunti di Metodologia? Non riesco a trovarli…',
        isRead: false,
        createdAt: h(1.5),
        linkTo: '/networking',
      },
      {
        userId: marco.id,
        type: NotificationType.FRIEND_REQUEST,
        content: 'Richiesta di amicizia\nLuca Bianchi vuole connettersi con te.',
        isRead: false,
        createdAt: h(3),
        linkTo: '/profile',
      },
      // — IERI (read) —
      {
        userId: marco.id,
        type: NotificationType.GENERAL,
        content: 'Evento Apple Developer\nLe iscrizioni per l\'accademia sono aperte. Scopri i requisiti per partecipare.',
        isRead: true,
        createdAt: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 14, 20),
      },
      {
        userId: marco.id,
        type: NotificationType.OPPORTUNITY_DEADLINE,
        content: 'Scadenza vicina\nRicorda di consegnare il progetto di Interaction Design entro domani alle 23:59.',
        isRead: true,
        createdAt: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 9, 5),
      },
      // — PRIMA —
      {
        userId: marco.id,
        type: NotificationType.BADGE_UNLOCKED,
        content: 'Badge sbloccato!\nHai ottenuto il badge "Explorer" per aver esplorato 10 opportunità.',
        isRead: true,
        createdAt: twoDaysAgo,
      },
      {
        userId: marco.id,
        type: NotificationType.FRIEND_ACCEPTED,
        content: 'Sara Conti ha accettato la tua richiesta di amicizia.',
        isRead: true,
        createdAt: twoDaysAgo,
      },
      {
        userId: marco.id,
        type: NotificationType.POST_LIKE,
        content: 'A Giulia è piaciuto il tuo post sul tirocinio in Germania.',
        isRead: true,
        createdAt: fourDaysAgo,
        linkTo: '/networking',
      },
      {
        userId: marco.id,
        type: NotificationType.COURSE_RECOMMENDED,
        content: 'Corso consigliato\n"UX Design Fundamentals" è stato aggiunto al tuo piano di studi.',
        isRead: true,
        createdAt: fourDaysAgo,
      },
    ],
  });

  console.log(`✓ Inserite 9 notifiche per ${marco.email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
