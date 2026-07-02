// src/lib/whisperCard.js

const CARD_W = 900;
const PAD = 60;
const RADIUS = 32;
const MIN_H = 500;
const MAX_LINES = 12;

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function generateWhisperCard(message, username) {
  // Wait for fonts to load
  await document.fonts.ready;

  // Measure text
  const tmp = document.createElement('canvas');
  tmp.width = CARD_W;
  tmp.height = MIN_H;
  const tmpCtx = tmp.getContext('2d');

  const msgFontSize = 36;
  tmpCtx.font = `italic 500 ${msgFontSize}px Inter, system-ui, sans-serif`;
  const maxTextW = CARD_W - PAD * 2;
  let lines = wrapText(tmpCtx, `"${message}"`, maxTextW);

  if (lines.length > MAX_LINES) {
    lines = lines.slice(0, MAX_LINES);
    lines[MAX_LINES - 1] = lines[MAX_LINES - 1].replace(/.{3}$/, '…');
  }

  const lineH = msgFontSize * 1.65;
  const labelH = 48;
  const brandH = 40;
  const totalH = Math.max(MIN_H, PAD + labelH + 20 + lines.length * lineH + 40 + brandH + PAD);

  // Final canvas
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = Math.ceil(totalH);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, CARD_W, totalH);
  grad.addColorStop(0, '#1a1030');
  grad.addColorStop(0.5, '#2d1a4a');
  grad.addColorStop(1, '#1a1030');
  roundRect(ctx, 0, 0, CARD_W, totalH, RADIUS);
  ctx.fillStyle = grad;
  ctx.fill();

  // Inner glow border
  roundRect(ctx, 2, 2, CARD_W - 4, totalH - 4, RADIUS - 2);
  ctx.strokeStyle = 'rgba(139,92,246,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Decorative orb
  const orbGrad = ctx.createRadialGradient(CARD_W - 80, 80, 10, CARD_W - 80, 80, 200);
  orbGrad.addColorStop(0, 'rgba(139,92,246,0.25)');
  orbGrad.addColorStop(1, 'rgba(139,92,246,0)');
  ctx.fillStyle = orbGrad;
  ctx.fillRect(0, 0, CARD_W, totalH);

  let y = PAD;

  // Label
  ctx.fillStyle = '#a78bfa';
  ctx.font = `700 22px Inter, system-ui, sans-serif`;
  ctx.fillText('💬  WHISPER ON CIRCLE', PAD, y + 28);
  y += labelH + 16;

  // Divider
  ctx.strokeStyle = 'rgba(167,139,250,0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(CARD_W - PAD, y);
  ctx.stroke();
  y += 28;

  // Message
  ctx.fillStyle = '#e2d9f3';
  ctx.font = `italic 500 ${msgFontSize}px Inter, system-ui, sans-serif`;
  for (const line of lines) {
    ctx.fillText(line, PAD, y);
    y += lineH;
  }

  // Bottom brand
  const bottomY = totalH - PAD - 6;
  ctx.fillStyle = 'rgba(167,139,250,0.5)';
  ctx.font = `500 20px Inter, system-ui, sans-serif`;
  ctx.fillText('www.circlenet.social', PAD, bottomY);

  if (username) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(244, 243, 248, 0.5)';
    ctx.fillText(`@${username}`, CARD_W - PAD, bottomY);
    ctx.textAlign = 'left';
  }

  return canvas;
}