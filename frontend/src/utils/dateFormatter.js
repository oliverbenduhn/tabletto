/** Formats history timestamps in the browser's local timezone, including time. */
export function formatDateTime(dateString) {
  if (!dateString) return '-';
  // SQLite CURRENT_TIMESTAMP is UTC but omits its timezone suffix.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(dateString)
    ? `${dateString.replace(' ', 'T')}Z`
    : dateString;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
