# Contributing to StellarStream

Thank you for your interest in contributing to StellarStream! This guide will help you get started with our development process.

Check out the [FAQ.md](FAQ.md) for common contributor questions and troubleshooting tips.

## Development Setup

1. Clone the repository
2. Install dependencies: `npm run install:all`
3. Seed demo data: `node scripts/seed-streams.js --reset`
4. Run the development environment: `npm run dev`

### Seeding Demo Data

To populate your local database with deterministic demo streams:

```bash
# Seed 10 default streams
node scripts/seed-streams.js

# Seed custom number of streams
node scripts/seed-streams.js --count 20

# Reset database and seed
node scripts/seed-streams.js --reset

# Combine options
node scripts/seed-streams.js --reset --count 15
```

The seed script creates streams across all statuses (scheduled, active, paused, completed, canceled) with deterministic data, ensuring consistent results on every run when the database is empty.

## Testing

### Backend Tests

Run `npm run test` in the `backend/` directory.

### Contract Tests

Run `cargo test` in the `contracts/` directory.

#### Snapshot Testing

We use `insta` for snapshot testing of contract events.  
Snapshot files are located in `contracts/test_snapshots/`.

**To update snapshots:**
If you change event structures and need to update the snapshots, run:

```bash
cargo insta review
```
