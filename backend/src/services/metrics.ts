import { Counter, Gauge, Registry } from "prom-client";

export const register = new Registry();

export const eventsIndexedTotal = new Counter({
  name: "events_indexed_total",
  help: "Total number of contract events successfully indexed",
  registers: [register],
});

export const ledgersScannedTotal = new Counter({
  name: "ledgers_scanned_total",
  help: "Total number of ledgers scanned by the indexer",
  registers: [register],
});

export const lastIndexedLedger = new Gauge({
  name: "last_indexed_ledger",
  help: "Sequence number of the last ledger processed by the indexer",
  registers: [register],
});

export const indexerErrorsTotal = new Counter({
  name: "indexer_errors_total",
  help: "Total number of errors encountered during indexer polls",
  registers: [register],
});

export const indexerCircuitState = new Gauge({
  name: "indexer_circuit_state",
  help: "Current circuit breaker state: 0=CLOSED, 1=HALF_OPEN, 2=OPEN",
  registers: [register],
});
