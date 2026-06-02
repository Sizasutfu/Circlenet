// utils/userAgentParser.js

function parseUserAgent(userAgent) {
  if (!userAgent) return null;

  const ua = userAgent;
  let browser = 'Unknown';
  let browserVersion = null;
  let os = 'Unknown';
  let osVersion = null;
  let device = 'Desktop';
  let brand = 'Unknown';
  let model = null;

  // ----- Browser detection (order matters!) -----
  if (ua.includes('Edg/')) {
    browser = 'Edge';
    browserVersion = extractVersion(ua, 'Edg/');
  }
  else if (ua.includes('Edge/')) {
    browser = 'Edge (Legacy)';
    browserVersion = extractVersion(ua, 'Edge/');
  }
  else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    browser = 'Opera';
    browserVersion = extractVersion(ua, ua.includes('OPR/') ? 'OPR/' : 'Opera/');
  }
  else if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    browserVersion = extractVersion(ua, 'Firefox/');
  }
  else if (ua.includes('Chrome/') && !ua.includes('Edg/') && !ua.includes('OPR/')) {
    browser = 'Chrome';
    browserVersion = extractVersion(ua, 'Chrome/');
  }
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    browser = 'Safari';
    browserVersion = extractVersion(ua, 'Version/');
  }

  // ----- OS detection -----
  if (ua.includes('Windows NT')) {
    os = 'Windows';
    const match = ua.match(/Windows NT (\d+\.\d+)/);
    if (match) osVersion = mapWindowsVersion(match[1]);
  }
  else if (ua.includes('Mac OS X') || ua.includes('Mac OS') || (ua.includes('Macintosh') && ua.includes('Mac OS'))) {
    os = 'macOS';
    const match = ua.match(/Mac OS X (\d+[._]\d+)/);
    if (match) osVersion = match[1].replace(/_/g, '.');
  }
  else if (ua.includes('Android')) {
    os = 'Android';
    const match = ua.match(/Android (\d+(?:\.\d+)?)/);
    if (match) osVersion = match[1];
  }
  else if (ua.includes('iOS') || ua.includes('iPhone OS') || ua.includes('iPad OS')) {
    os = 'iOS';
    const match = ua.match(/(?:iPhone OS|iOS|iPad OS) (\d+[._]\d+)/);
    if (match) osVersion = match[1].replace(/_/g, '.');
  }
  else if (ua.includes('Linux')) {
    os = 'Linux';
  }

  // ----- Device type (Mobile / Tablet / Desktop) -----
  if (/Mobile|Android.+Mobile|iPhone|iPod|BlackBerry|BB10|IEMobile|Opera Mini/i.test(ua)) {
    device = 'Mobile';
  } else if (/iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i.test(ua)) {
    device = 'Tablet';
  } else {
    device = 'Desktop';
  }

  // Override: iPad with desktop UA (heuristic)
  if (device === 'Desktop' && os === 'macOS' && (ua.includes('Safari') && !ua.includes('Chrome')) && /Macintosh/.test(ua) && /Touch/.test(ua)) {
    device = 'Tablet';
    os = 'iOS';
  }

  // ----- Device brand & model extraction -----
  if (os === 'iOS') {
    // Apple devices
    brand = 'Apple';
    if (ua.includes('iPhone')) model = 'iPhone';
    else if (ua.includes('iPad')) model = 'iPad';
    else if (ua.includes('iPod')) model = 'iPod touch';
  }
  else if (os === 'Android') {
    // Try to extract brand from "Build/" or manufacturer tokens
    // Many Android UAs include something like "SM-G973F" or "Pixel 6" or "Redmi Note 9"
    const brandPatterns = [
      // Samsung
      { brand: 'Samsung', pattern: /Samsung|SM-[A-Za-z0-9]+|GT-[A-Za-z0-9]+/i },
      // Google Pixel / Nexus
      { brand: 'Google', pattern: /Pixel\s?\d+|Nexus\s?\d+|Pixel\s?[a-zA-Z]?/i },
      // Xiaomi (Redmi, Mi, POCO)
      { brand: 'Xiaomi', pattern: /Xiaomi|Redmi|Mi\s?\d+|POCO|M[0-9]{3,}[A-Z]?/i },
      // Huawei
      { brand: 'Huawei', pattern: /Huawei|Honor|HLK-|CLT-|ELE-|VOG-|LYA-/i },
      // OnePlus
      { brand: 'OnePlus', pattern: /OnePlus|ONEPLUS|KB200[0-9]|LE[0-9]{4}/i },
      // Oppo / Realme
      { brand: 'Oppo', pattern: /Oppo|CPH[0-9]{4}|RMX[0-9]{4}/i },
      // Vivo
      { brand: 'Vivo', pattern: /Vivo|vivo|V[0-9]{4}[A-Z]?/i },
      // Nokia
      { brand: 'Nokia', pattern: /Nokia|TA-[0-9]{4}/i },
      // LG
      { brand: 'LG', pattern: /LG(?:-)?[A-Za-z0-9]+/i },
      // Sony
      { brand: 'Sony', pattern: /Sony|Xperia/i },
      // Motorola
      { brand: 'Motorola', pattern: /Moto|Motorola|XT[0-9]{4}/i }
    ];

    for (const bp of brandPatterns) {
      const match = ua.match(bp.pattern);
      if (match) {
        brand = bp.brand;
        // Extract model – take the matched substring if it looks like a model
        const matchedStr = match[0];
        if (matchedStr && !/Samsung|Xiaomi|Google|Huawei|OnePlus|Oppo|Vivo|Nokia|LG|Sony|Motorola/i.test(matchedStr)) {
          model = matchedStr;
        } else {
          // If only brand matched, try to find a model pattern
          const modelMatch = ua.match(/(?:Build\/|Android; )([^;)]+)/);
          if (modelMatch) model = modelMatch[1].trim();
        }
        break;
      }
    }

    // If still no model, try to extract from "Build/" or the part after Android version
    if (!model) {
      const buildMatch = ua.match(/Build\/([^;)]+)/);
      if (buildMatch) model = buildMatch[1];
    }
  }
  else {
    // Desktop or other – can't reliably get brand
    brand = 'Generic';
    model = null;
  }

  return { browser, browserVersion, os, osVersion, device, brand, model };
}

// Helper: extract version number after a given token
function extractVersion(ua, token) {
  const start = ua.indexOf(token);
  if (start === -1) return null;
  const versionChunk = ua.substring(start + token.length);
  const match = versionChunk.match(/^(\d+(?:\.\d+)?(?:\.\d+)?)/);
  return match ? match[1] : null;
}

// Helper: map Windows NT version to human-readable name
function mapWindowsVersion(ntVersion) {
  const map = {
    '10.0': '10',
    '6.3': '8.1',
    '6.2': '8',
    '6.1': '7',
    '6.0': 'Vista',
    '5.2': 'XP x64',
    '5.1': 'XP',
    '5.0': '2000'
  };
  return map[ntVersion] || ntVersion;
}

module.exports = parseUserAgent;