# Bot de canciones para Discord

Cada vez que alguien postea una canción (link de Spotify, link de YouTube, o solo el nombre tipo "Artista - Canción") en el canal configurado, el bot responde con una ficha: portada, título, artista y un botón para escucharla en Spotify. Si se equivoca, cualquiera puede corregir la ficha con `/corregir`.

## 1. Crear la app de Discord
1. Andá a https://discord.com/developers/applications → **New Application**.
2. En **Bot**, creá el bot y copiá el **Token** (va en `DISCORD_TOKEN`).
3. Activá el intent **Message Content Intent** (Bot → Privileged Gateway Intents).
4. En **OAuth2 → URL Generator**, marcá scopes `bot` y `applications.commands`, y permisos: Ver canal, Enviar mensajes, Insertar enlaces, Usar comandos de aplicación. Con esa URL invitá el bot a tu server.
5. Copiá el **Client ID** (General Information) → `DISCORD_CLIENT_ID`.
6. Con el modo desarrollador activado en Discord, clic derecho a tu servidor → Copiar ID → `DISCORD_GUILD_ID`. Clic derecho al canal de canciones → Copiar ID → `SONG_CHANNEL_ID`.

## 2. Crear la app de Spotify
1. Andá a https://developer.spotify.com/dashboard → **Create app** (no hace falta URL de redirect válida para esto, poné cualquiera, ej. `http://localhost:3000`).
2. Copiá **Client ID** y **Client Secret** → `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`.

## 3. Instalar y configurar
```bash
npm install
cp .env.example .env
# completá el .env con tus tokens/IDs
```

## 4. Registrar el comando /corregir
```bash
npm run deploy-commands
```

## 5. Correr el bot
```bash
npm start
```

## Cómo funciona
- El bot escucha **solo** el canal definido en `SONG_CHANNEL_ID`.
- Si el mensaje trae un link de Spotify, busca esa canción exacta.
- Si no, busca por texto en Spotify (funciona con links de YouTube igual, porque limpia la URL y busca por el nombre del mensaje, aunque es más preciso si escribís "Artista - Canción").
- Guarda en memoria cuál fue la última ficha publicada por cada persona.
- `/corregir busqueda:<nombre correcto>` edita esa última ficha con la búsqueda correcta.

## Notas / posibles mejoras
- La memoria de "última canción por usuario" se pierde si reiniciás el bot. Si querés que sobreviva reinicios, se puede guardar en un archivo JSON o una base de datos chica (ej. SQLite).
- Si preferís usar YouTube como fuente en vez de Spotify (por ejemplo si la comunidad comparte más de YouTube), se puede adaptar usando la YouTube Data API de forma muy parecida.
- Se puede alojar 24/7 en un VPS barato, Railway, o Render (plan gratuito con limitaciones de "sleep").
