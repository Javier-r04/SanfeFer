import type { User } from '@prisma/client';
import type { AuthUser, UserDto } from '@sanfefer/shared';

export const toAuthUser = (u: Pick<User, 'id' | 'name' | 'username' | 'role'>): AuthUser => ({
  id: u.id,
  name: u.name,
  username: u.username,
  role: u.role,
});

export const toUserDto = (u: User): UserDto => ({
  ...toAuthUser(u),
  active: u.active,
  hasPin: u.pinHash !== null,
  hasPassword: u.passwordHash !== null,
  lockedUntil: u.lockedUntil && u.lockedUntil > new Date() ? u.lockedUntil.toISOString() : null,
  createdAt: u.createdAt.toISOString(),
  updatedAt: u.updatedAt.toISOString(),
});

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0]![0], words[1]![0]] : [words[0]?.[0], words[0]?.[1]];
  return letters.filter(Boolean).join('').toUpperCase();
}
