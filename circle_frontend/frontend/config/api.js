// Dynamically point to the server using whatever host the page loaded from.
// Works on PC (localhost:5000), phone over LAN (192.168.x.x:5000),
// or a real domain — no hardcoded IP needed.

const API = window.location.hostname === 'www.circlenet.social'
  ? 'https://circleappapp-production.up.railway.app'
  : window.location.origin;