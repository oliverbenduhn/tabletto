import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Layout/Header';
import MedicationDetail from '../components/Medications/MedicationDetail';
import MedicationForm from '../components/Medications/MedicationForm';
import Modal from '../components/Common/Modal';
import Button from '../components/Common/Button';
import { formatDate } from '../utils/dateFormatter';
import api from '../services/api';

function MedicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [medication, setMedication] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchMedication = async () => {
    setError('');
    try {
      const { medication } = await api.getMedication(id);
      setMedication(medication);
      const { history } = await api.getMedicationHistory(id);
      setHistory(history);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchMedication();
  }, [id]);

  const handleAddPackage = async () => {
    const value = prompt('Packungsgröße (Tabletten) eingeben');
    if (value === null) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Ungültige Packungsgröße');
      return;
    }
    try {
      await api.updateStock(id, 'add_package', amount);
      fetchMedication();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSetStock = async () => {
    const value = prompt('Neuen Bestand eingeben');
    if (value === null) return;
    const amount = Number(value);
    if (Number.isNaN(amount)) {
      setError('Ungültiger Wert');
      return;
    }
    try {
      await api.updateStock(id, 'set_stock', amount);
      fetchMedication();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Medikament löschen?')) return;
    try {
      await api.deleteMedication(id);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
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
    } catch (err) {
      setError(err.message);
    } finally {
      setPhotoUploading(false);
      event.target.value = '';
    }
  };

  const handlePhotoDelete = async () => {
    if (!confirm('Foto löschen?')) return;
    setPhotoUploading(true);
    setError('');
    try {
      await api.deleteMedicationPhoto(id);
      await fetchMedication();
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
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <Header />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)} className="w-full sm:w-auto">
            ← Zurück
          </Button>
          <Button variant="secondary" onClick={() => setIsEditModalOpen(true)} className="w-full sm:w-auto">
            Medikament bearbeiten
          </Button>
          <Button variant="secondary" onClick={handleDelete} className="w-full sm:w-auto">
            Medikament löschen
          </Button>
        </div>
        {error && <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
        <MedicationDetail
          medication={medication}
          onAddPackage={handleAddPackage}
          onSetStock={handleSetStock}
          onPhotoUpload={handlePhotoUpload}
          onPhotoDelete={handlePhotoDelete}
          photoUploading={photoUploading}
        />
        <div className="rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Historie</p>
              <h2 className="text-xl font-semibold text-gray-900">Bestandsbewegungen</h2>
            </div>
            <Button variant="secondary" onClick={fetchMedication} className="w-full sm:w-auto">
              Verlauf aktualisieren
            </Button>
          </div>
          <ul className="space-y-3 text-sm text-gray-600">
            {history.map(entry => (
              <li
                key={entry.id}
                className="flex flex-col gap-1 rounded-2xl border border-gray-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="font-medium text-gray-800">{entry.action}</span>
                <span className="text-gray-500">
                  {entry.old_stock} → {entry.new_stock}
                </span>
                <span className="text-xs text-gray-400">{formatDate(entry.timestamp)}</span>
              </li>
            ))}
            {!history.length && <p className="text-sm text-gray-500">Keine Historie vorhanden.</p>}
          </ul>
        </div>
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
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
      </main>
    </div>
  );
}

export default MedicationDetailPage;
