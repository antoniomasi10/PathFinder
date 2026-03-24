import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, JwtPayload } from '../utils/jwt';
import { sendVerificationEmail, sendPasswordResetEmail, generateOTP } from './email.service';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../utils/logger';

const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  universityId?: string;
  courseOfStudy?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

function userResponse(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profileCompleted: user.profileCompleted,
    emailVerified: user.emailVerified,
    provider: user.provider,
    university: user.university,
  };
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error('Email già registrata');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      provider: 'LOCAL',
      emailVerified: false,
      universityId: input.universityId || null,
      courseOfStudy: input.courseOfStudy || null,
    },
    include: { university: true },
  });

  // Generate and send OTP
  const otp = generateOTP();
  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      code: otp,
      type: 'EMAIL_VERIFICATION',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  await sendVerificationEmail(user.email, user.name, otp);

  const payload: JwtPayload = { userId: user.id, email: user.email };
  return {
    user: userResponse(user),
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { university: true },
  });
  if (!user || !user.passwordHash) {
    throw new Error('Credenziali non valide');
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new Error('Credenziali non valide');
  }

  const payload: JwtPayload = { userId: user.id, email: user.email };
  return {
    user: userResponse(user),
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

export async function verifyEmail(userId: string, code: string) {
  const record = await prisma.verificationCode.findFirst({
    where: {
      userId,
      code,
      type: 'EMAIL_VERIFICATION',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    throw new Error('Codice non valido o scaduto');
  }

  await prisma.$transaction([
    prisma.verificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    }),
  ]);

  return { message: 'Email verificata con successo' };
}

export async function resendVerificationCode(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Utente non trovato');
  if (user.emailVerified) throw new Error('Email già verificata');

  // Rate limit: check if a code was sent in the last 60 seconds
  const recentCode = await prisma.verificationCode.findFirst({
    where: {
      userId,
      type: 'EMAIL_VERIFICATION',
      createdAt: { gt: new Date(Date.now() - 60 * 1000) },
    },
  });
  if (recentCode) {
    throw new Error('Attendi almeno 60 secondi prima di richiedere un nuovo codice');
  }

  // Invalidate old codes
  await prisma.verificationCode.updateMany({
    where: { userId, type: 'EMAIL_VERIFICATION', usedAt: null },
    data: { usedAt: new Date() },
  });

  const otp = generateOTP();
  await prisma.verificationCode.create({
    data: {
      userId,
      code: otp,
      type: 'EMAIL_VERIFICATION',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await sendVerificationEmail(user.email, user.name, otp);
  return { message: 'Codice di verifica inviato' };
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user || user.provider !== 'LOCAL') {
    return { message: 'Se l\'email è registrata, riceverai un codice di reset' };
  }

  // Rate limit: check if a code was sent in the last 60 seconds
  const recentCode = await prisma.verificationCode.findFirst({
    where: {
      userId: user.id,
      type: 'PASSWORD_RESET',
      createdAt: { gt: new Date(Date.now() - 60 * 1000) },
    },
  });
  if (recentCode) {
    return { message: 'Se l\'email è registrata, riceverai un codice di reset' };
  }

  // Invalidate old codes
  await prisma.verificationCode.updateMany({
    where: { userId: user.id, type: 'PASSWORD_RESET', usedAt: null },
    data: { usedAt: new Date() },
  });

  const otp = generateOTP();
  await prisma.verificationCode.create({
    data: {
      userId: user.id,
      code: otp,
      type: 'PASSWORD_RESET',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await sendPasswordResetEmail(user.email, user.name, otp);
  return { message: 'Se l\'email è registrata, riceverai un codice di reset' };
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Codice non valido o scaduto');

  const record = await prisma.verificationCode.findFirst({
    where: {
      userId: user.id,
      code,
      type: 'PASSWORD_RESET',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!record) {
    throw new Error('Codice non valido o scaduto');
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.verificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
  ]);

  return { message: 'Password reimpostata con successo' };
}

export async function googleAuth(idToken: string) {
  if (!googleClient) {
    throw new Error('Google OAuth non configurato');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const googlePayload = ticket.getPayload();
  if (!googlePayload || !googlePayload.email) {
    throw new Error('Token Google non valido');
  }

  const { email, name, sub: googleId, picture } = googlePayload;

  // Check if user exists by googleId or email
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email }] },
    include: { university: true },
  });

  if (user) {
    // Link Google account if user registered with email
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          emailVerified: true,
          avatar: user.avatar || picture || null,
        },
        include: { university: true },
      });
      logger.info('Google account linked to existing user', { userId: user.id });
    }
  } else {
    // Create new user
    user = await prisma.user.create({
      data: {
        email: email!,
        name: name || email!.split('@')[0],
        googleId,
        provider: 'GOOGLE',
        emailVerified: true,
        avatar: picture || null,
      },
      include: { university: true },
    });
    logger.info('New user created via Google OAuth', { userId: user.id });
  }

  const payload: JwtPayload = { userId: user.id, email: user.email };
  return {
    user: userResponse(user),
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
