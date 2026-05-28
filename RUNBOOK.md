# Operational Runbook

This runbook provides step-by-step procedures for common operational tasks in StellarStream.  
For initial production setup, refer to the **[Deployment Guide](DEPLOYMENT.md)**.

## Table of Contents
1. [Reset SQLite Database](#reset-sqlite-database)
2. [Rotate JWT Secret](#rotate-jwt-secret)
3. [Force Indexer Reconcile](#force-indexer-reconcile)
4. [Requeue Dead-Letter Webhooks](#requeue-dead-letter-webhooks)
5. [Archive Old Streams Manually](#archive-old-streams-manually)

---

### Reset SQLite Database
**Prerequisites:**
- Access to the server's filesystem.
- Backend service stopped (recommended).

**Steps:**
1. Stop the backend service.
2. Navigate to the `backend/data` directory.
3. Delete the database file:
   ```bash
   rm backend/data/streams.db
   ```
4. Restart the backend service.

**Expected Output:**
- Backend logs show: `Database initialized.` and `migrate()` running.
- A new `streams.db` file is created.

---

### Rotate JWT Secret
**Prerequisites:**
- Access to the backend environment variables or `.env` file.

**Steps:**
1. Generate a new random secret:
   ```bash
   openssl rand -hex 32
   ```
2. Update the `JWT_SECRET` value in your environment or `backend/.env` file.
3. Restart the backend service.

**Expected Output:**
- All existing user sessions are invalidated.
- Users will be prompted to re-connect their wallets and sign a new challenge.

---

### Force Indexer Reconcile
**Prerequisites:**
- Access to the backend environment variables.

**Steps:**
1. Identify the ledger sequence number you want to re-index from.
2. Set the `INDEXER_START_LEDGER` environment variable:
   ```bash
   # Example: Re-index from ledger 1234567
   export INDEXER_START_LEDGER=1234567
   ```
3. Restart the backend service.

**Expected Output:**
- Backend logs show: `INDEXER_START_LEDGER override active: starting from ledger 1234567`.
- The indexer will process events starting from that ledger, potentially updating local records.

---

### Requeue Dead-Letter Webhooks
**Prerequisites:**
- An admin JWT or access to the database.
- The ID of the dead-letter record.

**Steps:**
1. Get the list of dead-letter webhooks:
   ```bash
   curl -H "Authorization: Bearer <ADMIN_TOKEN>" http://localhost:3001/api/webhooks/dead-letters
   ```
2. Re-queue a specific webhook using its ID:
   ```bash
   curl -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" http://localhost:3001/api/webhooks/dead-letters/<ID>/requeue
   ```

**Expected Output:**
- JSON response: `{ "success": true, "message": "Webhook re-queued successfully" }`.
- The record is moved from `webhook_dead_letters` back to `webhook_deliveries`.

---

### Archive Old Streams Manually
**Prerequisites:**
- Node.js environment on the server.

**Steps:**
Currently, archiving is defined in the codebase but not exposed via a CLI or API. To trigger it manually, you can use a small script:
1. Create a file `archive.js`:
   ```javascript
   const { initDb } = require('./dist/services/db');
   const { archiveOldStreams } = require('./dist/services/streamStore');

   async function run() {
     initDb();
     const archived = await archiveOldStreams();
     console.log(`Archived ${archived} streams.`);
     process.exit(0);
   }
   run();
   ```
2. Run the script:
   ```bash
   node archive.js
   ```

**Expected Output:**
- Console log showing the number of streams archived (completed > 30 days ago).
