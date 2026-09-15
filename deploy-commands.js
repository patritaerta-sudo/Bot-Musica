require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('corregir')
    .setDescription('Corrige la última canción que el bot identificó mal para tu mensaje')
    .addStringOption(option =>
      option.setName('busqueda')
        .setDescription('Nombre correcto de la canción (ej: "Bad Bunny - Monaco")')
        .setRequired(true))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Registrando comando /corregir...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log('¡Comando registrado con éxito!');
  } catch (error) {
    console.error(error);
  }
})();
