module.exports = {
  MAX_MESSAGE_LENGTH: 500,
  MAX_IMAGE_SIZE_MB: 10,
  CARD_IMAGE_WIDTH: 1200,
  PNG_COMPRESSION_LEVEL: 8,
  INBOX_PAGE_LIMIT: 20,
  SEND_RATE_LIMIT: 3,               // per hour
  SEND_RATE_WINDOW_MS: 60 * 60 * 1000,
  AUTH_RATE_LIMIT: 60,              // per minute
  IP_HASH_SALT: process.env.IP_HASH_SALT || "change-me-in-production",
};