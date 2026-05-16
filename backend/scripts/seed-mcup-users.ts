import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password123', 10);

  // Grab first available university
  const university = await prisma.university.findFirst();
  if (!university) {
    console.error('No university found — run db:seed first');
    process.exit(1);
  }

  const users = [
    { name: 'Chiara',   surname: 'MCup', email: 'chiara.mcup@example.com',   courseOfStudy: 'Economia e Commercio',    yearOfStudy: 2 },
    { name: 'Lorenzo',  surname: 'MCup', email: 'lorenzo.mcup@example.com',  courseOfStudy: 'Ingegneria Informatica',  yearOfStudy: 3 },
    { name: 'Beatrice', surname: 'MCup', email: 'beatrice.mcup@example.com', courseOfStudy: 'Giurisprudenza',          yearOfStudy: 1 },
    { name: 'Filippo',  surname: 'MCup', email: 'filippo.mcup@example.com',  courseOfStudy: 'Medicina e Chirurgia',   yearOfStudy: 4 },
    { name: 'Elisa',    surname: 'MCup', email: 'elisa.mcup@example.com',    courseOfStudy: 'Design della Moda',      yearOfStudy: 2 },
    { name: 'Nicola',   surname: 'MCup', email: 'nicola.mcup@example.com',   courseOfStudy: 'Scienze Politiche',      yearOfStudy: 3 },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`Already exists: ${u.email}`);
      continue;
    }
    await prisma.user.create({
      data: {
        email: u.email,
        passwordHash,
        name: u.name,
        surname: u.surname,
        courseOfStudy: u.courseOfStudy,
        yearOfStudy: u.yearOfStudy,
        universityId: university.id,
        profileCompleted: true,
        emailVerified: true,
      },
    });
    console.log(`Created: ${u.name} ${u.surname} (${u.email})`);
  }

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
