// utils/userAgentParser.js
function parseUserAgent(userAgent) {
  if (!userAgent) return null;

  let browser = 'Unknown';
  let os = 'Unknown';
  let device = '';

  // Browser detection
  if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg')) browser = 'Edge';
  else if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('OPR') || userAgent.includes('Opera')) browser = 'Opera';

  // OS detection
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  // Device type
  if (/(Mobile|Android|iPhone|iPad|iPod)/i.test(userAgent)) device = 'Mobile';
  else device = 'Desktop';

  return `${browser} on ${os} (${device})`;
}

module.exports = parseUserAgent;