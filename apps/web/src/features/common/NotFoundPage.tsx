import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="font-display text-6xl font-extrabold text-primary">404</p>
        <h1 className="text-xl font-extrabold">Esta página no existe</h1>
        <Link to="/" className="font-bold text-primary-ink underline underline-offset-4">
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
