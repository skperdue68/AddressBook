const MODES = new Set(['both', 'discord', 'web']);

/**
 * Select where Housing Administration is exposed. Invalid or missing values
 * deliberately preserve the backwards-compatible Discord + web behavior.
 */
export function adminInterfaceMode(env = process.env) {
  const value = String(env.ADMIN_INTERFACE || 'both').trim().toLowerCase();
  return MODES.has(value) ? value : 'both';
}

export function discordAdministrationEnabled(mode = adminInterfaceMode()) {
  return mode !== 'web';
}

export function webAdministrationEnabled(mode = adminInterfaceMode()) {
  return mode !== 'discord';
}
