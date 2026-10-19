import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export const hashSecret = (plain: string) => bcrypt.hash(plain, ROUNDS);
export const verifySecret = (plain: string, hash: string) => bcrypt.compare(plain, hash);
