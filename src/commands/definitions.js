import { SlashCommandBuilder } from 'discord.js';

export const commandBuilders = [
  new SlashCommandBuilder().setName('housing').setDescription('Open the AddressBook home menu')
];
export const commandJson = commandBuilders.map(c=>c.toJSON());
