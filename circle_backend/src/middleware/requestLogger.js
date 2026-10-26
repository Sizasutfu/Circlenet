// middleware/requestLogger.js – styled request logging with response time

const useColor = process.stdout.isTTY && process.env.NODE_ENV !== "production";

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

// Plain text when output isn't a terminal (e.g. production log shippers)
const paint = (color, text) => (useColor ? `${color}${text}${c.reset}` : String(text));

const methodColor = {
  GET: c.green,
  POST: c.blue,
  PUT: c.yellow,
  PATCH: c.magenta,
  DELETE: c.red,
};

const statusColor = (code) =>
  code >= 500 ? c.red : code >= 400 ? c.yellow : code >= 300 ? c.cyan : c.green;

// green = fast, yellow = okay, red = slow
const timeColor = (ms) => (ms < 100 ? c.green : ms < 500 ? c.yellow : c.red);

function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  // Capture now: req.path changes inside mounted routers, req.originalUrl doesn't
  const { method, originalUrl } = req;
  const mColor = methodColor[method] || c.gray;

  let logged = false;
  const logDuration = (aborted) => {
    if (logged) return;
    logged = true;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const time = new Date().toLocaleTimeString("en-GB"); // HH:MM:SS

    console.log(
      [
        paint(c.gray, time),
        paint(c.bold + mColor, method.padEnd(6)),
        originalUrl,
        paint(c.bold + statusColor(res.statusCode), res.statusCode),
        paint(timeColor(ms), `${ms.toFixed(1)}ms`),
        aborted ? paint(c.red, "(aborted)") : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  };

  // 'finish' = response fully sent; 'close' = client dropped before that
  res.on("finish", () => logDuration(false));
  res.on("close", () => logDuration(true));

  next();
}

module.exports = { requestLogger };