import { Link } from 'react-router-dom';

const statusColors = {
  good: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
  critical: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
};

const statusDot = {
  good: 'bg-emerald-400',
  warning: 'bg-amber-400',
  critical: 'bg-rose-400'
};

const statusLabels = {
  good: 'Stabil',
  warning: 'Warnung',
  critical: 'Kritisch'
};

const statusIcons = {
  good: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4 12.5 9.5 18 20 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 7v5m0 4h.01M4.5 19h15L12 5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  critical: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  )
};

function MedicationCard({ medication, layout = 'grid' }) {
  const daysRemaining = Number.isFinite(medication.days_remaining) ? medication.days_remaining : null;

  // Handle negative days (overdue medications)
  const isOverdue = daysRemaining !== null && daysRemaining < 0;
  const daysDisplay = isOverdue
    ? `${Math.abs(daysRemaining).toFixed(1)} Tage überfällig`
    : daysRemaining !== null
      ? `${daysRemaining.toFixed(1)}`
      : 'Unbegrenzt';

  const warningThreshold = medication.warning_threshold_days || Math.abs(daysRemaining) || 1;
  const percentage = daysRemaining !== null && !isOverdue
    ? Math.max(0, Math.min(100, (daysRemaining / warningThreshold) * 100))
    : isOverdue ? 0 : 100;

  const daysColor =
    medication.warning_status === 'critical'
      ? 'text-rose-600'
      : medication.warning_status === 'warning'
        ? 'text-amber-600'
        : 'text-emerald-600';

  return (
    <Link
      to={`/medication/${medication.id}`}
      className={`group rounded-2xl border border-gray-100 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md ${
        layout === 'list' ? 'sm:flex sm:items-center sm:gap-6' : ''
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Medikament</p>
          <h3 className="text-lg font-semibold text-gray-800">{medication.name}</h3>
        </div>
        <span
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            statusColors[medication.warning_status]
          }`}
        >
          <span className="text-current">{statusIcons[medication.warning_status]}</span>
          {statusLabels[medication.warning_status] || medication.warning_status}
        </span>
      </div>
      <dl
        className={`mt-4 grid grid-cols-2 gap-4 text-sm text-gray-600 ${
          layout === 'list' ? 'sm:flex-1 md:grid-cols-4' : 'sm:grid-cols-4'
        }`}
      >
        <div>
          <dt className="text-xs uppercase text-gray-400">Bestand</dt>
          <dd className={`text-base font-semibold ${medication.current_stock < 0 ? 'text-rose-600' : 'text-gray-900'}`}>
            {medication.current_stock}
          </dd>
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
      <div className="mt-4 space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${statusDot[medication.warning_status]}`} />
            {isOverdue ? 'Überfällig' : 'Verbleibende Tage'}
          </span>
          <span className={`font-semibold ${daysColor}`}>
            {daysDisplay}
          </span>
        </div>
        <div className="h-2 rounded-full bg-gray-100">
          <div
            className={`h-2 rounded-full ${
              medication.warning_status === 'critical'
                ? 'bg-gradient-to-r from-rose-500 to-rose-400'
                : medication.warning_status === 'warning'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-300'
                  : 'bg-gradient-to-r from-emerald-500 to-emerald-300'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

export default MedicationCard;
