export function destinationLabel(r={}) {
  const house=String(r.house_name || r.name || '').trim();
  const nick=String(r.nickname || r.display_name || '').trim();
  if (nick && house && nick.toLowerCase() !== house.toLowerCase()) return `${nick} (${house})`;
  return nick || house || 'Unknown house';
}
