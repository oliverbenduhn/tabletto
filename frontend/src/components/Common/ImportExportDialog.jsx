import { useState } from 'react';
import api from '../../services/api';
import Modal from './Modal';
import Button from './Button';

function ImportExportDialog({ isOpen, onClose, onImportSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingImport, setPendingImport] = useState(null);

  const closeDialog = () => {
    if (loading) return;
    setError('');
    setSuccess('');
    setPendingImport(null);
    onClose();
  };

  const handleExport = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `tabletto-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSuccess('Daten wurden erfolgreich exportiert.');
    } catch (err) {
      setError(err.message || 'Fehler beim Exportieren');
    } finally {
      setLoading(false);
    }
  };

  const inspectImport = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    setSuccess('');
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Die Importdatei darf höchstens 20 MB groß sein.');
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.medications) || !Array.isArray(data.history ?? [])) {
        throw new Error('Die Datei ist kein gültiger Tabletto-Export.');
      }
      setPendingImport({ data, fileName: file.name });
    } catch (err) {
      setPendingImport(null);
      setError(err instanceof SyntaxError ? 'Die Datei enthält kein gültiges JSON.' : err.message);
    }
  };

  const confirmImport = async () => {
    if (!pendingImport) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.importData(pendingImport.data);
      setSuccess(`Import abgeschlossen: ${response.imported.medications} Medikamente, ${response.imported.history} Historieneinträge.`);
      setPendingImport(null);
      onImportSuccess?.();
    } catch (err) {
      setError(err.message || 'Fehler beim Importieren');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={closeDialog} title="Daten importieren und exportieren">
      <div className="space-y-6">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{success}</p>}

        <section>
          <h3 className="mb-2 text-base font-semibold text-gray-800">Exportieren</h3>
          <p className="mb-3 text-sm text-gray-600">Medikamente und Bestandshistorie als JSON-Datei sichern. Fotos sind nicht enthalten.</p>
          <Button onClick={handleExport} disabled={loading} className="w-full">
            {loading ? 'Bitte warten …' : 'Daten exportieren'}
          </Button>
        </section>

        <section className="border-t border-gray-200 pt-5">
          <h3 className="mb-2 text-base font-semibold text-gray-800">Wiederherstellen</h3>
          <p className="mb-3 text-sm text-gray-600">Wähle zuerst eine Datei. Vor dem Ersetzen wird eine Zusammenfassung angezeigt.</p>
          <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-2 text-sm text-gray-700 hover:border-blue-500">
            Datei auswählen
            <input type="file" accept="application/json,.json" onChange={inspectImport} disabled={loading} className="sr-only" />
          </label>
        </section>

        {pendingImport && (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-4" aria-labelledby="import-confirmation-title">
            <h3 id="import-confirmation-title" className="font-semibold text-rose-900">Bestehende Daten ersetzen?</h3>
            <p className="mt-2 text-sm text-rose-800">
              „{pendingImport.fileName}“ enthält {pendingImport.data.medications.length} Medikamente und {(pendingImport.data.history || []).length} Historieneinträge.
              Alle aktuellen Medikamente und deren Historie werden dauerhaft ersetzt.
            </p>
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setPendingImport(null)} disabled={loading}>Abbrechen</Button>
              <button
                type="button"
                onClick={confirmImport}
                disabled={loading}
                className="min-h-11 rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {loading ? 'Importiere …' : 'Alle Daten ersetzen'}
              </button>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}

export default ImportExportDialog;
