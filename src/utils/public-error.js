import {randomBytes} from 'node:crypto';

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

// Fragments that indicate an internal failure (driver, filesystem, runtime or
// stack-trace text) rather than a message written for the person using the app.
const INTERNAL_ERROR = /\b(?:SQLITE_[A-Z_]+|ER_[A-Z_]+|SQLSTATE|E(?:ACCES|NOENT|PERM|CONN[A-Z]*|TIMEDOUT|PIPE|ADDRINUSE|NOTFOUND))\b|constraint failed|syntax error|\bat\s.+:\d+:\d+|node:internal|node_modules|\/(?:home|app|usr|var|mnt|tmp|root|etc)\/|\b(?:TypeError|ReferenceError|SyntaxError|RangeError)\b|cannot read propert|is not a function|is not defined|\[object |\bundefined\b/i;

// Returns the error's own message when it reads like text written for the person
// using the app, and a generic message for anything that looks internal.
export function publicErrorMessage(error, fallback = GENERIC_ERROR_MESSAGE) {
  const message = String(error?.message ?? '').trim();
  if (!message || message.length > 300 || /[\r\n]/.test(message) || INTERNAL_ERROR.test(message)) return fallback;
  return message;
}

// A short code that is shown to the person and written to the log together with
// the real error, so an administrator can match a report to the log entry.
export function errorReference() {
  return randomBytes(4).toString('hex');
}
