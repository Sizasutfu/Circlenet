// src/lib/e2e.js
const STORE_KEY = "circle_e2e_keypair";
const KEY_VERSION_KEY = "circle_e2e_key_version";
let _myKeyPair = null;
let _sharedKeys = {}; // Will store { peerUserId: { key, version, timestamp } }

// ── Base64 helpers ──
function _b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function _unb64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ── Generate key fingerprint ──
async function _getKeyFingerprint(keyData) {
  const hash = await crypto.subtle.digest("SHA-256", keyData);
  return _b64(hash).slice(0, 8);
}

// ── Load or generate key pair with version ──
export async function ensureMyKeys() {
  if (_myKeyPair) return _myKeyPair;
  
  const stored = localStorage.getItem(STORE_KEY);
  const storedVersion = localStorage.getItem(KEY_VERSION_KEY);
  
  if (stored && storedVersion) {
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
      _myKeyPair = { publicKey, privateKey, version: parseInt(storedVersion) };
      return _myKeyPair;
    } catch (_) {
      // corrupted – regenerate
    }
  }
  
  // Generate new key pair with version
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
  
  // Get current version from local storage or start at 1
  const currentVersion = parseInt(localStorage.getItem(KEY_VERSION_KEY) || "0");
  const newVersion = currentVersion + 1;
  
  localStorage.setItem(STORE_KEY, JSON.stringify({ pub, priv }));
  localStorage.setItem(KEY_VERSION_KEY, String(newVersion));
  
  _myKeyPair.version = newVersion;
  return _myKeyPair;
}

// ── Publish public key with version ──
export async function publishMyPublicKey(userId, apiClient) {
  try {
    const kp = await ensureMyKeys();
    const pub = _b64(await crypto.subtle.exportKey("spki", kp.publicKey));
    const version = kp.version || parseInt(localStorage.getItem(KEY_VERSION_KEY) || "1");
    
    await apiClient(`/api/dm/e2e/public-key`, {
      method: "PUT",
      body: { 
        publicKey: pub, 
        keyVersion: version,
        timestamp: Date.now()
      },
    });
  } catch (_) {
    // silently ignore server errors
  }
}

// ── Fetch peer public key with version ──
async function _fetchPeerKey(userId, apiClient) {
  try {
    const res = await apiClient(`/api/users/${userId}/publickey`);
    const b64 = res.data?.publicKey || res.publicKey;
    const version = res.data?.keyVersion || res.keyVersion || 1;
    
    if (!b64) return null;
    
    const publicKey = await crypto.subtle.importKey(
      "spki",
      _unb64(b64),
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );
    
    return { publicKey, version };
  } catch (_) {
    return null;
  }
}

// ── Derive shared key with version tracking ──
async function _sharedKey(peerUserId, apiClient, forceRefresh = false) {
  // Check cache
  const cached = _sharedKeys[peerUserId];
  const now = Date.now();
  
  if (!forceRefresh && cached && (now - cached.timestamp) < 3600000) {
    return cached;
  }
  
  const kp = await ensureMyKeys();
  const peerKeyData = await _fetchPeerKey(peerUserId, apiClient);
  if (!peerKeyData) return null;
  
  const { publicKey: peerPub, version: peerVersion } = peerKeyData;
  
  // Check if peer's key version changed
  if (cached && cached.peerVersion !== peerVersion) {
    // Key changed - clear cache and re-derive
    console.log(`Key version changed for ${peerUserId}: ${cached.peerVersion} -> ${peerVersion}`);
    delete _sharedKeys[peerUserId];
  }
  
  // Derive the shared key
  const key = await crypto.subtle.deriveKey(
    { name: "ECDH", public: peerPub },
    kp.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  
  // Store with version info
  _sharedKeys[peerUserId] = {
    key,
    peerVersion,
    myVersion: kp.version || 1,
    timestamp: now
  };
  
  return _sharedKeys[peerUserId];
}

// ── Encrypt with versioning ──
export async function encrypt(peerUserId, plaintext, apiClient) {
  const sharedKeyData = await _sharedKey(peerUserId, apiClient);
  if (!sharedKeyData) return plaintext;
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKeyData.key,
    new TextEncoder().encode(plaintext)
  );
  
  const blob = new Uint8Array(12 + ct.byteLength);
  blob.set(iv, 0);
  blob.set(new Uint8Array(ct), 12);
  
  // Format: e2e:v{peerVersion}:{myVersion}:{data}
  const versionInfo = `v${sharedKeyData.peerVersion}:${sharedKeyData.myVersion}`;
  return `e2e:${versionInfo}:${_b64(blob.buffer)}`;
}

// ── Decrypt with version handling ──
export async function decrypt(peerUserId, body, apiClient) {
  if (!body || !body.startsWith("e2e:")) return body;
  
  try {
    // Parse the version info
    const parts = body.slice(4).split(":");
    let versionInfo = null;
    let encryptedData = body.slice(4);
    
    if (parts.length >= 3 && parts[0].startsWith("v")) {
      // Format: v{peerVersion}:{myVersion}:{data}
      versionInfo = {
        peerVersion: parseInt(parts[0].slice(1)),
        myVersion: parseInt(parts[1])
      };
      encryptedData = parts.slice(2).join(":");
    }
    
    const blob = _unb64(encryptedData);
    const iv = blob.slice(0, 12);
    const ct = blob.slice(12);
    
    // Try to decrypt with current key
    let sharedKeyData = await _sharedKey(peerUserId, apiClient);
    
    // If we have version info and it doesn't match, try to get the correct version
    if (versionInfo && sharedKeyData) {
      const myCurrentVersion = (await ensureMyKeys()).version || 1;
      
      // Check if we need a different version of the peer's key
      if (sharedKeyData.peerVersion !== versionInfo.peerVersion) {
        // Force refresh to get the correct version
        sharedKeyData = await _sharedKey(peerUserId, apiClient, true);
        
        // If still wrong, we might need to fetch a specific version
        if (sharedKeyData.peerVersion !== versionInfo.peerVersion) {
          // Try to fetch the specific version from server
          const peerKeyData = await _fetchPeerKeyVersion(peerUserId, versionInfo.peerVersion, apiClient);
          if (peerKeyData) {
            // Derive key with this specific version
            const kp = await ensureMyKeys();
            const specificKey = await crypto.subtle.deriveKey(
              { name: "ECDH", public: peerKeyData.publicKey },
              kp.privateKey,
              { name: "AES-GCM", length: 256 },
              false,
              ["encrypt", "decrypt"]
            );
            
            sharedKeyData = {
              key: specificKey,
              peerVersion: versionInfo.peerVersion,
              myVersion: myCurrentVersion,
              timestamp: Date.now()
            };
          }
        }
      }
    }
    
    if (!sharedKeyData) return "[🔒 Encrypted — open conversation to decrypt]";
    
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      sharedKeyData.key,
      ct
    );
    return new TextDecoder().decode(pt);
  } catch (error) {
    console.warn("Decryption failed:", error);
    return "[🔒 Encrypted message]";
  }
}

// ── Fetch specific key version from server ──
async function _fetchPeerKeyVersion(userId, version, apiClient) {
  try {
    const res = await apiClient(`/api/users/${userId}/publickey?version=${version}`);
    const b64 = res.data?.publicKey || res.publicKey;
    if (!b64) return null;
    
    const publicKey = await crypto.subtle.importKey(
      "spki",
      _unb64(b64),
      { name: "ECDH", namedCurve: "P-256" },
      true,
      []
    );
    
    return { publicKey, version };
  } catch (_) {
    return null;
  }
}

// ── Rotate user's own key ──
export async function rotateMyKeys(userId, apiClient) {
  // Clear local key to force regeneration
  localStorage.removeItem(STORE_KEY);
  _myKeyPair = null;
  _sharedKeys = {};
  
  // Generate new key with incremented version
  const kp = await ensureMyKeys();
  await publishMyPublicKey(userId, apiClient);
  
  return kp;
}

// ── Clear cache ──
export function clearCache() {
  _sharedKeys = {};
  // Don't clear _myKeyPair
}

// ── Check if E2E is active ──
export async function isEnabled(peerUserId, apiClient) {
  const sharedKeyData = await _sharedKey(peerUserId, apiClient);
  return !!sharedKeyData;
}

// ── Get current public key ──
export async function getMyPublicKey() {
  const kp = await ensureMyKeys();
  const pub = await crypto.subtle.exportKey("spki", kp.publicKey);
  return _b64(pub);
}

// ── Import peer public key ──
export async function importPeerPublicKey(b64Key) {
  return await crypto.subtle.importKey(
    "spki",
    _unb64(b64Key),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    []
  );
}