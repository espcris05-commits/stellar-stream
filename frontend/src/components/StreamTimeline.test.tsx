/**
 * Property-based tests for StreamTimeline filter logic.
 * Feature: stream-timeline-filters
 *
 * Tests the pure functions: computeFilteredEvents, toggleFilter, clearFilters
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import * as fc from "fast-check";
import {
  StreamTimeline,
  computeFilteredEvents,
  toggleFilter,
  clearFilters,
  EventType,
} from "./StreamTimeline";
import type { StreamEvent } from "../services/api";

// Mock the API
vi.mock("../services/api", () => ({
  getStreamHistory: vi.fn(),
  listAllEvents: vi.fn(),
}));

import { listAllEvents } from "../services/api";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const EVENT_TYPES: EventType[] = [
  "created",
  "claimed",
  "canceled",
  "start_time_updated",
];

const arbEventType = fc.constantFrom(...EVENT_TYPES);

const arbStreamEvent = fc.record<StreamEvent>({
  id: fc.integer({ min: 1, max: 1_000_000 }),
  streamId: fc.string({ minLength: 8, maxLength: 16 }),
  eventType: arbEventType,
  timestamp: fc.integer({ min: 0, max: 2_000_000_000 }),
  actor: fc.option(fc.string({ minLength: 40, maxLength: 40 }), {
    nil: undefined,
  }),
  amount: fc.option(fc.integer({ min: 1, max: 1_000_000 }), { nil: undefined }),
});

const arbStreamEvents = fc.array(arbStreamEvent, { minLength: 0, maxLength: 50 });

/** Generates a non-empty subset of EVENT_TYPES as a Set */
const arbNonEmptyFilterSet = fc
  .subarray(EVENT_TYPES, { minLength: 1 })
  .map((arr) => new Set(arr) as Set<EventType>);

/** Generates any subset (possibly empty) of EVENT_TYPES as a Set */
const arbFilterSet = fc
  .subarray(EVENT_TYPES, { minLength: 0 })
  .map((arr) => new Set(arr) as Set<EventType>);

/** Generates a non-empty subset of size >= 2 */
const arbMultiFilterSet = fc
  .subarray(EVENT_TYPES, { minLength: 2 })
  .map((arr) => new Set(arr) as Set<EventType>);

// ---------------------------------------------------------------------------
// Property 1: Filtered events match active filters
// Validates: Requirements 2.3, 3.2
// ---------------------------------------------------------------------------

describe(
  "Feature: stream-timeline-filters, Property 1: Filtered events match active filters",
  () => {
    it("every event in filteredEvents has an eventType in activeFilters", () => {
      fc.assert(
        fc.property(arbStreamEvents, arbNonEmptyFilterSet, (events, activeFilters) => {
          const result = computeFilteredEvents(events, activeFilters);
          return result.every((e) => activeFilters.has(e.eventType));
        }),
        { numRuns: 100 },
      );
    });
  },
);

// ---------------------------------------------------------------------------
// Property 2: No active filters shows all events
// Validates: Requirements 5.3
// ---------------------------------------------------------------------------

describe(
  "Feature: stream-timeline-filters, Property 2: No active filters shows all events",
  () => {
    it("filteredEvents equals the full list when activeFilters is empty", () => {
      fc.assert(
        fc.property(arbStreamEvents, (events) => {
          const result = computeFilteredEvents(events, new Set());
          return (
            result.length === events.length &&
            result.every((e, i) => e === events[i])
          );
        }),
        { numRuns: 100 },
      );
    });
  },
);

// ---------------------------------------------------------------------------
// Property 3: Toggle is an involution (round-trip)
// Validates: Requirements 2.1, 2.2
// ---------------------------------------------------------------------------

describe(
  "Feature: stream-timeline-filters, Property 3: Toggle is an involution (round-trip)",
  () => {
    it("toggling the same type twice returns the original set", () => {
      fc.assert(
        fc.property(arbFilterSet, arbEventType, (activeFilters, type) => {
          const after = toggleFilter(toggleFilter(activeFilters, type), type);
          // Sets must have the same members
          if (after.size !== activeFilters.size) return false;
          for (const t of activeFilters) {
            if (!after.has(t)) return false;
          }
          return true;
        }),
        { numRuns: 100 },
      );
    });
  },
);

// ---------------------------------------------------------------------------
// Property 4: Multi-select union correctness
// Validates: Requirements 3.1, 3.2
// ---------------------------------------------------------------------------

describe(
  "Feature: stream-timeline-filters, Property 4: Multi-select union correctness",
  () => {
    it("filteredEvents contains exactly the events whose eventType is in the union", () => {
      fc.assert(
        fc.property(arbStreamEvents, arbMultiFilterSet, (events, activeFilters) => {
          const result = computeFilteredEvents(events, activeFilters);
          const expected = events.filter((e) => activeFilters.has(e.eventType));
          if (result.length !== expected.length) return false;
          return result.every((e, i) => e === expected[i]);
        }),
        { numRuns: 100 },
      );
    });
  },
);

// ---------------------------------------------------------------------------
// Property 5: Clear resets to full list
// Validates: Requirements 5.2, 5.3
// ---------------------------------------------------------------------------

describe(
  "Feature: stream-timeline-filters, Property 5: Clear resets to full list",
  () => {
    it("after clearFilters, filteredEvents equals the full list", () => {
      fc.assert(
        fc.property(arbStreamEvents, arbNonEmptyFilterSet, (events, _activeFilters) => {
          const emptyFilters = clearFilters();
          const result = computeFilteredEvents(events, emptyFilters);
          return (
            result.length === events.length &&
            result.every((e, i) => e === events[i])
          );
        }),
        { numRuns: 100 },
      );
    });
  },
);

describe("StreamTimeline rendering: events and empty states", () => {
  it("renders one event of each type with correct icon and label", async () => {
    const events: StreamEvent[] = [
      {
        id: 1,
        streamId: "s1",
        eventType: "created",
        timestamp: 100,
        actor: "GBAFGP7ZOCXGXPX6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6",
        amount: 100,
      },
      {
        id: 2,
        streamId: "s1",
        eventType: "claimed",
        timestamp: 200,
        actor: "GBAFGP7ZOCXGXPX6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6",
        amount: 50,
      },
      {
        id: 3,
        streamId: "s1",
        eventType: "canceled",
        timestamp: 300,
        actor: "GBAFGP7ZOCXGXPX6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6",
      },
      {
        id: 4,
        streamId: "s1",
        eventType: "start_time_updated",
        timestamp: 400,
        actor: "GBAFGP7ZOCXGXPX6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6",
      },
    ];
    (listAllEvents as any).mockResolvedValue(events);

    render(<StreamTimeline />);

    // Wait for content to load
    await waitFor(() => expect(screen.getByText("Stream created")).toBeTruthy());

    // Verify each event type
    const eventTypes = [
      { icon: "🚀", label: "Stream created" },
      { icon: "💸", label: "Stream claimed" },
      { icon: "❌", label: "Stream canceled" },
      { icon: "🕐", label: "Start time updated" },
    ];

    for (const { icon, label } of eventTypes) {
      expect(screen.getByText(icon)).toBeTruthy();
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("renders 'no history' message when events array is empty", async () => {
    (listAllEvents as any).mockResolvedValue([]);

    render(<StreamTimeline />);

    await waitFor(() =>
      expect(screen.getByText("No activity to show yet.")).toBeTruthy(),
    );
    expect(screen.getByText("--")).toBeTruthy(); // Empty icon icon
  });

  it("renders events in ascending time order", async () => {
    // Unordered timestamps: 200, 100, 300
    const events: StreamEvent[] = [
      { id: 2, streamId: "s1", eventType: "claimed", timestamp: 200, actor: "GBAFGP...Z5X6" },
      { id: 1, streamId: "s1", eventType: "created", timestamp: 100, actor: "GBAFGP...Z5X6" },
      { id: 3, streamId: "s1", eventType: "canceled", timestamp: 300, actor: "GBAFGP...Z5X6" },
    ];
    (listAllEvents as any).mockResolvedValue(events);

    render(<StreamTimeline />);

    await waitFor(() => expect(screen.getByText("Stream created")).toBeTruthy());

    // Get all event titles and verify their order
    const titles = screen
      .getAllByText(/Stream (created|claimed|canceled)/)
      .map((el) => el.textContent);
    
    // Ascending order expected based on timestamp: 100, 200, 300
    expect(titles).toEqual([
      "Stream created",
      "Stream claimed",
      "Stream canceled",
    ]);
  });

  it("verifies actor and amount fields are shown when present", async () => {
    const actorAddress = "GBAFGP7ZOCXGXPX6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6GZ5X6";
    const events: StreamEvent[] = [
      {
        id: 1,
        streamId: "s1",
        eventType: "created",
        timestamp: 100,
        actor: actorAddress,
        amount: 1234.56,
      },
    ];
    (listAllEvents as any).mockResolvedValue(events);

    render(<StreamTimeline />);

    await waitFor(() => expect(screen.getByText("Stream created")).toBeTruthy());

    // Check description for actor (truncated) and amount
    // Component truncates actor to slice(0,6)...slice(-4)
    expect(screen.getByText(/Initiated by GBAFGP...Z5X6 for 1234.56 tokens/i)).toBeTruthy();
    
    // Check CopyableAddress (truncates to 8 chars... for end mode)
    expect(screen.getByText("GBAFGP7Z...")).toBeTruthy();
  });

  it("shows stream link in global feed but not in stream-specific view", async () => {
    const events: StreamEvent[] = [
      { id: 1, streamId: "stream-123", eventType: "created", timestamp: 100, actor: "GBAFGP...Z5X6" },
    ];
    
    // Case 1: Global Feed (no streamId prop)
    (listAllEvents as any).mockResolvedValue(events);
    const { rerender } = render(<StreamTimeline />);
    await waitFor(() => expect(screen.getByText("Stream stream-123")).toBeTruthy());
    expect(screen.getByText(/Latest across all streams/i)).toBeTruthy();

    // Case 2: Stream-specific view
    (getStreamHistory as any).mockResolvedValue(events);
    rerender(<StreamTimeline streamId="stream-123" />);
    
    // Wait for re-render/loading
    await waitFor(() => expect(screen.queryByText(/Latest across all streams/i)).toBeNull());
    expect(screen.queryByText("Stream stream-123")).toBeNull();
  });
});

