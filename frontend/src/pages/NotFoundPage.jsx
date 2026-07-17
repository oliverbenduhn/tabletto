import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-blue-500">Fehler 404</p>
      <h1 className="text-3xl font-bold text-gray-900">Diese Seite wurde nicht gefunden.</h1>
      <p className="text-gray-600">Der Link ist möglicherweise veraltet oder unvollständig.</p>
      <Link to="/dashboard" className="inline-flex min-h-11 items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
        Zum Dashboard
      </Link>
    </main>
  );
}

export default NotFoundPage;
