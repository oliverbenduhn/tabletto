import { useEffect, useState } from 'react';
import Header from '../components/Layout/Header';
import MedicationList from '../components/Medications/MedicationList';
import MedicationForm from '../components/Medications/MedicationForm';
import api from '../services/api';

function DashboardPage() {
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-800">Meine Medikamente</h2>
              <button className="text-sm text-blue-600 hover:underline" onClick={fetchMedications}>
                Aktualisieren
              </button>
            </div>
            {loading ? (
              <p>Lade...</p>
            ) : error ? (
              <p className="text-red-600">{error}</p>
            ) : (
              <MedicationList medications={medications} />
            )}
          </div>
          <MedicationForm onSubmit={handleCreateMedication} />
        </section>
      </main>
    </div>
  );
}

export default DashboardPage;
