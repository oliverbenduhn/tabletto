import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Layout/Header';
import MedicationDetail from '../components/Medications/MedicationDetail';
import Button from '../components/Common/Button';
import { formatDate } from '../utils/dateFormatter';
import api from '../services/api';

function MedicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [medication, setMedication] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

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
    try {
      await api.updateStock(id, 'add_package');
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

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Zurück
        </Button>
        {error && <p className="text-red-600">{error}</p>}
        <MedicationDetail medication={medication} onAddPackage={handleAddPackage} onSetStock={handleSetStock} />
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Verlauf</h2>
            <Button variant="secondary" onClick={handleDelete}>
              Löschen
            </Button>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            {history.map(entry => (
              <li key={entry.id} className="flex justify-between border-b pb-2">
                <span>{entry.action}</span>
                <span>
                  {entry.old_stock} → {entry.new_stock}
                </span>
                <span>{formatDate(entry.timestamp)}</span>
              </li>
            ))}
            {!history.length && <p>Keine Historie vorhanden.</p>}
          </ul>
        </div>
      </main>
    </div>
  );
}

export default MedicationDetailPage;
