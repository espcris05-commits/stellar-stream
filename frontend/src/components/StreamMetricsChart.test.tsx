import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { StreamMetricsChart } from "./StreamMetricsChart";

// Mock recharts components to render simple HTML/SVG for testing
vi.mock("recharts", () => {
  return {
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
    AreaChart: ({ data, children }: any) => (
      <svg data-testid="area-chart">
        {children}
      </svg>
    ),
    Area: ({ dataKey }: any) => <g>Area: {dataKey}</g>,
    XAxis: () => <g>XAxis</g>,
    YAxis: () => <g>YAxis</g>,
    CartesianGrid: () => <g>CartesianGrid</g>,
    Tooltip: () => <g>Tooltip</g>,
    Legend: () => <g>Legend</g>,
    ReferenceArea: () => <g>ReferenceArea</g>,
  };
});

describe("StreamMetricsChart", () => {
  it("renders with known metrics history data", () => {
    const data = [
      { timestamp: 1704067200000, active: 10, completed: 5, vested: 100 },
      { timestamp: 1704153600000, active: 12, completed: 6, vested: 200 },
    ];
    render(<StreamMetricsChart data={data} />);
    expect(screen.getByText("Area: Vested Amount")).toBeInTheDocument();
    expect(screen.getByText("Area: Active")).toBeInTheDocument();
    expect(screen.getByText("Area: Completed")).toBeInTheDocument();
  });

  it("renders gracefully with empty history", () => {
    render(<StreamMetricsChart data={[]} />);
    expect(screen.getByText(/No Chart Data Yet/)).toBeInTheDocument();
  });

  it("handles a single data point without crashing", () => {
    const data = [{ timestamp: 1704067200000, active: 10, completed: 5, vested: 150 }];
    render(<StreamMetricsChart data={data} />);
    expect(screen.getByText("Area: Vested Amount")).toBeInTheDocument();
  });
});
