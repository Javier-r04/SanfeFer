import { execSync } from 'node:child_process';

// Aplica las migraciones a la base de pruebas antes de correr la suite.
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? 'postgresql://sanfefer:sanfefer@localhost:5432/sanfefer_test';
  execSync('npx prisma migrate deploy', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
