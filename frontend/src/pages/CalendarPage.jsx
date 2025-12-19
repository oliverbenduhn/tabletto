import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Layout/Header';
import CalendarMonth from '../components/Calendar/CalendarMonth';
import api from '../services/api';

function CalendarPage() {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  const fetchMedications = async () => {
    setLoading(true);
    setError('');
    try {
      const { medications } = await api.getMedications();
      setMedications(medications);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedications();
  }, []);

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const monthName = currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-transparent">
      <Header />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <section className="rounded-3xl border border-blue-100 bg-white/80 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-blue-400">Kalenderansicht</p>
              <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">
                Medikamenten-Verfügbarkeit
              </h1>
              <p className="text-sm text-gray-600">
                Übersicht, wann deine Medikamente voraussichtlich ausgehen
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleToday}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm hover:border-blue-200 hover:text-blue-600"
              >
                Heute
              </button>
              <button
                onClick={fetchMedications}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm hover:border-blue-200 hover:text-blue-600"
              >
                Aktualisieren
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white/90 p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={handlePreviousMonth}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
              aria-label="Vorheriger Monat"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h2 className="text-xl font-semibold capitalize text-gray-900">{monthName}</h2>
            <button
              onClick={handleNextMonth}
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
              aria-label="Nächster Monat"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-500">Lade Kalender...</div>
          ) : error ? (
            <div className="py-12 text-center text-rose-600">{error}</div>
          ) : (
            <CalendarMonth
              medications={medications}
              currentDate={currentDate}
              onMedicationClick={(medId) => navigate(`/medication/${medId}`)}
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default CalendarPage;
