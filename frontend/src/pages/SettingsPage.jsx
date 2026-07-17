import { useState, useEffect } from 'react';
import Header from '../components/Layout/Header';
import Button from '../components/Common/Button';
import Input from '../components/Common/Input';
import api from '../services/api';

function SettingsPage() {
  const [preferences, setPreferences] = useState({
    dashboardView: 'grid',
    calendarView: 'dayGridMonth',
    dose_times: {
      morning: '08:00',
      noon: '12:00',
      evening: '20:00'
    },
    notificationWeeklyEnabled: false,
    notificationStatusEnabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTestMail, setSendingTestMail] = useState(false);
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

  const handleSendTestMail = async () => {
    setSendingTestMail(true);
    setSuccess('');
    setError('');
    try {
      const { message } = await api.sendWeeklyDigestTest();
      setSuccess(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingTestMail(false);
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
                type="button"
                aria-pressed={preferences.dashboardView === 'grid'}
                onClick={() => setPreferences(prev => ({ ...prev, dashboardView: 'grid' }))}
                className={`min-h-11 rounded-xl px-4 py-2 transition ${
                  preferences.dashboardView === 'grid'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Karten
              </button>
              <button
                type="button"
                aria-pressed={preferences.dashboardView === 'list'}
                onClick={() => setPreferences(prev => ({ ...prev, dashboardView: 'list' }))}
                className={`min-h-11 rounded-xl px-4 py-2 transition ${
                  preferences.dashboardView === 'list'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Liste
              </button>
            </div>
          </div>

          {/* Benachrichtigungen */}
        <div className="rounded-3xl border border-gray-100 bg-white/90 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Benachrichtigungen per E-Mail</h2>
          <p className="text-sm text-gray-600 mb-4">
            Empfänger ist deine registrierte E-Mail-Adresse. Beide Benachrichtigungen sind standardmäßig aus.
          </p>
          <div className="space-y-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                role="switch"
                aria-label="Wöchentliche Bestandsinfo-Mail aktivieren"
                className="mt-1 h-5 w-5 min-h-11 min-w-11 rounded border-gray-300 text-blue-500"
                checked={preferences.notificationWeeklyEnabled}
                onChange={(event) => setPreferences(prev => ({ ...prev, notificationWeeklyEnabled: event.target.checked }))}
              />
              <span className="flex-1">
                <span className="block font-medium text-gray-900">Wöchentliche Bestandsinfo-Mail</span>
                <span className="block text-sm text-gray-600">Sonntag 18:00: Übersicht und auffällige Medikamente.</span>
              </span>
            </label>
            <div className="rounded-2xl bg-blue-50 p-4">
              <p className="mb-3 text-sm text-blue-900">
                Sende die aktuelle Bestandsübersicht testweise an deine registrierte E-Mail-Adresse.
                Das verändert deine Benachrichtigungseinstellungen nicht.
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={handleSendTestMail}
                disabled={sendingTestMail || saving}
              >
                {sendingTestMail ? 'Testmail wird gesendet...' : 'Testmail senden'}
              </Button>
            </div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                role="switch"
                aria-label="Statuswarnungen aktivieren"
                className="mt-1 h-5 w-5 min-h-11 min-w-11 rounded border-gray-300 text-blue-500"
                checked={preferences.notificationStatusEnabled}
                onChange={(event) => setPreferences(prev => ({ ...prev, notificationStatusEnabled: event.target.checked }))}
              />
              <span className="flex-1">
                <span className="block font-medium text-gray-900">Statuswarnungen</span>
                <span className="block text-sm text-gray-600">Mail bei Verschlechterung des Warnstatus (gut → gelb oder rot).</span>
              </span>
            </label>
          </div>
        </div>

        {/* Kalender-Ansicht */}
          <div className="rounded-3xl border border-gray-100 bg-white/90 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Kalender-Ansicht</h2>
            <div className="flex gap-3">
              <button
                type="button"
                aria-pressed={preferences.calendarView === 'dayGridMonth'}
                onClick={() => setPreferences(prev => ({ ...prev, calendarView: 'dayGridMonth' }))}
                className={`min-h-11 rounded-xl px-4 py-2 transition ${
                  preferences.calendarView === 'dayGridMonth'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Monatsansicht
              </button>
              <button
                type="button"
                aria-pressed={preferences.calendarView === 'listMonth'}
                onClick={() => setPreferences(prev => ({ ...prev, calendarView: 'listMonth' }))}
                className={`min-h-11 rounded-xl px-4 py-2 transition ${
                  preferences.calendarView === 'listMonth'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Listenansicht
              </button>
            </div>
          </div>

          {/* Feedback */}
          {success && <p role="status" className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</p>}
          {error && <p role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

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
