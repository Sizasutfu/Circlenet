// utils/deviceFormatter.js
/**
 * Convert parsed user-agent object into a human-readable string.
 * @param {Object} parsed - Output from parseUserAgent()
 * @returns {string} e.g., "Chrome 120 on Windows 10" or "Mobile Safari on iOS 17.2 (Mobile) · Apple iPhone"
 */
function formatDeviceString(parsed) {
  if (!parsed) return 'Unknown device';

  const parts = [];

  // Browser + version
  let browser = parsed.browser;
  if (parsed.browserVersion && parsed.browserVersion !== 'Unknown') {
    browser += ` ${parsed.browserVersion.split('.')[0]}`; // major version only
  }
  parts.push(browser);

  // OS + version
  let os = parsed.os;
  if (parsed.osVersion && parsed.osVersion !== 'Unknown') {
    os += ` ${parsed.osVersion}`;
  }
  parts.push(os);

  // Device type (if not Desktop, add as extra detail)
  if (parsed.device && parsed.device !== 'Desktop') {
    parts.push(`(${parsed.device})`);
  }

  // Brand + model (if meaningful and not already obvious)
  if (parsed.brand && parsed.brand !== 'Unknown' && parsed.brand !== 'Generic') {
    let deviceModel = parsed.brand;
    if (parsed.model) deviceModel += ` ${parsed.model}`;
    // Avoid duplication (e.g., "Apple iPhone" vs already "iOS")
    if (!parts.some(p => p.includes(deviceModel) || deviceModel.includes(p))) {
      parts.push(deviceModel);
    }
  }

  return parts.join(' · ');
}

module.exports = formatDeviceString;