// middleware/articlesProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

const articlesProxy = createProxyMiddleware({
  target: 'https://www.circlenet.social', // Proxy to the canonical www host to avoid redirect loops
  changeOrigin: true,
  pathRewrite: {
    '^/articles': '/articles',
    '^/_next': '/_next',
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers['x-proxied-by'] = 'circle-proxy';
  },
});

module.exports = articlesProxy;