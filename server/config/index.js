const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_USERS = 6;
const MAX_CALL_PARTICIPANTS = 6;
const SESSION_SECRET = process.env.SESSION_SECRET || "";
if (SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be set to a private random value of at least 32 characters.");
}
const OWNER_SETUP_TOKEN = process.env.OWNER_SETUP_TOKEN || "";

const CLIENT_DIR = path.join(__dirname, "..", "..", "client");
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, "dark-spot.sqlite");

module.exports = {
  PORT,
  HOST,
  MAX_USERS,
  MAX_CALL_PARTICIPANTS,
  SESSION_SECRET,
  OWNER_SETUP_TOKEN,
  CLIENT_DIR,
  DATA_DIR,
  DB_PATH
};
