// src/lib/e2e.js
const STORE_KEY = "circle_e2e_keypair";
let _myKeyPair = null;
let _sharedKeys = {};

// ── Base64 helpers (same as old code) ──
function _b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function _unb64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ── Generate or load this device's ECDH key-pair ──
export async function ensureMyKeys() {
  if (_myKeyPair) return _myKeyPair;
  const stored = localStorage.getItem(STORE_KEY);
  if (stored) {
    try {
      const { pub, priv } = JSON.parse(stored);
      const publicKey = await crypto.subtle.importKey(
        "spki",
        _unb64(pub),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        []
      );
      const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        _unb64(priv),
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveKey"]
      );
      _myKeyPair = { publicKey, privateKey };
      return _myKeyPair;
    } catch (_) {
      // corrupted – regenerate
    }
  }
  _myKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );
  const pub = _b64(
    await crypto.subtle.exportKey("spki", _myKeyPair.publicKey)
  );
  const priv = _b64(
    await crypto.subtle.exportKey("pkcs8", _myKeyPair.privateKey)
  );
  localStorage.setItem(STORE_KEY, JSON.stringify({ pub, priv }));
  return _myKeyPair;
}

// ── Publish public key to server ──
export async function publishMyPublicKey(userId, apiClient) {
  try {
    const kp = await ensureMyKeys();
    const pub = _b64(await crypto.subtle.exportKey("spki", kp.publicKey));
    await apiClient(`/api/users/${userId}/publickey`, {
      method: "PUT",
      body: { publicKey: pub },
    });
  } catch (_) {
    // silently ignore server errors
  }
}

// ── Fetch peer public key ──
async function _fetchPeerKey(userId, apiClient) {
  try {
    const res = await apiClient(`/api/users/${userId}/publickey`);
    const b64 = res.data?.publicKey || res.publicKey;
    if (!b64) return null;
    return await crypto.subtle.importKey(
      "spki",
      _unb64(b64),
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );
  } catch (_) {
    return null;
  }
}

// ── Derive (or return cached) shared AES-GCM key ──
async function _sharedKey(peerUserId, apiClient) {
  if (_sharedKeys[peerUserId]) return _sharedKeys[peerUserId];
  const kp = await ensureMyKeys();
  const peerPub = await _fetchPeerKey(peerUserId, apiClient);
  if (!peerPub) return null;
  const key = await crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPub },
    kp.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  _sharedKeys[peerUserId] = key;
  return key;
}

// ── Encrypt plaintext → "e2e:<b64(iv+ct)>" ──
export async function encrypt(peerUserId, plaintext, apiClient) {
  const key = await _sharedKey(peerUserId, apiClient);
  if (!key) return plaintext; // fallback to plaintext
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const blob = new Uint8Array(12 + ct.byteLength);
  blob.set(iv, 0);
  blob.set(new Uint8Array(ct), 12);
  return "e2e:" + _b64(blob.buffer);
}

// ── Decrypt "e2e:…" → plaintext ──
export async function decrypt(peerUserId, body, apiClient) {
  if (!body || !body.startsWith("e2e:")) return body;
  try {
    const key = await _sharedKey(peerUserId, apiClient);
    if (!key) return "[🔒 Encrypted — open conversation to decrypt]";
    const blob = _unb64(body.slice(4));
    const iv = blob.slice(0, 12);
    const ct = blob.slice(12);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch (_) {
    return "[🔒 Encrypted message]";
  }
}

// ── Clear cached shared keys (e.g. on logout) ──
export function clearCache() {
  _sharedKeys = {};
  _myKeyPair = null;
}

// ── Check if E2E is active for a peer ──
export async function isEnabled(peerUserId, apiClient) {
  const key = await _sharedKey(peerUserId, apiClient);
  return !!key;
}