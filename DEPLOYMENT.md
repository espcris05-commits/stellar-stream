# Deployment Guide

This guide provides step-by-step instructions for deploying StellarStream to various platforms and using Docker.

## Table of Contents
1. [Stellar Smart Contract Deployment](#1-stellar-smart-contract-deployment)
2. [Backend Deployment (Railway)](#2-backend-deployment-railway)
3. [Frontend Deployment (Vercel)](#3-frontend-deployment-vercel)
4. [Docker Deployment](#4-docker-deployment)
5. [Troubleshooting](#5-troubleshooting)

---

## 1. Stellar Smart Contract Deployment

Before deploying the backend, you must deploy the Soroban smart contract to the Stellar Testnet.

### Prerequisites
- [Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup#install-the-soroban-cli) installed.
- A Stellar account with testnet XLM.

### Funding Your Account
1. Generate a new keypair if you don't have one:
   ```bash
   soroban config identity generate deployer
   ```
2. Fund it via Friendbot:
   ```bash
   curl "https://friendbot.stellar.org/?addr=$(soroban config identity address deployer)"
   ```

### Deployment Steps
1. Navigate to the root directory.
2. Run the deployment script (replace with your secret key):
   ```bash
   SECRET_KEY="YOUR_SECRET_KEY" ./scripts/deploy.sh
   ```
3. Note the **Contract ID** output (also saved in `contracts/contract_id.txt`). You will need this for the backend configuration.

---

## 2. Backend Deployment (Railway)

The backend is a Node.js Express app that connects to a SQLite database.

### Steps
1. Create a new project on [Railway](https://railway.app/).
2. Connect your GitHub repository.
3. Set the **Root Directory** to `backend`.
4. Add a **Persistent Volume** (Disk) and mount it to `/app/data` to persist the SQLite database.
5. Configure the following **Environment Variables**:
   - `PORT`: `3001`
   - `CONTRACT_ID`: (From step 1)
   - `SERVER_PRIVATE_KEY`: (Your Stellar secret key)
   - `JWT_SECRET`: (Generate using `openssl rand -hex 32`)
   - `DB_PATH`: `/app/data/streams.db`
   - `ALLOWED_ASSETS`: `USDC,XLM`
   - `RPC_URL`: `https://soroban-testnet.stellar.org:443`
   - `NETWORK_PASSPHRASE`: `Test SDF Network ; September 2015`
6. **Health Check**: Set the health check path to `/api/health`.

---

## 3. Frontend Deployment (Vercel)

The frontend is a React app built with Vite.

### Steps
1. Create a new project on [Vercel](https://vercel.com/).
2. Connect your GitHub repository.
3. Set the **Root Directory** to `frontend`.
4. Configure the **Build Settings**:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add the following **Environment Variable**:
   - `VITE_API_URL`: (The URL of your deployed Railway backend, e.g., `https://your-backend.up.railway.app/api`)

---

## 4. Docker Deployment

For a quick production-like setup using Docker Compose.

### Production Setup
1. Copy `backend/.env.example` to `backend/.env` and fill in the required values.
2. Run the following command from the root directory:
   ```bash
   docker-compose up -d --build
   ```

### Overriding for Production
Create a `docker-compose.prod.yml` if you need specific production overrides (e.g., removing dev-only tools):
```yaml
version: "3.9"
services:
  backend:
    build:
      context: ./backend
      dockerfile: dockerfile
    command: ["npm", "start"] # Assuming 'start' runs compiled JS
  frontend:
    build:
      context: ./frontend
      dockerfile: dockerfile
    command: ["npm", "run", "preview", "--", "--host"]
```

---

## 5. Troubleshooting

### "Contract ID not set" in Backend Logs
Ensure the `CONTRACT_ID` environment variable is correctly set in your deployment platform. The indexer will not start without it.

### Webhook Delivery Failures
Check the `webhook_dead_letters` table in the database. Ensure `WEBHOOK_DESTINATION_URL` is accessible from the backend server. Refer to the [Runbook](RUNBOOK.md) for re-queueing instructions.

### CORS Errors in Frontend
Ensure the backend `ALLOWED_ORIGINS` (if implemented) or CORS configuration allows requests from your frontend domain.

### SQLite Database Locked
This can happen if multiple processes try to write to the SQLite file. In production, ensure only one instance of the backend is running at a time or use WAL mode (already enabled in `db.ts`).
