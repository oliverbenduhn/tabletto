import { formatDateTime } from '../../utils/dateFormatter';

export default function DataFreshness({ updatedAt, online }) {
  return <p className="my-2 text-sm text-gray-600">
    {!online ? 'Offline – angezeigte Daten können veraltet sein. ' : ''}
    {updatedAt ? `Zuletzt aktualisiert: ${formatDateTime(updatedAt)}` : 'Noch keine aktuellen Daten geladen.'}
  </p>;
}
