require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const SpotifyWebApi = require('spotify-web-api-node');

const SONG_CHANNEL_ID = process.env.SONG_CHANNEL_ID;

// --- Cliente de Discord ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Cliente de Spotify (Client Credentials Flow: solo para búsqueda pública) ---
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

async function refreshSpotifyToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body.access_token);
    // el token dura ~1h, lo refrescamos un poco antes
    setTimeout(refreshSpotifyToken, (data.body.expires_in - 60) * 1000);
  } catch (err) {
    console.error('Error obteniendo token de Spotify:', err);
    setTimeout(refreshSpotifyToken, 10_000); // reintenta en 10s
  }
}

// Guarda, por usuario, cuál fue la última ficha que el bot publicó
// (para que /corregir sepa qué mensaje editar)
// Map<userId, { botMessageId, channelId, originalContent }>
const lastSongByUser = new Map();

const SPOTIFY_TRACK_URL_REGEX = /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/;

/**
 * Busca una canción en Spotify a partir de:
 * - un link directo de Spotify (usa el ID exacto), o
 * - texto libre (usa el buscador de Spotify)
 */
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

  // Si no es un link de Spotify (o falló), buscamos por texto.
  // Limpiamos otros links (ej. YouTube) para no ensuciar la búsqueda.
  const queryLimpio = texto.replace(/https?:\/\/\S+/g, '').trim() || texto;

  const result = await spotifyApi.searchTracks(queryLimpio, { limit: 1 });
  const track = result.body.tracks?.items?.[0];
  return track || null;
}

function construirFicha(track, autor) {
  if (!track) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setDescription(
        `No pude identificar esa canción 😕\n` +
        `Si el nombre está mal, usá **/corregir** para arreglarlo.`
      )
      .setFooter({ text: `Publicado por ${autor}` });
    return { embed, row: null };
  }

  const artistas = track.artists.map(a => a.name).join(', ');
  const portada = track.album.images?.[0]?.url;
  const duracionMs = track.duration_ms;
  const minutos = Math.floor(duracionMs / 60000);
  const segundos = String(Math.floor((duracionMs % 60000) / 1000)).padStart(2, '0');

  const embed = new EmbedBuilder()
    .setColor(0x1db954)
    .setAuthor({ name: 'Nueva canción 🎵' })
    .setTitle(track.name)
    .setURL(track.external_urls.spotify)
    .setDescription(`**${artistas}**\n${track.album.name} · ${minutos}:${segundos}`)
    .setThumbnail(portada)
    .setFooter({ text: `Publicado por ${autor}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Escuchar en Spotify')
      .setStyle(ButtonStyle.Link)
      .setURL(track.external_urls.spotify)
  );

  return { embed, row };
}

client.once('ready', () => {
  console.log(`Bot conectado como ${client.user.tag}`);
  refreshSpotifyToken();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== SONG_CHANNEL_ID) return;
  if (!message.content.trim()) return; // ignora mensajes solo con archivos, stickers, etc.

  try {
    const track = await buscarCancion(message.content);
    const { embed, row } = construirFicha(track, message.author.username);

    const botMessage = await message.reply({
      embeds: [embed],
      components: row ? [row] : [],
    });

    lastSongByUser.set(message.author.id, {
      botMessageId: botMessage.id,
      channelId: message.channelId,
      originalContent: message.content,
    });
  } catch (err) {
    console.error('Error procesando mensaje de canción:', err);
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
    const { embed, row } = construirFicha(track, interaction.user.username);

    await botMessage.edit({
      embeds: [embed],
      components: row ? [row] : [],
    });

    // actualizamos la entrada por si quiere corregir de nuevo
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
