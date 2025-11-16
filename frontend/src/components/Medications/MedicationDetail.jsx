import Button from '../Common/Button';

function MedicationDetail({ medication, onAddPackage, onSetStock }) {
  if (!medication) {
    return null;
  }

  const info = [
    { label: 'Dosierung morgens', value: medication.dosage_morning },
    { label: 'Dosierung abends', value: medication.dosage_evening },
    { label: 'Tabletten pro Packung', value: medication.tablets_per_package },
    { label: 'Täglicher Verbrauch', value: medication.daily_consumption },
    { label: 'Warngrenze (Tage)', value: medication.warning_threshold_days }
  ];

  return (
    <div className="rounded-3xl border border-gray-100 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Medikament</p>
          <h1 className="text-3xl font-semibold text-gray-900">{medication.name}</h1>
          <p className="text-sm text-gray-500">
            Aktueller Bestand: <span className="font-semibold text-gray-900">{medication.current_stock}</span>
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={onAddPackage}>Packung hinzufügen</Button>
          <Button variant="secondary" onClick={onSetStock}>
            Bestand setzen
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {info.map(field => (
          <div key={field.label} className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">{field.label}</p>
            <p className="text-lg font-semibold text-gray-900">{field.value ?? '–'}</p>
          </div>
        ))}
        <div className="rounded-2xl bg-blue-50 p-4">
          <p className="text-xs uppercase tracking-wide text-blue-400">Verbleibende Tage</p>
          <p className="text-3xl font-semibold text-blue-700">
            {Number.isFinite(medication.days_remaining) ? medication.days_remaining.toFixed(1) : 'Unbegrenzt'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default MedicationDetail;
