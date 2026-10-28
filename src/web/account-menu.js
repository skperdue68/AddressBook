import {escape} from './render.js';
import {esoServerLabel} from '../utils/eso-server.js';

export function renderAccountMenu(user, context = null, {feedbackInbox=false}={}) {
  const name = user.global_name || user.username || 'Member';
  const initials = name.trim().split(/\s+/u).slice(0, 2).map(part => Array.from(part)[0] || '').join('').toUpperCase() || 'M';
  // Discord supplies an ID and hash, never an arbitrary image URL.
  const avatar = /^\d{1,20}$/.test(String(user.id)) && /^(?:a_)?[a-f0-9]{32}$/.test(String(user.avatar))
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null;
  const roles = (context?.roles || []).map(role => `<span class="account-role">${escape(role.label)}${role.guildId ? ` · ${escape(role.guildName || context.guildName || role.guildId)}` : ''}${role.esoServer ? ` · ${escape(esoServerLabel(role.esoServer))}` : ''}</span>`).join('');
  return `<details class="account-menu"><summary class="account-trigger" aria-label="Account menu for ${escape(name)}"><span class="account-avatar" aria-hidden="true"><span class="avatar-initials">${escape(initials)}</span>${avatar ? `<img src="${avatar}" alt="" width="40" height="40" referrerpolicy="no-referrer">` : ''}</span><span class="account-trigger-name">${escape(name)}</span><span class="account-chevron" aria-hidden="true">⌄</span></summary><div class="account-dropdown"><div class="account-identity"><strong>${escape(name)}</strong>${user.username ? `<span>@${escape(user.username)}</span>` : ''}<small>Signed in with Discord</small></div>${context ? `<div class="account-context"><strong>${escape(context.guildName || context.guildId)}</strong><span>${escape(esoServerLabel(context.esoServer))}</span></div><div class="account-roles" aria-label="Current access">${roles}</div>` : ''}<nav class="account-links" aria-label="Account"><a href="/app/personal">My Address Book</a><a href="/app?choose=1">Change server</a><a href="/app/support">Support &amp; Access</a><a href="/app/request-access">Request access</a>${feedbackInbox?'':'<a href="/app/feedback">Send feedback</a>'}<a href="/app/guide" download>Download guide (Word)</a><a class="account-signout" href="/auth/logout">Sign out</a></nav></div></details>`;
}
