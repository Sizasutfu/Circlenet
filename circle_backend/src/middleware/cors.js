const ALLOWED_ORIGINS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://localhost:7700',
  'https://sizabeats:5000',
  'https://192.168.163.203:5000',
  'https://10.52.11.203:5000',  
  'http://localhost:5000',
  'https://circle-app-cm8qwkxqp-sizasutfus-projects.vercel.app',
  'https://www.circlenet.social',
  'https://admin.circlenet.social',
  'http://localhost:3000',
  'https://circlenet-articles.vercel.app/articles',
  'https://blog.circlenet.social',

];


function cors(req, res, next) {
  const origin = req.headers.origin;
 

  // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
  if (!origin) {
    return next();
  }

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');

    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    );

    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, X-User-Id, Authorization'
    );

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }

    return next();
  }

  return res.status(403).json({
    error: 'CORS blocked'
  });
}

module.exports = { cors };