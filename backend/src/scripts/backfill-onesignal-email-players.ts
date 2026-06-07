// Usage: npx ts-node backend/scripts/backfill-onesignal-email-players.ts

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APP_ID = process.env.ONESIGNAL_APP_ID || '';
const REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY || '';
const BASE_URL = 'https://onesignal.com/api/v1';

async function registerEmailPlayer(userId: string, email: string): Promise<string | null> {
  const response = await fetch(`${BASE_URL}/players`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: APP_ID,
      device_type: 11,
      identifier: email,
      external_user_id: userId,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OneSignal ${response.status}: ${text}`);
  }
  const data = await response.json() as Record<string, any>;
  return data?.id ? String(data.id) : null;
}

async function main() {
  if (!APP_ID || !REST_API_KEY) {
    console.error('Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY');
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    where: { oneSignalEmailPlayerId: null, emailVerified: true },
    select: { id: true, email: true, name: true },
  });

  console.log(`Found ${users.length} users without OneSignal email player ID\n`);

  let success = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const playerId = await registerEmailPlayer(user.id, user.email);
      if (playerId) {
        await prisma.user.update({ where: { id: user.id }, data: { oneSignalEmailPlayerId: playerId } });
        console.log(`OK ${user.name} (${user.email}) -> ${playerId}`);
        success++;
      } else {
        console.log(`NO_ID ${user.name} (${user.email})`);
        failed++;
      }
    } catch (err) {
      console.log(`ERR ${user.name} (${user.email}) -> ${String(err)}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
}

main().then(() => prisma.$disconnect()).catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
