// middleware/deleteBody.js – manually parse JSON bodies on DELETE requests

function deleteBody(req, res, next) {
  const isJsonDelete =
    req.method === "DELETE" &&
    req.headers["content-type"]?.includes("application/json");

  // Not applicable, or express.json() already consumed the stream.
  // (Waiting for 'end' on an already-ended stream would hang the request.)
  if (!isJsonDelete || req._body || req.readableEnded) return next();

  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => {
    if (data) {
      try {
        // Store raw body
        req.rawBody = data;
        // Parse and set body if not already set
        if (!req.body || Object.keys(req.body).length === 0) {
          req.body = JSON.parse(data);
          console.log("✅ DELETE body manually parsed:", req.body);
        }
      } catch (e) {
        console.error("❌ Failed to parse DELETE body:", e.message);
      }
    }
    next();
  });
  req.on("error", (err) => {
    console.error("❌ DELETE body error:", err);
    next();
  });
}

module.exports = { deleteBody };