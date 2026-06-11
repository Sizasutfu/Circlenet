/* ═══════════════════════════════════════════════════════════════
   WHISPER COMPOSER  —  Card image generation + post creation
   ═══════════════════════════════════════════════════════════════
   Called by whisper-inbox.js:  WhisperComposer.post(msg, replyText)

   Flow:
     1. Draw the anon message onto an HTML Canvas (purple gradient card)
     2. Export canvas → Blob → File
     3. POST to /api/whisper/:id/post via FormData
        (backend creates the post record, marks the whisper as posted)
     4. Inject the new post into the live feed (same as createPost does)

   External globals (main.js / config/api.js):
     - API            — base URL string
     - currentUser    — { id, username, name, ... } | null
     - api(method, path, body?)  — authenticated fetch wrapper
     - showToast(msg)
     - posts          — global feed array
     - PostCache      — { putPost, invalidateFeed }
     - renderFeed()
     - loadTrending(force?)
   ═══════════════════════════════════════════════════════════════ */

const WhisperComposer = (() => {

  /* ── Canvas card dimensions ──────────────────────────────────── */
  const CARD_W   = 900;   // px — high-res for crisp display
  const CARD_H   = 500;   // adjusted dynamically for long messages
  const PAD      = 60;    // inner padding
  const RADIUS   = 32;    // corner radius
  const MIN_H    = 500;
  const MAX_LINES = 12;   // wrap limit before truncating

  /* ── Fonts (loaded once) ─────────────────────────────────────── */
  let _fontsReady = false;
  async function _ensureFonts() {
    if (_fontsReady) return;
    try { await document.fonts.ready; } catch (_) {}
    _fontsReady = true;
  }

  /* ── Helpers ─────────────────────────────────────────────────── */
  function _wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let line    = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
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

  function _roundRect(ctx, x, y, w, h, r) {
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

  /* ── Draw the whisper card onto a canvas ─────────────────────── */
  async function _drawCard(message) {
    await _ensureFonts();

    // Off-screen canvas for text measurement
    const tmp   = document.createElement("canvas");
    tmp.width   = CARD_W;
    tmp.height  = CARD_H;
    const tmpCtx = tmp.getContext("2d");

    // Measure wrapped lines at message font size
    const msgFontSize = 36;
    tmpCtx.font = `italic 500 ${msgFontSize}px Inter, system-ui, sans-serif`;
    const maxTextW = CARD_W - PAD * 2;
    let lines = _wrapText(tmpCtx, `"${message}"`, maxTextW);

    // Truncate & ellipsis if too many lines
    if (lines.length > MAX_LINES) {
      lines = lines.slice(0, MAX_LINES);
      lines[MAX_LINES - 1] =
        lines[MAX_LINES - 1].replace(/.{3}$/, "…");
    }

    const lineH    = msgFontSize * 1.65;
    const labelH   = 48;   // "💬 WHISPER ON CIRCLE" row
    const brandH   = 40;   // bottom brand row
    const totalH   = Math.max(
      MIN_H,
      PAD + labelH + 20 + lines.length * lineH + 40 + brandH + PAD
    );

    // Final canvas
    const canvas   = document.createElement("canvas");
    canvas.width   = CARD_W;
    canvas.height  = Math.ceil(totalH);
    const ctx      = canvas.getContext("2d");

    // ── Background gradient ──────────────────────────────────────
    const grad = ctx.createLinearGradient(0, 0, CARD_W, totalH);
    grad.addColorStop(0,   "#1a1030");
    grad.addColorStop(0.5, "#2d1a4a");
    grad.addColorStop(1,   "#1a1030");
    _roundRect(ctx, 0, 0, CARD_W, totalH, RADIUS);
    ctx.fillStyle = grad;
    ctx.fill();

    // ── Subtle inner glow border ─────────────────────────────────
    _roundRect(ctx, 2, 2, CARD_W - 4, totalH - 4, RADIUS - 2);
    ctx.strokeStyle = "rgba(139,92,246,0.35)";
    ctx.lineWidth   = 2;
    ctx.stroke();

    // ── Decorative top-right orb ─────────────────────────────────
    const orbGrad = ctx.createRadialGradient(
      CARD_W - 80, 80, 10,
      CARD_W - 80, 80, 200
    );
    orbGrad.addColorStop(0,   "rgba(139,92,246,0.25)");
    orbGrad.addColorStop(1,   "rgba(139,92,246,0)");
    ctx.fillStyle = orbGrad;
    ctx.fillRect(0, 0, CARD_W, totalH);

    let y = PAD;

    // ── Label row — chat icon + "WHISPER ON CIRCLE" ──────────────
    ctx.fillStyle = "#a78bfa";
    ctx.font      = `700 22px Inter, system-ui, sans-serif`;
    const labelText = "💬  WHISPER ON CIRCLE";
    ctx.fillText(labelText, PAD, y + 28);
    y += labelH + 16;

    // ── Thin divider ─────────────────────────────────────────────
    ctx.strokeStyle = "rgba(167,139,250,0.2)";
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(CARD_W - PAD, y);
    ctx.stroke();
    y += 28;

    // ── Message text ─────────────────────────────────────────────
    ctx.fillStyle = "#e2d9f3";
    ctx.font      = `italic 500 ${msgFontSize}px Inter, system-ui, sans-serif`;
    for (const line of lines) {
      ctx.fillText(line, PAD, y);
      y += lineH;
    }

    // ── Bottom brand row ─────────────────────────────────────────
    const bottomY = totalH - PAD - 6;
    ctx.fillStyle = "rgba(167,139,250,0.5)";
    ctx.font      = `500 20px Inter, system-ui, sans-serif`;
    ctx.fillText("circlenet.social", PAD, bottomY);

    // Username right-aligned
    if (currentUser?.username) {
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(167,139,250,0.5)";
      ctx.fillText(`@${currentUser.username}`, CARD_W - PAD, bottomY);
      ctx.textAlign = "left";
    }

    return canvas;
  }

  /* ── Canvas → Blob → File ────────────────────────────────────── */
  function _canvasToFile(canvas, filename = "whisper-card.png") {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error("Canvas export failed."));
        resolve(new File([blob], filename, { type: "image/png" }));
      }, "image/png");
    });
  }

  /* ── Public: generate card + create post ────────────────────── */
  async function post(msg, replyText) {
    if (!currentUser) throw new Error("Not authenticated.");
    if (!msg?.message)  throw new Error("Missing whisper message.");
    if (!replyText?.trim()) throw new Error("Reply text is required.");

    // 1. Draw the card
    const canvas = await _drawCard(msg.message);

    // 2. Export to File
    const imageFile = await _canvasToFile(canvas, `whisper-${msg.id}.png`);

    // 3. Build FormData — same shape as createPost()
    const fd = new FormData();
    fd.append("whisper_id", msg.id);     // backend links whisper → post
    fd.append("text", replyText.trim());
    fd.append("image", imageFile);
    fd.append("post_type", "whisper");   // optional tag for feed rendering

    // 4. POST — backend creates the post and marks whisper as posted
    const res     = await api("POST", `/api/whisper/${msg.id}/post`, fd);
    const newPost = res.data;

    // 5. Inject into live feed (same as createPost does)
    if (newPost) {
      if (typeof PostCache !== "undefined") {
        PostCache.putPost(newPost);
        PostCache.invalidateFeed("global");
        PostCache.invalidateFeed("following");
      }
      if (typeof posts !== "undefined") {
        posts.unshift(newPost);
      }
      if (typeof renderFeed === "function") {
        renderFeed();
      }
      if (typeof loadTrending === "function") {
        loadTrending(true);
      }
    }

    return newPost;
  }

  /* ── Public: preview only (returns a data URL, no API call) ─── */
  async function preview(message) {
    const canvas = await _drawCard(message);
    return canvas.toDataURL("image/png");
  }

  return { post, preview };
})();