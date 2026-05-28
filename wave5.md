# Wave 5 — StellarStream Implementation Backlog

Wave 5 focuses on **security hardening, observability, developer experience, and frontend polish** — building on the foundation laid in Wave 4.

## Themes

- **Security**: payload validation, input sanitisation, auth improvements
- **Observability**: time-series metrics, structured logging, alerting hooks
- **Backend**: missing endpoints, caching, reconciliation improvements
- **Frontend**: metrics visualisation, accessibility, error boundaries
- **Testing**: coverage gaps, integration tests, property-based tests
- **Infra**: rate limit tuning, deployment docs, CI coverage gates

## File Coverage

| Area                | Files Targeted                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Backend Core        | `backend/src/index.ts`, `backend/src/apiErrors.ts`                                         |
| Backend Services    | `backend/src/services/metricsHistory.ts`, `backend/src/services/stats.ts`                  |
| Backend Services    | `backend/src/services/cache.ts`, `backend/src/services/reconciliationJob.ts`               |
| Validation          | `backend/src/validation/schemas.ts`                                                        |
| Frontend Hooks      | `frontend/src/hooks/useMetricsHistory.ts`, `frontend/src/hooks/useStats.ts`                |
| Frontend Components | `frontend/src/components/StreamMetricsChart.tsx`, `frontend/src/components/StatsPanel.tsx` |
| Frontend Components | `frontend/src/components/ErrorBoundary.tsx`, `frontend/src/components/Toast.tsx`           |
| Infra               | `.github/workflows/backend-ci.yml`, `.github/workflows/frontend-ci.yml`                    |

## Issue Summary (50 items)

Issues are grouped by theme and tagged with labels: `wave5`, `security`, `backend`, `frontend`, `testing`, `infra`, `observability`.

---

## Wave 5 Checklist

### Security

- [x] Request body size limit (`express.json({ limit: '32kb' })`) with 413/400 error responses
- [ ] Sanitise string inputs (strip null bytes, control characters) in Zod schemas
- [ ] Add `helmet` middleware for security headers (CSP, HSTS, X-Frame-Options)
- [ ] Enforce `Content-Type: application/json` on all mutation endpoints
- [ ] CORS origin allowlist via `ALLOWED_ORIGINS` env var (replace open `cors()`)
- [ ] JWT `aud` and `iss` claim validation in `authMiddleware`
- [ ] Rotate JWT secret without downtime (dual-secret grace period)
- [ ] Admin endpoint authentication audit — ensure all `adminAuth` routes are tested

### Observability

- [x] `GET /api/metrics/history?days=N` — daily aggregate time-series endpoint (max 90 days, 5-min TTL cache)
- [ ] Wire `GET /api/stats` route to `getStreamStats()` from `stats.ts`
- [ ] Add `collectDefaultMetrics()` to Prometheus registry in `metrics.ts`
- [ ] Structured JSON logging (replace `console.log` with a logger like `pino`)
- [ ] Log request duration in `requestLogger` middleware
- [ ] Expose cache hit/miss counters as Prometheus metrics
- [ ] Alert threshold config for indexer lag (ledger sequence delta)
- [ ] Health endpoint extended: include DB status, indexer lag, cache connectivity

### Backend

- [ ] `GET /api/streams/:id/progress` — real-time vesting progress snapshot
- [ ] `GET /api/streams/stats/summary` — aggregate counts by status
- [ ] Cursor-based pagination on `GET /api/events` (replace offset for large datasets)
- [ ] Configurable reconciliation interval via env var (already partially done)
- [ ] Reconciliation job: emit metrics on drift count and correction count
- [ ] `streamStore.ts`: add index on `streams(sender)` and `streams(recipient)` for large datasets
- [ ] Cache `listStreams` results with short TTL (invalidate on mutation)
- [ ] Graceful shutdown: drain in-flight requests before `process.exit`
- [ ] `POST /api/streams/:id/archive` — explicit archive endpoint (vs. background job only)
- [ ] Validate `ALLOWED_ASSETS` env var on startup (non-empty, valid asset codes)

### Frontend

- [ ] Connect `useMetricsHistory` hook to real `GET /api/metrics/history` endpoint
- [ ] `StreamMetricsChart`: render daily `activeStreams` and `totalVested` as dual-axis line chart
- [ ] `StatsPanel`: display live aggregate stats from `GET /api/stats`
- [ ] Global `ErrorBoundary` component wrapping the app root
- [ ] Retry button in error states (streams list, metrics chart)
- [ ] Skeleton loaders for `StreamsTable` and `StatsPanel` during initial fetch
- [ ] Accessible colour contrast audit (WCAG AA) on dark mode palette
- [ ] Keyboard navigation for `StreamsTable` row actions (cancel, pause, resume)
- [ ] `aria-live` region for toast notifications
- [ ] Persist selected asset filter in URL query params (`?asset=USDC`)
- [ ] Export button: trigger CSV download from `GET /api/streams/export.csv`
- [ ] Stream detail page: show event history timeline using `GET /api/streams/:id/history`

### Testing

- [ ] Backend: integration test for 413 response on oversized JSON body
- [ ] Backend: integration test for 400 response on malformed JSON body
- [ ] Backend: unit tests for `getMetricsHistory` with mocked DB
- [ ] Backend: unit tests for `getStreamStats` cache invalidation
- [ ] Backend: property-based tests for pagination (arbitrary page/limit combos)
- [ ] Frontend: test `useMetricsHistory` hook with MSW mock for `/api/metrics/history`
- [ ] Frontend: test `StreamMetricsChart` renders correct number of data points
- [ ] Frontend: test `ErrorBoundary` catches render errors and shows fallback UI
- [ ] CI: enforce minimum 70% line coverage gate on backend (`--coverage.thresholds.lines=70`)
- [ ] CI: enforce minimum 60% line coverage gate on frontend

### Infra

- [ ] Add `@vitest/coverage-v8` coverage step to `backend-ci.yml`
- [ ] Add coverage step to `frontend-ci.yml`
- [ ] Upload coverage reports to Codecov (or equivalent) from CI
- [ ] Docker: add `HEALTHCHECK` instruction to backend `dockerfile`
- [ ] Docker: non-root user in backend container
- [ ] `DEPLOYMENT.md`: document `REDIS_URL` env var and cache behaviour
- [ ] `DEPLOYMENT.md`: document `METRICS_AUTH` env var for Prometheus scrape auth
- [ ] Dependabot config for automated dependency updates
