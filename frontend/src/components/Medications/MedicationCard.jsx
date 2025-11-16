import { Link } from 'react-router-dom';

const statusColors = {
  good: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  critical: 'bg-red-100 text-red-800'
};

function MedicationCard({ medication }) {
  return (
    <Link
      to={`/medication/${medication.id}`}
      className="flex flex-col gap-2 rounded-lg border bg-white p-4 shadow-sm hover:shadow"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">{medication.name}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[medication.warning_status]}`}>
          {medication.warning_status}
        </span>
      </div>
      <p className="text-sm text-gray-500">Bestand: {medication.current_stock}</p>
      <p className="text-sm text-gray-500">Täglicher Verbrauch: {medication.daily_consumption}</p>
      <p className="text-sm text-gray-500">
        Verbleibende Tage: {Number.isFinite(medication.days_remaining) ? medication.days_remaining.toFixed(1) : '∞'}
      </p>
    </Link>
  );
}

export default MedicationCard;
