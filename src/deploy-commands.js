import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandJson } from './commands/definitions.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = String(process.env.DISCORD_GUILD_ID || '').trim();
const deployGlobal = String(process.env.DEPLOY_GLOBAL || '').toLowerCase() === 'true';
const cleanupGuildIds = String(process.env.DISCORD_CLEANUP_GUILD_IDS || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

if (!token || !clientId) {
  throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID are required.');
}

if (!deployGlobal && !guildId) {
  throw new Error('Set DISCORD_GUILD_ID for guild deployment, or DEPLOY_GLOBAL=true for global commands.');
}

const rest = new REST({ version: '10' }).setToken(token);

if (deployGlobal) {
  const guildsToClear = [...new Set([guildId, ...cleanupGuildIds].filter(Boolean))];

  for (const id of guildsToClear) {
    console.log(`Removing guild-scoped HearthBound commands from guild ${id}...`);
    await rest.put(
      Routes.applicationGuildCommands(clientId, id),
      { body: [] },
    );
  }

  if (guildsToClear.length) {
    console.log(`Removed guild-scoped commands from ${guildsToClear.length} guild(s).`);
  }

  console.log('Registering HearthBound commands globally...');
  const data = await rest.put(
    Routes.applicationCommands(clientId),
    { body: commandJson },
  );

  console.log(`Registered ${data.length} global HearthBound slash command(s).`);
} else {
  console.log('Removing global HearthBound commands...');
  await rest.put(
    Routes.applicationCommands(clientId),
    { body: [] },
  );
  console.log('Global HearthBound commands removed.');

  console.log(`Registering HearthBound commands to guild ${guildId}...`);
  const data = await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commandJson },
  );

  console.log(`Registered ${data.length} guild-scoped HearthBound slash command(s).`);
}
