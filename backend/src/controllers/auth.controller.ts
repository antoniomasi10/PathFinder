import { Request, Response } from 'express';
import { registerUser, loginUser } from '../services/auth.service';
import { verifyRefreshToken, generateAccessToken } from '../utils/jwt';

export async function register(req: Request, res: Response) {
  try {
    const { name, email, password, universityId, courseOfStudy } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nome, email e password sono obbligatori' });
      return;
    }
    const result = await registerUser({ name, email, password, universityId, courseOfStudy });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email e password sono obbligatori' });
      return;
    }
    const result = await loginUser({ email, password });

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user: result.user, accessToken: result.accessToken });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      res.status(401).json({ error: 'Refresh token mancante' });
      return;
    }
    const payload = verifyRefreshToken(token);
    const accessToken = generateAccessToken({ userId: payload.userId, email: payload.email });
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Refresh token non valido' });
  }
}
