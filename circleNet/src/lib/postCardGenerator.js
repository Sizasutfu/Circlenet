// src/lib/postCardGenerator.js

const CARD_W = 540; // Further reduced for mobile-friendly size
const PAD = 24; // Minimal padding
const RADIUS = 16;
const MIN_H = 280;
const MAX_TEXT_LINES = 12;

function wrapText(ctx, text, maxWidth) {
  // Split by newlines first to preserve intentional line breaks
  const paragraphs = text.split('\n');
  const allLines = [];
  
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      allLines.push(''); // Preserve empty lines
      continue;
    }
    
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        allLines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) allLines.push(line);
  }
  
  return allLines.slice(0, MAX_TEXT_LINES);
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

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export async function generatePostCard(post, username) {
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

  // ── Measure text with proper line breaks ──
  const tmp = document.createElement('canvas');
  tmp.width = CARD_W;
  tmp.height = MIN_H;
  const tmpCtx = tmp.getContext('2d');

  const msgFontSize = 15; // Smaller font
  tmpCtx.font = `400 ${msgFontSize}px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`;
  const maxTextW = CARD_W - PAD * 2;
  let lines = wrapText(tmpCtx, text || '', maxTextW);

  // ── Image dimensions ──
  const hasImage = !!postImageUrl;
  const imageMaxHeight = 180;
  const imagePadding = 10;

  // ── Calculate canvas height ──
  const avatarSize = 30;
  const headerH = avatarSize + 14;
  const lineH = msgFontSize * 1.5;
  const textH = Math.min(lines.length, MAX_TEXT_LINES) * lineH;
  const footerH = 28;
  const totalH = Math.max(
    MIN_H,
    PAD + headerH + 10 + textH + (hasImage ? imageMaxHeight + imagePadding : 0) + 14 + footerH + PAD
  );

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = Math.ceil(totalH);
  const ctx = canvas.getContext('2d');

  // ── Background with subtle light gradient ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, totalH);
  bgGrad.addColorStop(0, '#f8f7fc');
  bgGrad.addColorStop(0.5, '#ffffff');
  bgGrad.addColorStop(1, '#f8f7fc');
  
  roundRect(ctx, 0, 0, CARD_W, totalH, RADIUS);
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // ── Border glow ──
  roundRect(ctx, 1, 1, CARD_W - 2, totalH - 2, RADIUS - 2);
  ctx.shadowColor = 'rgba(124, 107, 255, 0.06)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(124, 107, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // ── Top accent bar ──
  const accentGrad = ctx.createLinearGradient(PAD, 0, CARD_W - PAD, 0);
  accentGrad.addColorStop(0, 'rgba(124,107,255,0)');
  accentGrad.addColorStop(0.2, 'rgba(124,107,255,0.4)');
  accentGrad.addColorStop(0.5, '#7c6bff');
  accentGrad.addColorStop(0.8, 'rgba(124,107,255,0.4)');
  accentGrad.addColorStop(1, 'rgba(124,107,255,0)');
  ctx.fillStyle = accentGrad;
  ctx.fillRect(PAD, 0, CARD_W - PAD * 2, 2);

  let y = PAD;

  // ── Header: Avatar + Name + Follow Button ──
  const avX = PAD;
  const avY = y;
  const avR = avatarSize / 2;
  
  // Avatar shadow
  ctx.shadowColor = 'rgba(124, 107, 255, 0.12)';
  ctx.shadowBlur = 8;
  
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

  ctx.shadowBlur = 0;

  if (!avatarLoaded) {
    const colorGrad = ctx.createRadialGradient(avX + avR, avY + avR, 0, avX + avR, avY + avR, avR);
    colorGrad.addColorStop(0, '#8b7aff');
    colorGrad.addColorStop(1, '#5c4bd6');
    ctx.fillStyle = colorGrad;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((displayName.charAt(0) || '?').toUpperCase(), avX + avR, avY + avR + 1);
  }

  // Name + Username
  const nameX = avX + avatarSize + 10;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  ctx.fillStyle = '#1a1a2e';
  ctx.font = '600 11px Inter, -apple-system, sans-serif';
  ctx.fillText(displayName, nameX, y);
  
  ctx.fillStyle = 'rgba(26, 26, 46, 0.5)';
  ctx.font = '400 9px Inter, -apple-system, sans-serif';
  ctx.fillText(`@${displayUsername}`, nameX, y + 15);

  // ── Timestamp and Follow Button (inline) ──
  const btnW = 56;
  const btnH = 22;
  const btnX = CARD_W - PAD - btnW;
  const btnY = y + (avatarSize - btnH) / 2;
  
  // Timestamp - positioned to the left of the follow button
  const ts = createdAt ? formatDate(createdAt) : '';
  if (ts) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(26, 26, 46, 0.35)';
    ctx.font = '400 9px Inter, -apple-system, sans-serif';
    ctx.fillText(ts, btnX - 8, btnY + btnH / 2);
    ctx.textAlign = 'left';
  }
  
  // Follow Button
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
  btnGrad.addColorStop(0, '#7c6bff');
  btnGrad.addColorStop(1, '#5c4bd6');
  
  roundRect(ctx, btnX, btnY, btnW, btnH, 12);
  ctx.shadowColor = 'rgba(124, 107, 255, 0.25)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = btnGrad;
  ctx.fill();
  ctx.shadowBlur = 0;
  
  // Button border glow
  roundRect(ctx, btnX, btnY, btnW, btnH, 12);
  ctx.strokeStyle = 'rgba(124, 107, 255, 0.2)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  
  // Button text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 9px Inter, -apple-system, sans-serif';
  ctx.fillText('Follow', btnX + btnW / 2, btnY + btnH / 2 + 0.5);

  y += headerH + 10;

  // ── Post text with preserved line breaks ──
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#1a1a2e';
  ctx.font = `400 ${msgFontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.letterSpacing = '-0.01em';
  ctx.lineHeight = 1.5;
  
  for (const line of lines) {
    if (line === '') {
      // Empty line - add some spacing
      y += lineH * 0.4;
    } else {
      ctx.fillText(line, PAD, y);
      y += lineH;
    }
  }

  // ── Image (if any) ──
  if (hasImage && postImageUrl) {
    try {
      const img = await loadImage(postImageUrl);
      const maxW = CARD_W - PAD * 2;
      const ratio = img.width / img.height;
      let w = maxW;
      let h = maxW / ratio;
      
      if (h > imageMaxHeight) {
        h = imageMaxHeight;
        w = h * ratio;
      }
      
      const imgX = PAD + (maxW - w) / 2;
      const imgY = y + 4;
      
      // Image shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.06)';
      ctx.shadowBlur = 10;
      
      roundRect(ctx, imgX, imgY, w, h, 6);
      ctx.save();
      ctx.clip();
      ctx.drawImage(img, imgX, imgY, w, h);
      ctx.restore();
      
      ctx.shadowBlur = 0;
      
      // Subtle image border
      roundRect(ctx, imgX, imgY, w, h, 6);
      ctx.strokeStyle = 'rgba(0,0,0,0.04)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
      
      y += h + imagePadding;
    } catch (_) {
      // Image failed to load – skip it
      y += 10;
    }
  }

  // ── Divider ──
  const dividerY = totalH - PAD - footerH - 6;
  const dividerGrad = ctx.createLinearGradient(PAD, 0, CARD_W - PAD, 0);
  dividerGrad.addColorStop(0, 'rgba(124,107,255,0)');
  dividerGrad.addColorStop(0.5, 'rgba(124,107,255,0.1)');
  dividerGrad.addColorStop(1, 'rgba(124,107,255,0)');
  ctx.fillStyle = dividerGrad;
  ctx.fillRect(PAD, dividerY, CARD_W - PAD * 2, 0.5);

  // ── Footer ──
  const footerY = totalH - PAD - 10;
  
  // Left: Brand
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  
  // Logo icon
  ctx.font = '400 10px Inter, -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(124, 107, 255, 0.35)';
  ctx.fillText('◆', PAD, footerY);
  
  ctx.fillStyle = 'rgba(26, 26, 46, 0.35)';
  ctx.font = '500 8.5px Inter, -apple-system, sans-serif';
  ctx.fillText('Circlenet', PAD + 14, footerY);

  // Right: URL
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(26, 26, 46, 0.2)';
  ctx.font = '400 8.5px Inter, -apple-system, sans-serif';
  ctx.fillText('circlenet.social', CARD_W - PAD, footerY);

  // ── Subtle watermark ──
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(124,107,255,0.015)';
  ctx.font = '700 50px Inter, sans-serif';
  ctx.fillText('◆', CARD_W / 2, totalH / 2);

  return canvas;
}