import Button from '../Common/Button';

function MedicationDetail({ medication, onAddPackage, onSetStock }) {
  if (!medication) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow">
      <h1 className="mb-4 text-2xl font-semibold text-gray-800">{medication.name}</h1>
      <div className="grid gap-2 text-sm text-gray-600">
        <p>Dosierung morgens: {medication.dosage_morning}</p>
        <p>Dosierung abends: {medication.dosage_evening}</p>
        <p>Bestand: {medication.current_stock}</p>
        <p>Täglicher Verbrauch: {medication.daily_consumption}</p>
        <p>
          Verbleibende Tage:{' '}
          {Number.isFinite(medication.days_remaining) ? medication.days_remaining.toFixed(1) : '∞'}
        </p>
        <p>Warnstatus: {medication.warning_status}</p>
      </div>
      <div className="mt-6 flex gap-4">
        <Button onClick={onAddPackage}>Packung hinzufügen</Button>
        <Button variant="secondary" onClick={onSetStock}>
          Bestand setzen
        </Button>
      </div>
    </div>
  );
}

export default MedicationDetail;
