import Button from '../Common/Button';

function MedicationDetail({ medication, onAddPackage, onSetStock, onPhotoUpload, onPhotoDelete, photoUploading }) {
  if (!medication) {
    return null;
  }

  const daysRemaining = Number.isFinite(medication.days_remaining) ? medication.days_remaining : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;

  // Format last measured timestamp
  const lastMeasuredDate = medication.last_stock_measured_at
    ? new Date(medication.last_stock_measured_at).toLocaleDateString('de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : '–';

  const info = [
    { label: 'Dosierung morgens', value: medication.dosage_morning },
    { label: 'Dosierung mittags', value: medication.dosage_noon },
    { label: 'Dosierung abends', value: medication.dosage_evening },
    { label: 'Täglicher Verbrauch', value: medication.daily_consumption },
    { label: 'Warngrenze (Tage)', value: medication.warning_threshold_days },
    { label: 'Letzter Bestand gemessen', value: lastMeasuredDate }
  ];

  return (
    <div className="rounded-3xl border border-gray-100 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Medikament</p>
          <h1 className="text-3xl font-semibold text-gray-900">{medication.name}</h1>
          <p className="text-sm text-gray-500">
            Aktueller Bestand:{' '}
            <span className={`font-semibold ${medication.current_stock < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
              {medication.current_stock}
            </span>
            {medication.current_stock < 0 && (
              <span className="ml-1 text-xs text-rose-600">(Nachschub erforderlich)</span>
            )}
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
        <div className="rounded-2xl border border-dashed border-blue-100 bg-blue-50/40 p-4 sm:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Foto</p>
              <p className="text-sm text-gray-600">
                {medication.photo_url ? 'Aktuelles Foto der Packung.' : 'Noch kein Foto hinterlegt.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <label className="cursor-pointer rounded-full border border-blue-100 px-3 py-1 text-blue-600 transition hover:bg-blue-50">
                {photoUploading ? 'Lade hoch ...' : 'Foto hochladen'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={onPhotoUpload}
                  disabled={photoUploading}
                  className="hidden"
                />
              </label>
              {medication.photo_url && (
                <button
                  type="button"
                  onClick={onPhotoDelete}
                  className="rounded-full border border-rose-100 px-3 py-1 text-rose-600 transition hover:bg-rose-50"
                >
                  Foto löschen
                </button>
              )}
            </div>
          </div>
          {medication.photo_url && (
            <img
              src={medication.photo_url}
              alt={`Foto von ${medication.name}`}
              className="mt-4 h-48 w-full rounded-2xl bg-white object-contain ring-1 ring-blue-100"
            />
          )}
        </div>
        {info.map(field => (
          <div key={field.label} className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-400">{field.label}</p>
            <p className="text-lg font-semibold text-gray-900">{field.value ?? '–'}</p>
          </div>
        ))}
        <div className={`rounded-2xl p-4 ${isOverdue ? 'bg-rose-50' : 'bg-blue-50'}`}>
          <p className={`text-xs uppercase tracking-wide ${isOverdue ? 'text-rose-400' : 'text-blue-400'}`}>
            {isOverdue ? 'Überfällig' : 'Verbleibende Tage'}
          </p>
          <p className={`text-3xl font-semibold ${isOverdue ? 'text-rose-700' : 'text-blue-700'}`}>
            {isOverdue
              ? `${Math.abs(daysRemaining).toFixed(1)} Tage`
              : daysRemaining !== null
                ? daysRemaining.toFixed(1)
                : 'Unbegrenzt'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default MedicationDetail;
