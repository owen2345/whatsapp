const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './data/gateway.db';

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ─────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    phone       TEXT,
    webhook_url TEXT,
    api_key     TEXT NOT NULL UNIQUE,
    status      TEXT NOT NULL DEFAULT 'disconnected',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    account_id  TEXT NOT NULL,
    direction   TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
    from_jid    TEXT,
    to_jid      TEXT,
    msg_type    TEXT NOT NULL DEFAULT 'text',
    content     TEXT NOT NULL,
    wa_id       TEXT,
    status      TEXT NOT NULL DEFAULT 'sent',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS webhook_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id  TEXT NOT NULL,
    message_id  TEXT,
    url         TEXT NOT NULL,
    payload     TEXT NOT NULL,
    status_code INTEGER,
    attempts    INTEGER NOT NULL DEFAULT 0,
    success     INTEGER NOT NULL DEFAULT 0,
    last_error  TEXT,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_webhook_account  ON webhook_logs(account_id);
`);

// ── Helpers ─────────────────────────────────────────────────────────────────
const stmts = {
  // Accounts
  getAllAccounts:    db.prepare('SELECT * FROM accounts ORDER BY created_at DESC'),
  getAccountById:   db.prepare('SELECT * FROM accounts WHERE id = ?'),
  getAccountByKey:  db.prepare('SELECT * FROM accounts WHERE api_key = ?'),
  insertAccount:    db.prepare('INSERT INTO accounts (id,name,phone,webhook_url,api_key) VALUES (?,?,?,?,?)'),
  updateAccount:    db.prepare('UPDATE accounts SET name=?,phone=?,webhook_url=?,updated=unixepoch() WHERE id=?'),
  updateStatus:     db.prepare('UPDATE accounts SET status=? WHERE id=?'),
  updatePhone:      db.prepare('UPDATE accounts SET phone=? WHERE id=?'),
  deleteAccount:    db.prepare('DELETE FROM accounts WHERE id=?'),

  // Messages
  insertMessage:    db.prepare('INSERT INTO messages (id,account_id,direction,from_jid,to_jid,msg_type,content,wa_id,status) VALUES (?,?,?,?,?,?,?,?,?)'),
  getMessages:      db.prepare('SELECT * FROM messages WHERE account_id=? ORDER BY created_at DESC LIMIT ?'),

  // Webhook logs
  insertWebhook:    db.prepare('INSERT INTO webhook_logs (account_id,message_id,url,payload) VALUES (?,?,?,?)'),
  updateWebhook:    db.prepare('UPDATE webhook_logs SET status_code=?,attempts=?,success=?,last_error=?,updated_at=unixepoch() WHERE id=?'),
  getWebhookLogs:   db.prepare('SELECT * FROM webhook_logs WHERE account_id=? ORDER BY created_at DESC LIMIT ?'),
};

module.exports = { db, stmts };
