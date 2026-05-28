#!/usr/bin/env node

/**
 * Seed deterministic demo streams into the SQLite database.
 * 
 * Usage:
 *   node scripts/seed-streams.js [--count N] [--reset]
 * 
 * Options:
 *   --count N   Number of streams to create (default: 10)
 *   --reset     Wipe the SQLite DB before seeding
 */

const path = require('path');
const fs = require('fs');

// Load better-sqlite3 from backend node_modules
const Database = require(path.join(__dirname, '..', 'backend', 'node_modules', 'better-sqlite3'));

// Parse command-line arguments
const args = process.argv.slice(2);
let count = 10;
let shouldReset = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--count' && i + 1 < args.length) {
    count = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--reset') {
    shouldReset = true;
  }
}

// Database path
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'streams.db');
const dbDir = path.dirname(DB_PATH);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Reset database if requested
if (shouldReset && fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('✓ Database reset');
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS streams (
    id              TEXT PRIMARY KEY,
    sender          TEXT NOT NULL,
    recipient       TEXT NOT NULL,
    asset_code      TEXT NOT NULL,
    total_amount    REAL NOT NULL,
    duration_seconds INTEGER NOT NULL,
    start_at        INTEGER NOT NULL,
    created_at      INTEGER NOT NULL,
    canceled_at     INTEGER,
    completed_at    INTEGER,
    refunded_amount REAL,
    archived_at     INTEGER,
    paused_at       INTEGER,
    paused_duration INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS stream_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    stream_id       TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    ledger_sequence INTEGER,
    timestamp       INTEGER NOT NULL,
    actor           TEXT,
    amount          REAL,
    metadata        TEXT,
    FOREIGN KEY (stream_id) REFERENCES streams(id)
  );

  CREATE INDEX IF NOT EXISTS idx_stream_events_stream_id ON stream_events(stream_id);
  CREATE INDEX IF NOT EXISTS idx_stream_events_timestamp ON stream_events(timestamp);
`);

// Demo accounts (deterministic)
const DEMO_ACCOUNTS = [
  'GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJJBBX7UYXNMWX5XNXNXNXNXN',
  'GBXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDE',
  'GACDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRST',
  'GDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUV',
  'GEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWX',
];

const DEMO_ASSETS = ['USDC', 'XLM', 'USDT'];

// Helper to generate deterministic stream data
function generateStream(index) {
  const now = Math.floor(Date.now() / 1000);
  const senderIdx = index % DEMO_ACCOUNTS.length;
  const recipientIdx = (index + 1) % DEMO_ACCOUNTS.length;
  const assetIdx = index % DEMO_ASSETS.length;

  // Distribute streams across different statuses
  let startAt, canceledAt, completedAt;
  const status = ['scheduled', 'active', 'paused', 'completed', 'canceled'][index % 5];

  switch (status) {
    case 'scheduled':
      startAt = now + 86400 * (index + 1); // Future start
      break;
    case 'active':
      startAt = now - 86400; // Started yesterday
      break;
    case 'paused':
      startAt = now - 86400;
      break;
    case 'completed':
      startAt = now - 86400 * 10;
      completedAt = now - 86400;
      break;
    case 'canceled':
      startAt = now - 86400 * 5;
      canceledAt = now - 86400 * 2;
      break;
  }

  return {
    id: String(index + 1),
    sender: DEMO_ACCOUNTS[senderIdx],
    recipient: DEMO_ACCOUNTS[recipientIdx],
    assetCode: DEMO_ASSETS[assetIdx],
    totalAmount: 1000 + index * 100,
    durationSeconds: 86400 * (index + 1), // 1 day to N days
    startAt,
    createdAt: now - 86400 * (index + 1),
    canceledAt,
    completedAt,
    refundedAmount: canceledAt ? (1000 + index * 100) * 0.5 : null,
    pausedAt: status === 'paused' ? now - 43200 : null,
    pausedDuration: status === 'paused' ? 43200 : 0,
  };
}

// Insert streams
const insertStream = db.prepare(`
  INSERT OR IGNORE INTO streams (
    id, sender, recipient, asset_code, total_amount, duration_seconds,
    start_at, created_at, canceled_at, completed_at, refunded_amount,
    paused_at, paused_duration
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertEvent = db.prepare(`
  INSERT INTO stream_events (stream_id, event_type, timestamp, actor)
  VALUES (?, ?, ?, ?)
`);

const transaction = db.transaction(() => {
  for (let i = 0; i < count; i++) {
    const stream = generateStream(i);
    
    insertStream.run(
      stream.id,
      stream.sender,
      stream.recipient,
      stream.assetCode,
      stream.totalAmount,
      stream.durationSeconds,
      stream.startAt,
      stream.createdAt,
      stream.canceledAt,
      stream.completedAt,
      stream.refundedAmount,
      stream.pausedAt,
      stream.pausedDuration
    );

    // Record creation event
    insertEvent.run(stream.id, 'created', stream.createdAt, stream.sender);

    // Record other events based on status
    if (stream.completedAt) {
      insertEvent.run(stream.id, 'completed', stream.completedAt, stream.recipient);
    }
    if (stream.canceledAt) {
      insertEvent.run(stream.id, 'canceled', stream.canceledAt, stream.sender);
    }
    if (stream.pausedAt) {
      insertEvent.run(stream.id, 'paused', stream.pausedAt, stream.sender);
    }
  }
});

transaction();

console.log(`✓ Seeded ${count} deterministic demo streams`);
console.log(`  Database: ${DB_PATH}`);
console.log(`  Statuses: scheduled, active, paused, completed, canceled`);

db.close();
