import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string()
    .min(8, 'La password deve avere almeno 8 caratteri')
    .max(64, 'La password non può superare 64 caratteri')
    .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
    .regex(/[a-z]/, 'La password deve contenere almeno una lettera minuscola')
    .regex(/[0-9]/, 'La password deve contenere almeno un numero')
    .regex(/[^A-Za-z0-9]/, 'La password deve contenere almeno un carattere speciale (!@#$%...)'),
  name: z.string().min(1, 'Nome obbligatorio').max(50),
  surname: z.string().min(1, 'Cognome obbligatorio').max(50),
  phone: z.string().regex(/^\+?[0-9]{6,15}$/, 'Numero di telefono non valido').optional().or(z.literal('')),
});

export const loginSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(1, 'Password obbligatoria'),
});

export const verifyEmailSchema = z.object({
  code: z.string().length(6, 'Il codice deve essere di 6 cifre').regex(/^\d+$/, 'Il codice deve contenere solo numeri'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email non valida'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Email non valida'),
  code: z.string().length(6, 'Il codice deve essere di 6 cifre').regex(/^\d+$/, 'Il codice deve contenere solo numeri'),
  newPassword: z.string()
    .min(8, 'La password deve avere almeno 8 caratteri')
    .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
    .regex(/[0-9]/, 'La password deve contenere almeno un numero'),
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

const privacyOption = z.enum(['Tutti', 'Pathmates', 'Nessuno']);

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar: z.string().optional(),
  courseOfStudy: z.string().max(200).optional(),
  passions: z.array(z.string().max(50)).max(20).optional(),
  publicProfile: z.boolean().optional(),
  privacySkills: privacyOption.optional(),
  privacyUniversity: privacyOption.optional(),
  privacySavedOpps: privacyOption.optional(),
  privacyPathmates: privacyOption.optional(),
  messagePrivacy: privacyOption.optional(),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Password attuale obbligatoria'),
  newPassword: z.string()
    .min(8, 'La password deve avere almeno 8 caratteri')
    .max(64, 'La password non può superare 64 caratteri')
    .regex(/[A-Z]/, 'La password deve contenere almeno una lettera maiuscola')
    .regex(/[a-z]/, 'La password deve contenere almeno una lettera minuscola')
    .regex(/[0-9]/, 'La password deve contenere almeno un numero')
    .regex(/[^A-Za-z0-9]/, 'La password deve contenere almeno un carattere speciale (!@#$%...)'),
});
