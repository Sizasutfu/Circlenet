// middleware/articlesProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

const articlesProxy = createProxyMiddleware({
  target: 'https://blog.circlenet.social', // The address of your running Next.js blog
  changeOrigin: true,
  pathRewrite: {
    '^/articles': '/articles', // No rewrite needed, as Next.js expects the '/articles' prefix
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers['x-proxied-by'] = 'circle-proxy';
  },
});

module.exports = articlesProxy;