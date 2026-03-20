import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string()
    .min(8, 'La password deve avere almeno 8 caratteri')
    .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
    .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
  name: z.string().min(1, 'Nome obbligatorio').max(100),
});

export const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria'),
});

export const sendMessageSchema = z.object({
  receiverId: z.string().uuid('ID destinatario non valido'),
  content: z.string().min(1, 'Il messaggio non può essere vuoto').max(5000),
  images: z.array(z.string()).max(5).optional(),
});

export const createPostSchema = z.object({
  content: z.string().min(1, 'Il contenuto non può essere vuoto').max(10000),
  images: z.array(z.string()).max(5).optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Il commento non può essere vuoto').max(2000),
});

export const friendRequestSchema = z.object({
  toUserId: z.string().uuid('ID utente non valido'),
});

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Nome gruppo obbligatorio').max(100),
  memberIds: z.array(z.string().uuid()).min(2, 'Un gruppo deve avere almeno 3 membri (incluso te)'),
  description: z.string().max(500).optional(),
  image: z.string().optional(),
});

export const batchStatusSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().optional(),
  courseOfStudy: z.string().max(200).optional(),
  passions: z.array(z.string().max(50)).max(20).optional(),
});
