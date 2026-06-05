// middleware/articlesProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

const articlesProxy = createProxyMiddleware({
  target: 'https://blog.circlenet.social', // Proxy to the Vercel blog host (articles app)
  changeOrigin: true,
  pathRewrite: {
    '^/articles': '/articles',
    '^/_next': '/_next',
  },
  onProxyReq: (proxyReq, req, res) => {
    // mark proxied requests so the blog app can avoid redirecting them
    try {
      proxyReq.setHeader('x-proxied-by', 'circle-backend');
    } catch (e) {}
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers['x-proxied-by'] = 'circle-proxy';
  },
});

module.exports = articlesProxy;