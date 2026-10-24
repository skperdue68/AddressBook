import { SlashCommandBuilder } from 'discord.js';

export const commandBuilders = [
  new SlashCommandBuilder().setName('hearth').setDescription('Open HearthBound: discover houses and housing tours'),
  new SlashCommandBuilder().setName('housing').setDescription('Open HearthBound (compatibility alias for /hearth)')
];
export const commandJson = commandBuilders.map(c=>c.toJSON());
