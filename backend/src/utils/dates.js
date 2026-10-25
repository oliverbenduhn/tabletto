/** Parses SQLite UTC timestamps without relying on the process's local timezone. */
function parseTimestamp(value) {
  if (typeof value !== 'string') return new Date(NaN);
  const normalized = value.replace(' ', 'T');
  return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(normalized) ? `${normalized}Z` : normalized);
}

function zonedParts(date = new Date(), timeZone = process.env.TZ || 'Europe/Berlin') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((result, part) => { result[part.type] = part.value; return result; }, {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Naive dates represent calendar dates in the configured scheduler timezone. */
function dueDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(value)) return value.slice(0, 10);
  return zonedParts(parseTimestamp(value)).date;
}
function validCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10);
}
module.exports = { parseTimestamp, zonedParts, addDays, dueDate, validCalendarDate };
