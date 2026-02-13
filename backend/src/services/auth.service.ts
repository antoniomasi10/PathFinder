import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, JwtPayload } from '../utils/jwt';

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
