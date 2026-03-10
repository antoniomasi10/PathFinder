import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, JwtPayload } from '../utils/jwt';
import { sendPasswordResetEmail } from './email.service';

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
      universityId: input.universityId || null,
      courseOfStudy: input.courseOfStudy || null,
    },
    include: { university: true },
  });

  const payload: JwtPayload = { userId: user.id, email: user.email };
  return {
    user: { id: user.id, name: user.name, email: user.email, profileCompleted: user.profileCompleted, university: user.university },
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Utente non trovato');

  const valid = await comparePassword(oldPassword, user.passwordHash);
  if (!valid) throw new Error('Password attuale non corretta');

  if (newPassword.length < 6) throw new Error('La nuova password deve avere almeno 6 caratteri');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Nessun account trovato con questa email');

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await prisma.user.update({
    where: { email },
    data: {
      passwordResetToken: code,
      passwordResetExpiry: expiry,
    },
  });

  await sendPasswordResetEmail(email, code);
}

export async function resetPassword(email: string, code: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
    throw new Error('Codice non valido o scaduto');
  }

  if (user.passwordResetToken !== code) {
    throw new Error('Codice non valido');
  }

  if (new Date() > user.passwordResetExpiry) {
    throw new Error('Il codice è scaduto. Richiedine uno nuovo.');
  }

  if (newPassword.length < 6) throw new Error('La password deve avere almeno 6 caratteri');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { email },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  });
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { university: true },
  });
  if (!user) {
    throw new Error('Credenziali non valide');
  }

  const valid = await comparePassword(input.password, user.passwordHash);
  if (!valid) {
    throw new Error('Credenziali non valide');
  }

  const payload: JwtPayload = { userId: user.id, email: user.email };
  return {
    user: { id: user.id, name: user.name, email: user.email, profileCompleted: user.profileCompleted, university: user.university },
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
