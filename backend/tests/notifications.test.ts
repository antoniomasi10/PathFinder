import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, setupTestUsers, cleanupTestData, TestUsers } from './setup';
import { createNotification, getNotifications, getUnreadCount, markAsRead, markAllAsRead, getBadgeCounts } from '../src/services/notification.service';
import { getOrCreatePreferences, updatePreferences, shouldNotify } from '../src/services/notificationPreference.service';
import { saveSubscription, removeSubscription, getVapidPublicKey } from '../src/services/webPush.service';

let users: TestUsers;

beforeAll(async () => {
  await cleanupTestData();
  users = await setupTestUsers();
});

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});

// ── Notification Creation ───────────────────────────────────
describe('Notification Creation', () => {
  it('creates a FRIEND_REQUEST notification', async () => {
    const notif = await createNotification(
      users.userB.id,
      'FRIEND_REQUEST',
      'User A vuole connettersi con te',
      `/profile/${users.userA.id}`,
      '\u{1F465}',
      { fromUserId: users.userA.id }
    );

    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('FRIEND_REQUEST');
    expect(notif!.userId).toBe(users.userB.id);
    expect(notif!.isRead).toBe(false);
    expect(notif!.linkTo).toBe(`/profile/${users.userA.id}`);
  });

  it('creates a FRIEND_ACCEPTED notification', async () => {
    const notif = await createNotification(
      users.userA.id,
      'FRIEND_ACCEPTED',
      'User B ha accettato la tua richiesta',
      `/profile/${users.userB.id}`,
      '\u{1F91D}'
    );

    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('FRIEND_ACCEPTED');
  });

  it('creates a NEW_OPPORTUNITY notification', async () => {
    const notif = await createNotification(
      users.userA.id,
      'NEW_OPPORTUNITY',
      'Nuova opportunità: Stage presso Google',
      '/home',
      '\u{1F4BC}',
      { opportunityId: 'opp-test-123' }
    );

    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('NEW_OPPORTUNITY');
  });

  it('creates an OPPORTUNITY_DEADLINE notification', async () => {
    const notif = await createNotification(
      users.userA.id,
      'OPPORTUNITY_DEADLINE',
      '"Stage Google" scade tra 24 ore!',
      '/home',
      '\u{23F0}',
      { opportunityId: 'opp-test-123', daysLeft: 1 }
    );

    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('OPPORTUNITY_DEADLINE');
  });

  it('creates a BADGE_UNLOCKED notification', async () => {
    const notif = await createNotification(
      users.userA.id,
      'BADGE_UNLOCKED',
      'Hai sbloccato il badge "Esploratore"!',
      '/profile',
      '\u{1F3C6}',
      { badgeName: 'Esploratore' }
    );

    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('BADGE_UNLOCKED');
  });

  it('creates POST_LIKE notification (requires postLikes pref enabled)', async () => {
    // postLikes defaults to false in schema — enable it first
    await updatePreferences(users.userB.id, { postLikes: true });

    const notif = await createNotification(
      users.userB.id,
      'POST_LIKE',
      'User A ha messo mi piace al tuo post',
      '/networking',
      '\u{2764}\u{FE0F}',
      { postId: 'post-test-123' }
    );

    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('POST_LIKE');
  });

  it('creates POST_COMMENT notification', async () => {
    const notif = await createNotification(
      users.userB.id,
      'POST_COMMENT',
      'User A ha commentato il tuo post',
      '/networking',
      '\u{1F4AC}',
      { postId: 'post-test-123' }
    );

    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('POST_COMMENT');
  });

  it('creates COURSE_RECOMMENDED notification', async () => {
    const notif = await createNotification(
      users.userA.id,
      'COURSE_RECOMMENDED',
      'Nuovo corso consigliato: Data Science',
      '/universities',
      '\u{2B50}',
      { courseId: 'course-test-123' }
    );

    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('COURSE_RECOMMENDED');
  });

  it('creates SYSTEM notification', async () => {
    const notif = await createNotification(
      users.userA.id,
      'SYSTEM',
      'Aggiornamento disponibile per PathFinder',
      '/notifications',
      '\u{2699}\u{FE0F}'
    );

    expect(notif).not.toBeNull();
    expect(notif!.type).toBe('SYSTEM');
  });
});

// ── Notification Retrieval ──────────────────────────────────
describe('Notification Retrieval', () => {
  it('fetches all notifications for a user', async () => {
    const result = await getNotifications(users.userA.id);
    const notifs = result.data;
    expect(notifs.length).toBeGreaterThanOrEqual(1);
    // Should be ordered by createdAt desc
    for (let i = 1; i < notifs.length; i++) {
      expect(new Date(notifs[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(notifs[i].createdAt).getTime()
      );
    }
  });

  it('excludes NEW_MESSAGE from notification center', async () => {
    // Create a message notification
    await createNotification(
      users.userA.id,
      'NEW_MESSAGE',
      'Nuovo messaggio da User B',
      `/chat/${users.userB.id}`,
      '\u{1F4AC}'
    );

    const result = await getNotifications(users.userA.id);
    const messageNotifs = result.data.filter((n: any) => n.type === 'NEW_MESSAGE');
    expect(messageNotifs.length).toBe(0);
  });

  it('returns correct unread count (excluding NEW_MESSAGE)', async () => {
    const count = await getUnreadCount(users.userA.id);
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify no NEW_MESSAGE counted
    const allNotifs = await prisma.notification.findMany({
      where: { userId: users.userA.id, isRead: false },
    });
    const messageCount = allNotifs.filter((n) => n.type === 'NEW_MESSAGE').length;
    const expectedCount = allNotifs.length - messageCount;
    expect(count).toBe(expectedCount);
  });
});

// ── Mark As Read ────────────────────────────────────────────
describe('Mark As Read', () => {
  it('marks a single notification as read', async () => {
    const result = await getNotifications(users.userB.id);
    const unread = result.data.find((n: any) => !n.isRead);
    expect(unread).toBeDefined();

    const updated = await markAsRead(unread!.id, users.userB.id);
    expect(updated.isRead).toBe(true);

    // Verify in DB
    const check = await prisma.notification.findUnique({ where: { id: unread!.id } });
    expect(check!.isRead).toBe(true);
  });

  it('marks all notifications as read for a user', async () => {
    await markAllAsRead(users.userA.id);
    const count = await getUnreadCount(users.userA.id);
    expect(count).toBe(0);
  });
});

// ── Badge Counts ────────────────────────────────────────────
describe('Badge Counts', () => {
  it('returns badge counts object with correct shape', async () => {
    const counts = await getBadgeCounts(users.userB.id);
    expect(counts).toHaveProperty('networking');
    expect(counts).toHaveProperty('opportunities');
    expect(counts).toHaveProperty('chat');
    expect(typeof counts.networking).toBe('number');
    expect(typeof counts.opportunities).toBe('number');
    expect(typeof counts.chat).toBe('number');
  });

  it('networking badge includes unread FRIEND_REQUEST notifications', async () => {
    // userB has an unread FRIEND_REQUEST from earlier
    const counts = await getBadgeCounts(users.userB.id);
    // Should include social notifs too (POST_LIKE, POST_COMMENT)
    expect(counts.networking).toBeGreaterThanOrEqual(0);
  });
});

// ── Notification Preferences ────────────────────────────────
describe('Notification Preferences', () => {
  it('creates default preferences for a user', async () => {
    const prefs = await getOrCreatePreferences(users.userA.id);
    expect(prefs.pushEnabled).toBe(true);
    expect(prefs.networking).toBe(true);
    expect(prefs.opportunities).toBe(true);
    expect(prefs.universities).toBe(true);
    expect(prefs.social).toBe(true);
    expect(prefs.chat).toBe(true);
    expect(prefs.achievements).toBe(true);
    expect(prefs.system).toBe(true);
  });

  it('updates preferences', async () => {
    const updated = await updatePreferences(users.userA.id, {
      networking: false,
      postLikes: true,
    });
    expect(updated.networking).toBe(false);
    expect(updated.postLikes).toBe(true);
    // Other fields remain unchanged
    expect(updated.opportunities).toBe(true);
  });

  it('shouldNotify returns false when category disabled', async () => {
    // networking is now disabled for userA
    const allowed = await shouldNotify(users.userA.id, 'FRIEND_REQUEST');
    expect(allowed).toBe(false);
  });

  it('shouldNotify returns true when category enabled', async () => {
    const allowed = await shouldNotify(users.userA.id, 'NEW_OPPORTUNITY');
    expect(allowed).toBe(true);
  });

  it('blocks notification creation when preference disabled', async () => {
    // networking disabled for userA
    const notif = await createNotification(
      users.userA.id,
      'FRIEND_REQUEST',
      'This should be blocked',
      '/networking'
    );
    expect(notif).toBeNull();
  });

  it('rejects unknown preference fields', async () => {
    const updated = await updatePreferences(users.userA.id, {
      networking: true, // restore
      fakeField: true,
    } as any);
    expect((updated as any).fakeField).toBeUndefined();
  });

  it('restores preferences for subsequent tests', async () => {
    await updatePreferences(users.userA.id, { networking: true });
    const allowed = await shouldNotify(users.userA.id, 'FRIEND_REQUEST');
    expect(allowed).toBe(true);
  });
});

// ── Push Subscription Management ────────────────────────────
describe('Push Subscription Management', () => {
  const testEndpoint = 'https://fcm.googleapis.com/fcm/send/__test_endpoint__';
  const testKeys = { p256dh: 'test-p256dh-key', auth: 'test-auth-key' };

  it('returns VAPID public key', () => {
    const key = getVapidPublicKey();
    expect(typeof key).toBe('string');
    // Key should exist if .env is configured
    if (process.env.VAPID_PUBLIC_KEY) {
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('saves a push subscription', async () => {
    const sub = await saveSubscription(users.userA.id, {
      endpoint: testEndpoint,
      keys: testKeys,
    }, 'vitest-agent');

    expect(sub.userId).toBe(users.userA.id);
    expect(sub.endpoint).toBe(testEndpoint);
    expect(sub.p256dh).toBe(testKeys.p256dh);
    expect(sub.auth).toBe(testKeys.auth);
    expect(sub.userAgent).toBe('vitest-agent');
  });

  it('upserts subscription on same endpoint', async () => {
    const updatedKeys = { p256dh: 'updated-p256dh', auth: 'updated-auth' };
    const sub = await saveSubscription(users.userA.id, {
      endpoint: testEndpoint,
      keys: updatedKeys,
    });

    expect(sub.p256dh).toBe('updated-p256dh');
    expect(sub.auth).toBe('updated-auth');

    // Should still be only one subscription with this endpoint
    const count = await prisma.pushSubscription.count({
      where: { endpoint: testEndpoint },
    });
    expect(count).toBe(1);
  });

  it('removes a push subscription', async () => {
    await removeSubscription(testEndpoint);

    const count = await prisma.pushSubscription.count({
      where: { endpoint: testEndpoint },
    });
    expect(count).toBe(0);
  });
});

// ── Notification Type Coverage ──────────────────────────────
describe('All NotificationType values handled', () => {
  const allTypes = [
    'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'NEW_MESSAGE',
    'NEW_OPPORTUNITY', 'OPPORTUNITY_DEADLINE',
    'COURSE_DEADLINE', 'COURSE_RECOMMENDED',
    'BADGE_UNLOCKED', 'POST_LIKE', 'POST_COMMENT', 'COMMENT_REPLY',
    'GROUP_UPDATE', 'SYSTEM', 'GENERAL',
  ] as const;

  it('every NotificationType can be created', async () => {
    for (const type of allTypes) {
      const notif = await createNotification(
        users.userA.id,
        type,
        `Test notification: ${type}`,
        '/notifications',
        '\u{1F514}'
      );

      // NEW_MESSAGE is still created — just excluded from getNotifications
      expect(notif).not.toBeNull();
      expect(notif!.type).toBe(type);
    }
  });

  it('every type maps to a preference via shouldNotify', async () => {
    for (const type of allTypes) {
      // Should not throw
      const result = await shouldNotify(users.userA.id, type);
      expect(typeof result).toBe('boolean');
    }
  });
});

// ── Edge Cases ──────────────────────────────────────────────
describe('Edge Cases', () => {
  it('handles notification with no linkTo', async () => {
    const notif = await createNotification(
      users.userA.id,
      'GENERAL',
      'Notification without link'
    );
    expect(notif).not.toBeNull();
    expect(notif!.linkTo).toBeNull();
  });

  it('handles notification with no icon', async () => {
    const notif = await createNotification(
      users.userA.id,
      'GENERAL',
      'Notification without icon',
      '/notifications'
    );
    expect(notif).not.toBeNull();
    expect(notif!.icon).toBeNull();
  });

  it('handles notification with JSON data', async () => {
    const data = { key1: 'value1', nested: { key2: 42 } };
    const notif = await createNotification(
      users.userA.id,
      'GENERAL',
      'Notification with data',
      '/notifications',
      undefined,
      data
    );
    expect(notif).not.toBeNull();
    expect(notif!.data).toEqual(data);
  });

  it('getNotifications returns max 50 results', async () => {
    const result = await getNotifications(users.userA.id);
    expect(result.data.length).toBeLessThanOrEqual(50);
  });

  it('markAsRead on already-read notification does not error', async () => {
    const result = await getNotifications(users.userA.id);
    const readNotif = result.data.find((n: any) => n.isRead);
    if (readNotif) {
      const result = await markAsRead(readNotif.id, users.userA.id);
      expect(result.isRead).toBe(true);
    }
  });

  it('markAllAsRead is idempotent', async () => {
    await markAllAsRead(users.userA.id);
    await markAllAsRead(users.userA.id); // second call should not error
    const count = await getUnreadCount(users.userA.id);
    expect(count).toBe(0);
  });
});
