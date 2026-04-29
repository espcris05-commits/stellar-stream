import { render, screen } from "@testing-library/react";
import StreamMetricsChart from "./StreamMetricsChart";

describe("StreamMetricsChart", () => {
  it("renders with known metrics history data", () => {
    const history = [
      { timestamp: "2024-01-01T00:00:00Z", vestedAmount: 100 },
      { timestamp: "2024-01-02T00:00:00Z", vestedAmount: 200 },
    ];
    render(<StreamMetricsChart history={history} />);
    expect(screen.getByText(/200/)).toBeInTheDocument();
  });

  it("renders gracefully with empty history", () => {
    render(<StreamMetricsChart history={[]} />);
    expect(screen.getByText(/No data available/)).toBeInTheDocument();
  });

  it("handles a single data point without crashing", () => {
    const history = [{ timestamp: "2024-01-01T00:00:00Z", vestedAmount: 150 }];
    render(<StreamMetricsChart history={history} />);
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });
});
