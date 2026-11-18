import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Layout/Header';
import MedicationDetail from '../components/Medications/MedicationDetail';
import MedicationForm from '../components/Medications/MedicationForm';
import Modal from '../components/Common/Modal';
import Button from '../components/Common/Button';
import { formatDateTime } from '../utils/dateFormatter';
import api from '../services/api';
import { getCurrentUser } from '../services/auth';
import useLiveRefresh from '../hooks/useLiveRefresh';
import DataFreshness from '../components/Common/DataFreshness';

const HISTORY_LABELS = {
  add_package: 'Packung hinzugefügt',
  set_stock: 'Bestand gesetzt',
  manual_correction: 'Bestand korrigiert',
  auto_deduction_morning: 'Automatischer Abzug morgens',
  auto_deduction_noon: 'Automatischer Abzug mittags',
  auto_deduction_evening: 'Automatischer Abzug abends',
  auto_deduction_interval: 'Automatischer Intervall-Abzug'
};

const UNCLEAR_STOCK = 'Buchungsstatus unklar. Wiederhole dieselbe Buchung, um den Status zu klären.';

function MedicationDetailPage() {
  const { id } = useParams();
  return <MedicationDetailView key={id} id={id} />;
}

function MedicationDetailView({ id }) {
  const navigate = useNavigate();
  const [medication, setMedication] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyUpdatedAt, setHistoryUpdatedAt] = useState(null);
  const [historyStale, setHistoryStale] = useState(false);
  const historyGeneration = useRef(0);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [stockAction, setStockAction] = useState(null);
  const [stockAmount, setStockAmount] = useState('');
  const [isStockUpdating, setIsStockUpdating] = useState(false);
  const stockKey = `tabletto:stock:${getCurrentUser()?.id}:${id}`;
  const [pendingStock, setPendingStock] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(stockKey)); } catch { return null; }
  });
  const stockInFlight = useRef(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPhotoDeleteModalOpen, setIsPhotoDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const fetchGeneration = useRef(0);

  const refreshHistory = async () => {
    const generation = ++historyGeneration.current;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const result = await api.getMedicationHistory(id);
      if (generation !== historyGeneration.current) return;
      setHistory(result.history);
      setNextCursor(result.next_cursor);
      setHistoryUpdatedAt(new Date().toISOString());
      setHistoryStale(false);
    } catch (err) {
      if (generation === historyGeneration.current) {
        setHistoryError(err.message);
        setHistoryStale(true);
      }
    } finally {
      if (generation === historyGeneration.current) setHistoryLoading(false);
    }
  };

  const fetchMedication = async () => {
    const generation = ++fetchGeneration.current;
    setError('');
    try {
      const { medication } = await api.getMedication(id);
      if (generation !== fetchGeneration.current) return;
      setMedication(medication);
      setUpdatedAt(new Date().toISOString());
    } catch (err) {
      if (generation === fetchGeneration.current) setError(err.message);
    } finally {
      if (generation === fetchGeneration.current) setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setMedication(null);
    setHistory([]);
    setNextCursor(null);
    fetchMedication();
    refreshHistory();
    return () => { fetchGeneration.current++; historyGeneration.current++; };
  }, [id]);

  const online = useLiveRefresh(() => {
    if (history.length > 50) {
      setHistoryStale(true);
      return fetchMedication();
    }
    return Promise.all([fetchMedication(), refreshHistory()]);
  }, isEditModalOpen || Boolean(stockAction) || photoUploading || isDeleting || historyLoading);
  const loadOlderHistory = async () => {
    if (historyLoading) return;
    const generation = ++historyGeneration.current;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const result = await api.getMedicationHistory(id, 50, nextCursor);
      if (generation !== historyGeneration.current) return;
      setHistory(prev => [...prev, ...result.history]);
      setNextCursor(result.next_cursor);
    } catch (err) {
      if (generation === historyGeneration.current) setHistoryError(err.message);
    } finally {
      if (generation === historyGeneration.current) setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(''), 4000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const openStockDialog = action => {
    setError('');
    setStockAmount(pendingStock ? String(pendingStock.amount) : action === 'set_stock' ? String(medication?.current_stock ?? '') : '');
    setStockAction(pendingStock?.action ?? action);
  };

  const handleStockSubmit = async event => {
    event.preventDefault();
    if (stockInFlight.current) return;
    const amount = Number(stockAmount);
    const isPackage = stockAction === 'add_package';
    if (!Number.isFinite(amount) || (isPackage ? amount <= 0 : amount < 0)) {
      setError(isPackage ? 'Packungsgröße muss größer als 0 sein' : 'Bestand darf nicht negativ sein');
      return;
    }
    stockInFlight.current = true;
    setIsStockUpdating(true);
    setError('');
    try {
      let operation = pendingStock;
      if (!operation) {
        operation = { action: stockAction, amount, key: crypto.getRandomValues(new Uint32Array(4)).join('-') };
        try {
          sessionStorage.setItem(stockKey, JSON.stringify(operation));
        } catch {
          setError('Vorgang konnte im Browser nicht gespeichert werden. Es wurde nichts gesendet.');
          return;
        }
        setPendingStock(operation);
      }
      const result = await api.updateStock(id, operation.action, operation.amount, operation.key);
      if (!pendingStock) setMedication(result.medication);
      sessionStorage.removeItem(stockKey);
      setPendingStock(null);
      await Promise.all([fetchMedication(), refreshHistory()]);
      setFeedback(isPackage ? 'Packung wurde hinzugefügt.' : 'Bestand wurde aktualisiert.');
      setStockAction(null);
      setStockAmount('');
    } catch (err) {
      if ([400, 404, 409].includes(err.status)) {
        sessionStorage.removeItem(stockKey);
        setPendingStock(null);
        setError(err.message);
      } else {
        setError(UNCLEAR_STOCK);
      }
    } finally {
      stockInFlight.current = false;
      setIsStockUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await api.deleteMedication(id);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePhotoUpload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    setError('');
    try {
      await api.uploadMedicationPhoto(id, file);
      await fetchMedication();
      setFeedback('Foto wurde hochgeladen.');
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoUploading(false);
      event.target.value = '';
    }
  };

  const handlePhotoDelete = async () => {
    setPhotoUploading(true);
    setError('');
    try {
      await api.deleteMedicationPhoto(id);
      await fetchMedication();
      setFeedback('Foto wurde gelöscht.');
      setIsPhotoDeleteModalOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleUpdate = async data => {
    setIsUpdating(true);
    setError('');
    try {
      await api.updateMedication(id, data);
      await fetchMedication();
      setIsEditModalOpen(false);
      setFeedback('Medikament wurde aktualisiert.');
    } catch (err) {
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Header />
      {feedback && (
        <div role="status" className="fixed bottom-4 left-4 right-4 z-[60] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-lg sm:bottom-auto sm:left-auto sm:top-20 sm:max-w-sm">
          {feedback}
        </div>
      )}
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <DataFreshness updatedAt={updatedAt} online={online} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)} className="w-full sm:w-auto">
            ← Zurück
          </Button>
          <Button variant="secondary" onClick={() => setIsEditModalOpen(true)} disabled={!medication} className="w-full sm:w-auto">
            Medikament bearbeiten
          </Button>
          <Button variant="secondary" onClick={() => setIsDeleteModalOpen(true)} disabled={!medication} className="w-full sm:w-auto">
            Medikament löschen
          </Button>
        </div>
        {error && !stockAction && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
        {pendingStock && !stockAction && medication && (
          <div className="rounded-md bg-amber-50 p-3 text-sm">
            <p role="status">{UNCLEAR_STOCK}</p>
            <Button onClick={() => openStockDialog(pendingStock.action)}>Buchung wiederholen</Button>
          </div>
        )}
        {loading && <p role="status" className="rounded-2xl bg-white/80 p-6 text-center text-gray-600">Medikament wird geladen …</p>}
        {!loading && !medication && <p className="rounded-2xl bg-white/80 p-6 text-center text-gray-700">Dieses Medikament ist nicht verfügbar.</p>}
        <MedicationDetail
          medication={medication}
          onAddPackage={() => openStockDialog('add_package')}
          onSetStock={() => openStockDialog('set_stock')}
          onPhotoUpload={handlePhotoUpload}
          onPhotoDelete={() => setIsPhotoDeleteModalOpen(true)}
          photoUploading={photoUploading}
        />
        <div className="rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Historie</p>
              <h2 className="text-xl font-semibold text-gray-900">Bestandsbewegungen</h2>
            </div>
            <Button variant="secondary" onClick={refreshHistory} className="w-full sm:w-auto">
              Verlauf aktualisieren
            </Button>
          </div>
          <DataFreshness updatedAt={historyUpdatedAt} online={online} />
          {historyStale && <p role="status" className="text-sm text-amber-800">Verlauf möglicherweise veraltet.</p>}
          <ul className="space-y-3 text-sm text-gray-600">
            {history.map(entry => (
              <li
                key={entry.id}
                className="flex flex-col gap-1 rounded-2xl border border-gray-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-gray-800">{HISTORY_LABELS[entry.action] || entry.action}</span>
                <span className="text-gray-500">
                  {entry.old_stock} → {entry.new_stock}
                </span>
                <span className="text-xs text-gray-400">{formatDateTime(entry.timestamp)}</span>
              </li>
            ))}
            {!history.length && <li className="text-sm text-gray-500">Keine Historie vorhanden.</li>}
          </ul>
          {historyError && <p role="alert" className="mt-3 text-rose-700">{historyError}</p>}
          {nextCursor && <Button variant="secondary" className="mt-4" onClick={loadOlderHistory} disabled={historyLoading}>
            {historyLoading ? 'Lade ältere Einträge …' : 'Ältere Einträge laden'}
          </Button>}
        </div>
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => !isUpdating && setIsEditModalOpen(false)}
          title="Medikament bearbeiten"
        >
          <MedicationForm
            initialData={medication}
            isEditMode={true}
            onSubmit={handleUpdate}
            isSubmitting={isUpdating}
            onSuccess={() => setIsEditModalOpen(false)}
          />
        </Modal>
        <Modal
          isOpen={Boolean(stockAction)}
          onClose={() => !isStockUpdating && setStockAction(null)}
          title={stockAction === 'add_package' ? 'Packung hinzufügen' : 'Bestand setzen'}
        >
          <form className="space-y-4" onSubmit={handleStockSubmit}>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-800">
              {stockAction === 'add_package' ? 'Packungsgröße (Tabletten)' : 'Neuer Bestand'}
              <input
                type="number"
                min="0"
                max="10000"
                step="any"
                inputMode="decimal"
                value={stockAmount}
                readOnly={Boolean(pendingStock) || isStockUpdating}
                aria-describedby={error || (pendingStock && !isStockUpdating) ? 'stock-message' : undefined}
                onChange={event => setStockAmount(event.target.value)}
                className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                required
              />
            </label>
            {(error || (pendingStock && !isStockUpdating)) && (
              <p id="stock-message" role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-600">{error || UNCLEAR_STOCK}</p>
            )}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setStockAction(null)} disabled={isStockUpdating}>
                {pendingStock ? 'Schließen' : 'Abbrechen'}
              </Button>
              <Button type="submit" disabled={isStockUpdating}>
                {isStockUpdating ? 'Speichere...' : pendingStock ? 'Buchung wiederholen' : 'Bestätigen'}
              </Button>
            </div>
          </form>
        </Modal>
        <Modal
          isOpen={isPhotoDeleteModalOpen}
          onClose={() => !photoUploading && setIsPhotoDeleteModalOpen(false)}
          title="Foto löschen"
        >
          <div className="space-y-5">
            <p className="text-gray-700">Möchtest du das hinterlegte Packungsfoto löschen?</p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsPhotoDeleteModalOpen(false)} disabled={photoUploading}>
                Abbrechen
              </Button>
              <button
                type="button"
                onClick={handlePhotoDelete}
                disabled={photoUploading}
                className="min-h-11 rounded-lg bg-rose-600 px-4 py-2 font-medium text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:opacity-60"
              >
                {photoUploading ? 'Lösche...' : 'Foto löschen'}
              </button>
            </div>
          </div>
        </Modal>
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
          title="Medikament löschen"
        >
          <div className="space-y-5">
            <p className="text-gray-700">
              Möchtest du <strong>{medication?.name}</strong> inklusive der gesamten Bestandshistorie endgültig löschen?
            </p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsDeleteModalOpen(false)} disabled={isDeleting}>
                Abbrechen
              </Button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="min-h-11 rounded-lg bg-rose-600 px-4 py-2 font-medium text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:opacity-60"
              >
                {isDeleting ? 'Lösche...' : 'Endgültig löschen'}
              </button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}

export default MedicationDetailPage;
