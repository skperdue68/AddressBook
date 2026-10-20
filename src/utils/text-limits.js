export const TOUR_NAME_MAX = 200;
export const TOUR_DESCRIPTION_MAX = 2000;
export const HOUSE_NICKNAME_MAX = 255;
export const HOUSE_DESCRIPTION_MAX = 4000;
export const TOUR_STOP_TITLE_MAX = 180;
export const TOUR_STOP_NOTES_MAX = 1000;
export const EVENT_TITLE_MAX = 200;
export const EVENT_DESCRIPTION_MAX = 2000;

export function boundedRequired(value, max, label) {
  const clean = String(value ?? '').trim();
  if (!clean) throw new Error(`${label} is required.`);
  if (clean.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return clean;
}

export function boundedOptional(value, max, label) {
  if (value == null) return null;
  const clean = String(value).trim();
  if (!clean) return null;
  if (clean.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  return clean;
}

export const discordTitle = (value, fallback = '') => String(value ?? fallback).slice(0, 256);
export const discordDescription = (value, fallback = '') => String(value ?? fallback).slice(0, 4096);
export const discordField = (value, fallback = '') => String(value ?? fallback).slice(0, 1024);
export const discordSelectLabel = (value, fallback = '') => String(value ?? fallback).slice(0, 100);
