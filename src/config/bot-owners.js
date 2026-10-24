// These IDs grant HearthBound permissions, not Discord roles or permissions.
export function botOwnerIds(env=process.env){
 const values=String(env.BOT_OWNER_IDS||'').split(/[,\s]+/).filter(Boolean);
 if(values.some(id=>! /^[1-9]\d{0,19}$/.test(id)))throw new Error('BOT_OWNER_IDS must contain numeric Discord user IDs separated by commas.');
 return new Set(values);
}
