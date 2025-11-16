import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Layout/Header';
import MedicationList from '../components/Medications/MedicationList';
import MedicationForm from '../components/Medications/MedicationForm';
import api from '../services/api';

function DashboardPage() {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const handleCreateMedication = async form => {
    try {
      await api.createMedication(form);
      fetchMedications();
    } catch (err) {
      setError(err.message);
    }
  };

  const stats = useMemo(() => {
    if (!medications.length) {
      return [
        { label: 'Gesamtanzahl', value: '0' },
        { label: 'Kritisch', value: '0' },
        { label: 'Warnungen', value: '0' },
        { label: 'Ø Tage übrig', value: '–' }
      ];
    }

    const total = medications.length;
    const critical = medications.filter(med => med.warning_status === 'critical').length;
    const warning = medications.filter(med => med.warning_status === 'warning').length;
    const avgDays = medications.reduce((acc, med) => acc + (med.days_remaining || 0), 0) / total;

    return [
      { label: 'Gesamtanzahl', value: total },
      { label: 'Kritisch', value: critical },
      { label: 'Warnungen', value: warning },
      { label: 'Ø Tage übrig', value: Number.isFinite(avgDays) ? Math.round(avgDays) : '–' }
    ];
  }, [medications]);

  const filteredMedications = useMemo(() => {
    return medications.filter(med => {
      const matchesSearch = (med.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || med.warning_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [medications, searchTerm, statusFilter]);

  const filterButtons = [
    { id: 'all', label: 'Alle' },
    { id: 'good', label: 'Stabil' },
    { id: 'warning', label: 'Warnung' },
    { id: 'critical', label: 'Kritisch' }
  ];

  return (
    <div className="min-h-screen bg-transparent">
      <Header />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section className="rounded-3xl border border-blue-100 bg-white/80 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-blue-400">Übersicht</p>
              <h1 className="text-2xl font-semibold text-gray-900 md:text-3xl">Dein Medikamenten-Cockpit</h1>
              <p className="text-sm text-gray-600">
                Behalte Verbräuche, Bestände und Warnungen jederzeit im Blick.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-600">
              <button
                className="rounded-full border border-gray-200 px-3 py-1 hover:border-blue-200 hover:text-blue-600"
                onClick={fetchMedications}
              >
                Aktualisieren
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map(stat => (
              <div key={stat.label} className="rounded-2xl bg-slate-50 p-4 text-center">
                <p className="text-xs uppercase tracking-wide text-gray-400">{stat.label}</p>
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[3fr,2fr]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-100 bg-white/90 p-4 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Meine Medikamente</h2>
                  <p className="text-sm text-gray-500">Suche, filtere und verwalte deine Bestände.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  type="search"
                  placeholder="Suche nach Name..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
                <div className="flex flex-wrap gap-2">
                  {filterButtons.map(button => (
                    <button
                      key={button.id}
                      onClick={() => setStatusFilter(button.id)}
                      className={`rounded-full px-3 py-1 text-sm transition ${
                        statusFilter === button.id
                          ? 'bg-blue-600 text-white shadow'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {loading ? (
              <div className="rounded-2xl border border-gray-100 bg-white/70 p-6 text-center text-gray-500">Lade ...</div>
            ) : (
              <MedicationList
                medications={filteredMedications}
                emptyState={
                  searchTerm
                    ? 'Keine Medikamente entsprechen deiner Suche.'
                    : 'Noch keine Medikamente vorhanden.'
                }
              />
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
          <MedicationForm onSubmit={handleCreateMedication} />
        </section>
      </main>
    </div>
  );
}

export default DashboardPage;
