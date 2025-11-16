import { useEffect, useMemo, useRef, useState } from 'react';
import Header from '../components/Layout/Header';
import MedicationList from '../components/Medications/MedicationList';
import MedicationForm from '../components/Medications/MedicationForm';
import StatusDistribution from '../components/Dashboard/StatusDistribution';
import api from '../services/api';

const statConfig = [
  {
    id: 'total',
    label: 'Gesamtanzahl',
    description: 'Alle gelisteten Präparate',
    accent: 'from-sky-50 to-sky-100',
    indicator: 'bg-sky-400',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-sky-500" aria-hidden="true">
        <path
          d="M4 7h16M4 12h16M4 17h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    id: 'critical',
    label: 'Kritisch',
    description: 'Sofort handeln',
    accent: 'from-rose-50 to-rose-100',
    indicator: 'bg-rose-400',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-rose-500" aria-hidden="true">
        <path
          d="M12 7v5m0 4h.01M4.5 19h15L12 5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    )
  },
  {
    id: 'warning',
    label: 'Warnungen',
    description: 'Frühzeitig planen',
    accent: 'from-amber-50 to-amber-100',
    indicator: 'bg-amber-400',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-amber-500" aria-hidden="true">
        <path
          d="M6 12h12M12 6v12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    id: 'avg',
    label: 'Ø Tage übrig',
    description: 'Pro Eintrag',
    accent: 'from-emerald-50 to-emerald-100',
    indicator: 'bg-emerald-400',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-emerald-500" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
];

function DashboardPage() {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name-asc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [statsPulse, setStatsPulse] = useState(false);
  const formRef = useRef(null);

  const fetchMedications = async () => {
    setLoading(true);
    setError('');
    try {
      const { medications } = await api.getMedications();
      setMedications(medications);
    } catch (err) {
      setError(err.message);
      setToast({ type: 'error', message: 'Laden fehlgeschlagen – bitte versuche es erneut.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedications();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const handleCreateMedication = async form => {
    setIsSubmitting(true);
    setError('');
    try {
      await api.createMedication(form);
      setToast({ type: 'success', message: `${form.name || 'Medikament'} gespeichert.` });
      await fetchMedications();
    } catch (err) {
      setError(err.message);
      setToast({ type: 'error', message: err.message || 'Speichern fehlgeschlagen.' });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusCounts = useMemo(() => {
    const counts = { total: medications.length, critical: 0, warning: 0, good: 0 };
    medications.forEach(med => {
      if (med.warning_status === 'critical') counts.critical += 1;
      else if (med.warning_status === 'warning') counts.warning += 1;
    });
    counts.good = Math.max(0, counts.total - counts.warning - counts.critical);
    return counts;
  }, [medications]);

  const statCards = useMemo(() => {
    if (!medications.length) {
      return statConfig.map(stat => ({ ...stat, value: stat.id === 'avg' ? '–' : 0 }));
    }

    const total = medications.length;
    const critical = statusCounts.critical;
    const warning = statusCounts.warning;
    const avgDays = medications.reduce((acc, med) => acc + (med.days_remaining || 0), 0) / total;

    const valueMap = {
      total,
      critical,
      warning,
      avg: Number.isFinite(avgDays) ? Math.round(avgDays) : '–'
    };

    return statConfig.map(stat => ({ ...stat, value: valueMap[stat.id] ?? '–' }));
  }, [medications, statusCounts]);

  useEffect(() => {
    const timer = setTimeout(() => setStatsPulse(false), 450);
    setStatsPulse(true);
    return () => clearTimeout(timer);
  }, [statCards.map(card => card.value).join('-')]);

  const filteredMedications = useMemo(() => {
    return medications.filter(med => {
      const matchesSearch = (med.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || med.warning_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [medications, searchTerm, statusFilter]);

  const sortedMedications = useMemo(() => {
    const meds = [...filteredMedications];
    switch (sortBy) {
      case 'days':
        return meds.sort((a, b) => (a.days_remaining ?? Infinity) - (b.days_remaining ?? Infinity));
      case 'stock':
        return meds.sort((a, b) => (b.current_stock || 0) - (a.current_stock || 0));
      default:
        return meds.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
  }, [filteredMedications, sortBy]);

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
        {toast && (
          <div
            className={`fixed right-4 top-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg ${
              toast.type === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
            {toast.message}
          </div>
        )}
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
            {statCards.map(stat => (
              <div
                key={stat.id}
                className={`rounded-2xl border border-white/40 bg-gradient-to-br ${stat.accent} p-4 text-center shadow-inner`}
              >
                <div className="flex items-center justify-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <span className={`h-2 w-2 rounded-full ${stat.indicator}`} />
                  {stat.label}
                </div>
                <div
                  className={`mt-3 flex items-center justify-center gap-2 text-3xl font-semibold text-gray-900 transition duration-300 ${
                    statsPulse ? 'scale-[1.04] text-blue-900' : ''
                  }`}
                >
                  {stat.icon}
                  <span>{stat.value}</span>
                </div>
                <p className="text-xs text-slate-600">{stat.description}</p>
              </div>
            ))}
          </div>
          <StatusDistribution counts={statusCounts} />
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
              <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-xs uppercase tracking-wide text-gray-400">Sortierung</span>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-1 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="days">Verbleibende Tage</option>
                    <option value="stock">Bestand</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`flex items-center gap-1 rounded-xl border px-3 py-1 text-sm transition ${
                      viewMode === 'grid'
                        ? 'border-blue-200 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                      <path fill="currentColor" d="M3 3h5v5H3zm9 0h5v5h-5zM3 12h5v5H3zm9 0h5v5h-5z" />
                    </svg>
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-1 rounded-xl border px-3 py-1 text-sm transition ${
                      viewMode === 'list'
                        ? 'border-blue-200 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                      <path fill="currentColor" d="M4 5h12v2H4zm0 4h12v2H4zm0 4h12v2H4z" />
                    </svg>
                    Liste
                  </button>
                </div>
              </div>
            </div>
            {loading ? (
              <div className="rounded-2xl border border-gray-100 bg-white/70 p-6 text-center text-gray-500">Lade ...</div>
            ) : (
              <MedicationList
                medications={sortedMedications}
                emptyState={
                  searchTerm
                    ? 'Keine Medikamente entsprechen deiner Suche.'
                    : 'Noch keine Medikamente vorhanden.'
                }
                viewMode={viewMode}
              />
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
          <MedicationForm ref={formRef} onSubmit={handleCreateMedication} isSubmitting={isSubmitting} />
        </section>
      </main>
      <button
        type="button"
        onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl text-white shadow-xl transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
        aria-label="Schnell ein neues Medikament hinzufügen"
      >
        +
      </button>
    </div>
  );
}

export default DashboardPage;
