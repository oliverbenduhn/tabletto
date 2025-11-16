import MedicationCard from './MedicationCard';

function MedicationList({ medications }) {
  if (!medications.length) {
    return <p className="text-gray-500">Noch keine Medikamente vorhanden.</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {medications.map(med => (
        <MedicationCard key={med.id} medication={med} />
      ))}
    </div>
  );
}

export default MedicationList;
