const { createCanvas, loadImage } = require('@napi-rs/canvas');

const WIDTH = 1200;
const HEIGHT = 630;
const COVER_SIZE = 420;
const COVER_MARGIN = 60;
const CORNER_RADIUS = 24;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Escribe texto con salto de línea automático, hasta un máximo de líneas.
// Si se pasa, devuelve la posición Y final (para acomodar el resto del texto debajo).
function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  let lineCount = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const isLastWord = i === words.length - 1;

    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      lineCount++;
      if (lineCount >= maxLines) {
        ctx.fillText(line.trim() + '…', x, curY);
        return curY;
      }
      ctx.fillText(line, x, curY);
      line = words[i] + ' ';
      curY += lineHeight;
    } else {
      line = testLine;
    }

    if (isLastWord) {
      ctx.fillText(line, x, curY);
    }
  }
  return curY;
}

/**
 * Genera una tarjeta (imagen PNG) con la portada del álbum de fondo,
 * la portada en cuadrado a la izquierda, y el título/artista/álbum a la derecha.
 * Devuelve un Buffer con la imagen.
 */
async function generarTarjeta(track) {
  const portadaUrl = track.album.images?.[0]?.url;
  if (!portadaUrl) return null;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  const coverImg = await loadImage(portadaUrl);

  // Fondo: la portada estirada y oscurecida con un degradé.
  ctx.drawImage(coverImg, 0, 0, WIDTH, HEIGHT);
  const overlay = ctx.createLinearGradient(0, 0, WIDTH, 0);
  overlay.addColorStop(0, 'rgba(10,10,12,0.92)');
  overlay.addColorStop(0.55, 'rgba(10,10,12,0.7)');
  overlay.addColorStop(1, 'rgba(10,10,12,0.25)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Portada en cuadrado a la izquierda, con esquinas redondeadas y sombra.
  const coverX = COVER_MARGIN;
  const coverY = (HEIGHT - COVER_SIZE) / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 35;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, coverX, coverY, COVER_SIZE, COVER_SIZE, CORNER_RADIUS);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, coverX, coverY, COVER_SIZE, COVER_SIZE, CORNER_RADIUS);
  ctx.clip();
  ctx.drawImage(coverImg, coverX, coverY, COVER_SIZE, COVER_SIZE);
  ctx.restore();

  // Textos a la derecha de la portada.
  const textX = coverX + COVER_SIZE + 60;
  const maxTextWidth = WIDTH - textX - 60;

  ctx.fillStyle = '#1DB954';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('NUEVA CANCIÓN', textX, coverY + 30);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 54px sans-serif';
  const tituloY = wrapText(ctx, track.name, textX, coverY + 105, maxTextWidth, 62, 2);

  const artistas = track.artists.map(a => a.name).join(', ');
  ctx.fillStyle = '#E4E4E4';
  ctx.font = '32px sans-serif';
  wrapText(ctx, artistas, textX, tituloY + 60, maxTextWidth, 40, 1);

  const duracionMs = track.duration_ms;
  const minutos = Math.floor(duracionMs / 60000);
  const segundos = String(Math.floor((duracionMs % 60000) / 1000)).padStart(2, '0');
  ctx.fillStyle = '#A0A0A0';
  ctx.font = '24px sans-serif';
  ctx.fillText(`${track.album.name} · ${minutos}:${segundos}`, textX, coverY + COVER_SIZE - 10);

  return canvas.toBuffer('image/png');
}

module.exports = { generarTarjeta };
