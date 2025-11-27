import { useState } from 'react';
import api from '../../services/api';

function ImportExportDialog({ isOpen, onClose, onImportSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleExport = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const response = await api.exportData();

      // Erstelle Download-Link
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `tabletto-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSuccess('Daten erfolgreich exportiert!');
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.message || 'Fehler beim Exportieren');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const fileContent = await file.text();
      const data = JSON.parse(fileContent);

      const response = await api.importData(data);

      setSuccess(`Erfolgreich importiert: ${response.imported.medications} Medikamente, ${response.imported.history} Einträge`);

      setTimeout(() => {
        setSuccess('');
        onClose();
        if (onImportSuccess) onImportSuccess();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Fehler beim Importieren. Bitte überprüfe die Datei.');
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Daten Import & Export</h2>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-600">
            {success}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-700">Exportieren</h3>
            <p className="mb-3 text-sm text-gray-500">
              Alle deine Medikamente und Historie als JSON-Datei herunterladen.
            </p>
            <button
              onClick={handleExport}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Exportiere...' : 'Daten exportieren'}
            </button>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">Importieren</h3>
            <p className="mb-3 text-sm text-gray-500">
              Daten aus einer Backup-Datei wiederherstellen.
            </p>
            <p className="mb-3 text-xs text-red-500">
              ⚠️ Achtung: Bestehende Daten werden überschrieben!
            </p>
            <label className="block w-full cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-center text-sm text-gray-600 transition hover:border-blue-500 hover:bg-blue-50">
              {loading ? 'Importiere...' : 'Datei auswählen'}
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={loading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <button
          onClick={onClose}
          disabled={loading}
          className="mt-6 w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          Schließen
        </button>
      </div>
    </div>
  );
}

export default ImportExportDialog;
