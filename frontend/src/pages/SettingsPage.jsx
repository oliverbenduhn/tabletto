import { useState, useEffect } from 'react';
import Header from '../components/Layout/Header';
import Button from '../components/Common/Button';
import Input from '../components/Common/Input';
import api from '../services/api';

function SettingsPage() {
  const [preferences, setPreferences] = useState({
    dashboard_view: 'grid',
    calendar_view: 'dayGridMonth',
    dose_times: {
      morning: '08:00',
      noon: '12:00',
      evening: '20:00'
    }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const { preferences } = await api.getUserPreferences();
      setPreferences(preferences);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await api.updateUserPreferences(preferences);
      setSuccess('Einstellungen gespeichert ✓');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-gray-600">Lädt Einstellungen...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Einstellungen</h1>

        <div className="space-y-6">
          {/* Einnahmezeiten */}
          <div className="rounded-3xl border border-gray-100 bg-white/90 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Einnahmezeiten</h2>
            <p className="text-sm text-gray-600 mb-4">
              Lege fest, zu welchen Uhrzeiten deine Medikamente automatisch abgezogen werden sollen.
            </p>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Input
                  label="Morgens"
                  type="time"
                  value={preferences.dose_times.morning}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    dose_times: { ...prev.dose_times, morning: e.target.value }
                  }))}
                />
                <p className="text-xs text-gray-500 mt-1">Für tägliche Medikamente</p>
              </div>

              <div>
                <Input
                  label="Mittags (Intervall-Einnahme)"
                  type="time"
                  value={preferences.dose_times.noon}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    dose_times: { ...prev.dose_times, noon: e.target.value }
                  }))}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Für wöchentliche/monatliche Medikamente
                </p>
              </div>

              <div>
                <Input
                  label="Abends"
                  type="time"
                  value={preferences.dose_times.evening}
                  onChange={(e) => setPreferences(prev => ({
                    ...prev,
                    dose_times: { ...prev.dose_times, evening: e.target.value }
                  }))}
                />
                <p className="text-xs text-gray-500 mt-1">Für tägliche Medikamente</p>
              </div>
            </div>
          </div>

          {/* Dashboard-Ansicht */}
          <div className="rounded-3xl border border-gray-100 bg-white/90 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Dashboard-Ansicht</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setPreferences(prev => ({ ...prev, dashboard_view: 'grid' }))}
                className={`rounded-xl px-4 py-2 transition ${
                  preferences.dashboard_view === 'grid'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Karten
              </button>
              <button
                onClick={() => setPreferences(prev => ({ ...prev, dashboard_view: 'list' }))}
                className={`rounded-xl px-4 py-2 transition ${
                  preferences.dashboard_view === 'list'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Liste
              </button>
            </div>
          </div>

          {/* Kalender-Ansicht */}
          <div className="rounded-3xl border border-gray-100 bg-white/90 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Kalender-Ansicht</h2>
            <div className="flex gap-3">
              <button
                onClick={() => setPreferences(prev => ({ ...prev, calendar_view: 'dayGridMonth' }))}
                className={`rounded-xl px-4 py-2 transition ${
                  preferences.calendar_view === 'dayGridMonth'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Monatsansicht
              </button>
              <button
                onClick={() => setPreferences(prev => ({ ...prev, calendar_view: 'listMonth' }))}
                className={`rounded-xl px-4 py-2 transition ${
                  preferences.calendar_view === 'listMonth'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Listenansicht
              </button>
            </div>
          </div>

          {/* Feedback */}
          {success && <p className="rounded-md bg-green-50 p-3 text-sm text-green-600">{success}</p>}
          {error && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}

          {/* Speichern */}
          <Button onClick={handleSave} disabled={saving} className="w-full justify-center">
            {saving ? 'Speichere...' : 'Einstellungen speichern'}
          </Button>
        </div>
      </main>
    </div>
  );
}

export default SettingsPage;
