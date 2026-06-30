// src/lib/postCardGenerator.js

const CARD_W = 900;
const PAD = 48;
const RADIUS = 24;
const MIN_H = 400;
const MAX_TEXT_LINES = 16;

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
  return lines.slice(0, MAX_TEXT_LINES);
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

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return reject(new Error('No image source'));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export async function generatePostCard(post, username) {
  // Wait for fonts
  await document.fonts.ready;

  const {
    text,
    image,
    createdAt,
    user,
    author,
    authorPicture,
    authorUsername,
  } = post;

  const displayName = user?.name || author || 'Anonymous';
  const displayUsername = user?.username || authorUsername || username || '';
  const avatarUrl = resolveMediaUrl(user?.picture || authorPicture || null);
  const postImageUrl = resolveMediaUrl(image);

  // ── Measure text ──
  const tmp = document.createElement('canvas');
  tmp.width = CARD_W;
  tmp.height = MIN_H;
  const tmpCtx = tmp.getContext('2d');

  const msgFontSize = 28;
  tmpCtx.font = `400 ${msgFontSize}px Inter, system-ui, sans-serif`;
  const maxTextW = CARD_W - PAD * 2;
  let lines = wrapText(tmpCtx, text || '', maxTextW);

  // ── Image dimensions ──
  const hasImage = !!postImageUrl;
  const imageHeight = hasImage ? 200 : 0;
  const imagePadding = hasImage ? 20 : 0;

  // ── Calculate canvas height ──
  const avatarSize = 48;
  const headerH = avatarSize + 20;
  const lineH = msgFontSize * 1.6;
  const textH = Math.min(lines.length, MAX_TEXT_LINES) * lineH;
  const footerH = 40;
  const totalH = Math.max(
    MIN_H,
    PAD + headerH + 16 + textH + (hasImage ? imageHeight + imagePadding : 0) + 20 + footerH + PAD
  );

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = Math.ceil(totalH);
  const ctx = canvas.getContext('2d');

  // ── Background ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, totalH);
  bgGrad.addColorStop(0, '#1a1a2e');
  bgGrad.addColorStop(1, '#0d0d1a');
  roundRect(ctx, 0, 0, CARD_W, totalH, RADIUS);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Border glow
  roundRect(ctx, 2, 2, CARD_W - 4, totalH - 4, RADIUS - 2);
  ctx.strokeStyle = 'rgba(124, 107, 255, 0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Accent line
  const accentGrad = ctx.createLinearGradient(PAD, 0, CARD_W - PAD, 0);
  accentGrad.addColorStop(0, 'rgba(124,107,255,0)');
  accentGrad.addColorStop(0.3, '#7c6bff');
  accentGrad.addColorStop(0.7, '#7c6bff');
  accentGrad.addColorStop(1, 'rgba(124,107,255,0)');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(PAD, 0, CARD_W - PAD * 2, 3);

  let y = PAD;

  // ── Header: avatar + name ──
  // Avatar
  const avX = PAD;
  const avY = y;
  const avR = avatarSize / 2;
  ctx.beginPath();
  ctx.arc(avX + avR, avY + avR, avR, 0, Math.PI * 2);

  let avatarLoaded = false;
  if (avatarUrl) {
    try {
      const img = await loadImage(avatarUrl);
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, avX, avY, avatarSize, avatarSize);
      ctx.restore();
      avatarLoaded = true;
    } catch (_) {
      // Fall back to colour background
    }
  }

  if (!avatarLoaded) {
    ctx.fillStyle = '#7c6bff';
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `600 18px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((displayName.charAt(0) || '?').toUpperCase(), avX + avR, avY + avR);
  }

  // Name + username
  const nameX = avX + avatarSize + 14;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.font = `700 16px Inter, system-ui, sans-serif`;
  ctx.fillText(displayName, nameX, y);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `400 13px Inter, system-ui, sans-serif`;
  ctx.fillText(`@${displayUsername}`, nameX, y + 22);

  // Timestamp
  const ts = createdAt ? new Date(createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) : '';
  if (ts) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `400 12px Inter, system-ui, sans-serif`;
    ctx.fillText(ts, CARD_W - PAD, y);
    ctx.textAlign = 'left';
  }

  y += headerH + 16;

  // ── Post text ──
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#e8e4f0';
  ctx.font = `400 ${msgFontSize}px Inter, system-ui, sans-serif`;
  for (const line of lines) {
    ctx.fillText(line, PAD, y);
    y += lineH;
  }

  // ── Image (if any) ──
  if (hasImage && postImageUrl) {
    try {
      const img = await loadImage(postImageUrl);
      const maxW = CARD_W - PAD * 2;
      const ratio = img.width / img.height;
      let w = maxW;
      let h = maxW / ratio;
      if (h > imageHeight) {
        h = imageHeight;
        w = h * ratio;
      }
      const imgX = PAD + (maxW - w) / 2;
      const imgY = y + 8;
      roundRect(ctx, imgX, imgY, w, h, 8);
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, imgX, imgY, w, h);
      ctx.restore();
      y += imageHeight + 20;
    } catch (_) {
      // Image failed to load – skip it
    }
  }

  // ── Footer ──
  const footerY = totalH - PAD - 16;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(124,107,255,0.3)';
  ctx.font = `400 16px Inter, system-ui, sans-serif`;
  ctx.fillText('💬 Circlenet', PAD, footerY);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = `400 12px Inter, system-ui, sans-serif`;
  ctx.fillText('circlenet.social', CARD_W - PAD, footerY);

  return canvas;
}