const zones = Object.freeze(
  (typeof Intl.supportedValuesOf === 'function'
    ? Intl.supportedValuesOf('timeZone')
    : ['UTC', 'America/Chicago', 'America/New_York', 'America/Denver', 'America/Los_Angeles', 'Europe/London'])
    .concat('UTC').filter((zone, index, all) => all.indexOf(zone) === index).sort()
);

function partsFor(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

export function normalizeTimezone(value) {
  const timezone = String(value ?? '').trim();
  if (!timezone || !zones.includes(timezone)) throw new Error(`Unsupported IANA timezone '${timezone}'.`);
  return timezone;
}

export function listSupportedTimezones({ query = '', page = 1, limit = 25 } = {}) {
  const needle = String(query).trim().toLowerCase();
  const filtered = zones.filter(zone => !needle || zone.toLowerCase().includes(needle));
  const size = Math.max(1, Math.min(25, Number(limit) || 25));
  const currentPage = Math.max(1, Number(page) || 1);
  const start = (currentPage - 1) * size;
  return { items: filtered.slice(start, start + size), page: currentPage, limit: size, total: filtered.length, hasNext: start + size < filtered.length };
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim());
  if (!match) throw new Error('Invalid date; use YYYY-MM-DD.');
  const [, year, month, day] = match.map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) throw new Error('Invalid calendar date.');
  return { year, month, day };
}

function parseTime(value) {
  const text = String(value ?? '').trim().toUpperCase();
  let match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/.exec(text);
  if (!match) throw new Error('Invalid time; use 7:30 PM or 19:30.');
  let [, hourText, minuteText, secondText = '0', meridiem] = match;
  let hour = Number(hourText), minute = Number(minuteText), second = Number(secondText);
  if (minute > 59 || second > 59) throw new Error('Invalid time.');
  if (meridiem) {
    if (hour < 1 || hour > 12) throw new Error('Invalid 12-hour time.');
    hour = (hour % 12) + (meridiem === 'PM' ? 12 : 0);
  } else if (hour > 23) throw new Error('Invalid 24-hour time.');
  return { hour, minute, second };
}

function sameLocal(parts, target) {
  return parts.year === target.year && parts.month === target.month && parts.day === target.day && parts.hour === target.hour && parts.minute === target.minute && parts.second === target.second;
}

export function parseLocalDateTime({ date, time, timezone }) {
  const zone = normalizeTimezone(timezone);
  const calendar = parseDate(date);
  const clock = parseTime(time);
  const target = { ...calendar, ...clock };
  const nominal = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute, target.second);
  const matches = [];
  const start = nominal - 36 * 60 * 60 * 1000;
  const end = nominal + 36 * 60 * 60 * 1000;
  for (let instant = start; instant <= end; instant += 60 * 1000) {
    const candidate = new Date(instant);
    if (sameLocal(partsFor(candidate, zone), target)) matches.push(candidate);
  }
  if (matches.length === 0) throw new Error('The selected local time is nonexistent in this timezone (zero matching instants).');
  if (matches.length > 1) throw new Error('The selected local time is ambiguous in this timezone (twice during the DST transition).');
  return { utc: matches[0], timezone: zone, local: `${date} ${time}` };
}

export function formatEventTimestamps(utcDate, timezone) {
  const zone = normalizeTimezone(timezone);
  const date = utcDate instanceof Date ? utcDate : new Date(utcDate);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid event timestamp.');
  return { timezone: zone, local: new Intl.DateTimeFormat('en-US', { timeZone: zone, dateStyle: 'medium', timeStyle: 'short' }).format(date), iso: date.toISOString() };
}
