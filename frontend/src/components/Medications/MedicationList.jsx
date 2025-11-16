import EmptyState from '../Common/EmptyState';
import MedicationCard from './MedicationCard';

function MedicationList({ medications, emptyState, viewMode = 'grid' }) {
  if (!medications.length) {
    return (
      <EmptyState
        title={emptyState || 'Noch keine Medikamente vorhanden.'}
        message="Füge deine erste Packung hinzu, um Verbrauch, Bestand und Warnungen zu verfolgen."
      />
    );
  }

  return (
    <div
      className={
        viewMode === 'grid'
          ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
          : 'flex flex-col gap-3'
      }
    >
      {medications.map(med => (
        <MedicationCard key={med.id} medication={med} layout={viewMode} />
      ))}
    </div>
  );
}

export default MedicationList;
