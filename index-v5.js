require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const SpotifyWebApi = require('spotify-web-api-node');
const { generarTarjeta } = require('./card');

const SONG_CHANNEL_ID = process.env.SONG_CHANNEL_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

async function refreshSpotifyToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body.access_token);
    setTimeout(refreshSpotifyToken, (data.body.expires_in - 60) * 1000);
  } catch (err) {
    console.error('Error obteniendo token de Spotify:', err);
    setTimeout(refreshSpotifyToken, 10_000);
  }
}

const lastSongByUser = new Map();
const SPOTIFY_TRACK_URL_REGEX = /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/;

async function buscarCancion(texto) {
  const linkMatch = texto.match(SPOTIFY_TRACK_URL_REGEX);
  if (linkMatch) {
    try {
      const track = await spotifyApi.getTrack(linkMatch[1]);
      return track.body;
    } catch (err) {
      console.error('No se pudo obtener el track por ID:', err.message);
    }
  }
  const queryLimpio = texto.replace(/https?:\/\/\S+/g, '').trim() || texto;
  const result = await spotifyApi.searchTracks(queryLimpio, { limit: 1 });
  const track = result.body.tracks?.items?.[0];
  return track || null;
}

async function construirFicha(track, autor) {
  if (!track) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(
        `No pude identificar esa canción 😕\n` +
        `Si el nombre está mal, usá **/corregir** para arreglarlo.`
      )
      .setFooter({ text: `Publicado por ${autor}` });
    return { embeds: [embed], files: [], row: null };
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('CODIGO-NUEVO-OK')
      .setStyle(ButtonStyle.Link)
      .setURL(track.external_urls.spotify)
  );

  try {
    console.log('>>> INTENTANDO GENERAR TARJETA <<<');
    const buffer = await generarTarjeta(track);
    if (!buffer) throw new Error('generarTarjeta devolvió null (sin portada disponible)');
    console.log('>>> TARJETA GENERADA OK, tamaño:', buffer.length, '<<<');
    const attachment = new AttachmentBuilder(buffer, { name: 'tarjeta.png' });
    return { embeds: [], files: [attachment], row, imageAttached: true };
  } catch (err) {
    console.error('>>> ERROR GENERANDO TARJETA:', err.message, '<<<');
    const artistas = track.artists.map(a => a.name).join(', ');
    const embed = new EmbedBuilder()
      .setColor(0x1db954)
      .setAuthor({ name: 'Nueva canción 🎵' })
      .setTitle(track.name)
      .setURL(track.external_urls.spotify)
      .setDescription(`**${artistas}**\n${track.album.name}`)
      .setImage(track.album.images?.[0]?.url)
      .setFooter({ text: `[debug] ${err.message}`.slice(0, 200) });
    return { embeds: [embed], files: [], row };
  }
}

client.once('ready', () => {
  console.log(`>>> BOT CONECTADO - CODIGO NUEVO CARGADO - ${new Date().toISOString()} <<<`);
  refreshSpotifyToken();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== SONG_CHANNEL_ID) return;
  if (!message.content.trim()) return;

  console.log('>>> MENSAJE RECIBIDO:', message.content, '<<<');

  try {
    const track = await buscarCancion(message.content);
    const { embeds, files, row } = await construirFicha(track, message.author.username);

    const botMessage = await message.reply({
      embeds,
      files,
      components: row ? [row] : [],
    });

    lastSongByUser.set(message.author.id, {
      botMessageId: botMessage.id,
      channelId: message.channelId,
      originalContent: message.content,
    });
  } catch (err) {
    console.error('>>> ERROR PROCESANDO MENSAJE:', err, '<<<');
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'corregir') return;

  const entry = lastSongByUser.get(interaction.user.id);
  if (!entry) {
    await interaction.reply({
      content: 'No encontré ninguna canción tuya reciente para corregir. Postéala de nuevo en el canal si hace falta.',
      ephemeral: true,
    });
    return;
  }

  const nuevaBusqueda = interaction.options.getString('busqueda');

  try {
    const channel = await client.channels.fetch(entry.channelId);
    const botMessage = await channel.messages.fetch(entry.botMessageId);

    const track = await buscarCancion(nuevaBusqueda);
    const { embeds, files, row } = await construirFicha(track, interaction.user.username);

    await botMessage.edit({
      embeds,
      files,
      components: row ? [row] : [],
    });

    lastSongByUser.set(interaction.user.id, {
      ...entry,
      originalContent: nuevaBusqueda,
    });

    await interaction.reply({
      content: track ? '¡Listo, corregido! ✅' : 'Seguí sin encontrarla, probá con otro nombre.',
      ephemeral: true,
    });
  } catch (err) {
    console.error('Error corrigiendo canción:', err);
    await interaction.reply({
      content: 'Algo salió mal corrigiendo la ficha. Intentá de nuevo.',
      ephemeral: true,
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
