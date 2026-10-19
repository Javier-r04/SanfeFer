import type { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const SESSION_COOKIE = 'sanfefer_session';

interface SessionPayload {
  sub: string;
  /** tokenVersion del usuario al emitir el token; si cambia, la sesión deja de valer. */
  tv: number;
}

const cookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
  path: '/',
});

export function setSessionCookie(res: Response, user: { id: number; tokenVersion: number }) {
  const payload: SessionPayload = { sub: String(user.id), tv: user.tokenVersion };
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: `${env.SESSION_HOURS}h` });
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions(),
    maxAge: env.SESSION_HOURS * 3600 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export function readSessionToken(token: string): { userId: number; tokenVersion: number } | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as SessionPayload;
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || typeof payload.tv !== 'number') return null;
    return { userId, tokenVersion: payload.tv };
  } catch {
    return null;
  }
}
