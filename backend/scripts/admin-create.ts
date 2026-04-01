/**
 * CLI script to promote an existing user to ADMIN role.
 * Usage: npx ts-node scripts/admin-create.ts --email user@example.com
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emailIndex = process.argv.indexOf('--email');
  if (emailIndex === -1 || !process.argv[emailIndex + 1]) {
    console.error('Usage: npx ts-node scripts/admin-create.ts --email <email>');
    process.exit(1);
  }

  const email = process.argv[emailIndex + 1];

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Error: No user found with email "${email}"`);
    process.exit(1);
  }

  if (!user.emailVerified) {
    console.error(`Error: User "${email}" has not verified their email. Cannot promote to ADMIN.`);
    process.exit(1);
  }

  if (user.role === 'ADMIN') {
    console.log(`User "${email}" is already an ADMIN.`);
    process.exit(0);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'ADMIN' },
  });

  console.log(`Successfully promoted "${email}" (${user.name}) to ADMIN role.`);
}

main()
  .catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
