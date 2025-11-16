import MedicationCard from './MedicationCard';

function MedicationList({ medications, emptyState }) {
  if (!medications.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white/70 p-8 text-center text-sm text-gray-500">
        {emptyState || 'Noch keine Medikamente vorhanden.'}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {medications.map(med => (
        <MedicationCard key={med.id} medication={med} />
      ))}
    </div>
  );
}

export default MedicationList;
