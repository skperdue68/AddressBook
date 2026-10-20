export function stripLeadingAt(value='') {
  return String(value).trim().replace(/^@+/, '');
}
export function normalizeEsoOwner(value='') {
  const raw=String(value).trim();
  if(/^<@!?\d+>$/.test(raw)) {
    throw new Error('ESO owner cannot be a Discord user mention. Enter the ESO account name as plain text, for example evainefaye (without selecting a Discord member).');
  }
  const owner=stripLeadingAt(raw);
  if(!owner) throw new Error('ESO owner account name is required.');
  return owner;
}
export function normalizeText(value='') {
  return value.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
export function normalizeAccount(value='') {
  return normalizeText(value).replace(/\s+/g, '');
}
export function ensureAt(value='') {
  const trimmed = value.trim();
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}
export function buildJumpScript(owner, houseId) {
  return `/script JumpToSpecificHouse("${ensureAt(owner)}", ${Number(houseId)})`;
}

export function jumpCopyContent(owner, houseId) {
  return `**Command / Link**\n**Jump Command**\n\`\`\`text\n${buildJumpScript(owner, houseId)}\n\`\`\`\n**Housing Link**\n\`\`\`text\n${buildHousingLink(owner, houseId)}\n\`\`\`\nCopy either value and paste it into ESO chat.`;
}


export function buildHousePreviewScript(houseId) {
  return `/script RequestJumpToHousePreviewWithTemplate(GetDefaultHouseTemplateIdForHouse(${Number(houseId)}))`;
}

export function buildHousingLink(owner, houseId) {
  return `|H1:housing:${Number(houseId)}:${ensureAt(owner)}|h|h`;
}
export function parseTags(value='') {
  if (Array.isArray(value)) return value;
  return [...new Set(String(value).split(',').map(v=>v.trim().toLowerCase()).filter(Boolean))];
}
