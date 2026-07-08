import { describe, it, expect, afterAll } from 'vitest';
import prisma from '../lib/prisma';
import { expireByDate } from '../services/import/cleanup.service';

const SOURCE = '__test_expiry__';

async function cleanupTestRows() {
  await prisma.opportunity.deleteMany({ where: { source: SOURCE } });
}

afterAll(async () => {
  await cleanupTestRows();
  await prisma.$disconnect();
});

describe('expireByDate', () => {
  it('sets expiresAt on rows with a past endDate or deadline, leaves future ones intact', async () => {
    await cleanupTestRows();
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const finishedEvent = await prisma.opportunity.create({
      data: {
        title: 'Finished Hackathon', description: 'desc', type: 'HACKATHON',
        source: SOURCE, sourceId: `${SOURCE}-1`, endDate: past, expiresAt: null,
      },
    });
    const closedDeadline = await prisma.opportunity.create({
      data: {
        title: 'Closed Fellowship', description: 'desc', type: 'FELLOWSHIP',
        source: SOURCE, sourceId: `${SOURCE}-2`, deadline: past, expiresAt: null,
      },
    });
    const upcomingEvent = await prisma.opportunity.create({
      data: {
        title: 'Upcoming Hackathon', description: 'desc', type: 'HACKATHON',
        source: SOURCE, sourceId: `${SOURCE}-3`, endDate: future, expiresAt: null,
      },
    });
    const manualRecord = await prisma.opportunity.create({
      data: {
        title: 'Manual curated (no sourceId)', description: 'desc', type: 'EVENT',
        source: SOURCE, sourceId: null, endDate: past, expiresAt: null,
      },
    });

    await expireByDate(now);

    const [finished, closed, upcoming, manual] = await Promise.all([
      prisma.opportunity.findUnique({ where: { id: finishedEvent.id } }),
      prisma.opportunity.findUnique({ where: { id: closedDeadline.id } }),
      prisma.opportunity.findUnique({ where: { id: upcomingEvent.id } }),
      prisma.opportunity.findUnique({ where: { id: manualRecord.id } }),
    ]);

    expect(finished!.expiresAt).not.toBeNull();
    expect(closed!.expiresAt).not.toBeNull();
    expect(upcoming!.expiresAt).toBeNull();
    // sourceId=null (manual/seed) is never auto-expired
    expect(manual!.expiresAt).toBeNull();

    await cleanupTestRows();
  });
});
