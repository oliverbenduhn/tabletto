import { Link } from 'react-router-dom';

const statusColors = {
  good: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
  critical: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
};

const statusLabels = {
  good: 'Stabil',
  warning: 'Warnung',
  critical: 'Kritisch'
};

function MedicationCard({ medication }) {
  const daysRemaining = Number.isFinite(medication.days_remaining) ? medication.days_remaining : null;
  const warningThreshold = medication.warning_threshold_days || daysRemaining || 1;
  const percentage = daysRemaining
    ? Math.max(0, Math.min(100, (daysRemaining / warningThreshold) * 100))
    : 100;

  return (
    <Link
      to={`/medication/${medication.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Medikament</p>
          <h3 className="text-lg font-semibold text-gray-800">{medication.name}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[medication.warning_status]}`}>
          {statusLabels[medication.warning_status] || medication.warning_status}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-4 text-sm text-gray-600 sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase text-gray-400">Bestand</dt>
          <dd className="text-base font-semibold text-gray-900">{medication.current_stock}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-400">Täglicher Verbrauch</dt>
          <dd className="text-base font-semibold text-gray-900">{medication.daily_consumption}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-400">Dosierung morgens</dt>
          <dd>{medication.dosage_morning}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-gray-400">Dosierung abends</dt>
          <dd>{medication.dosage_evening}</dd>
        </div>
      </dl>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Verbleibende Tage</span>
          <span className="font-semibold text-gray-800">
            {daysRemaining !== null ? daysRemaining.toFixed(1) : 'Unbegrenzt'}
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

export default MedicationCard;
