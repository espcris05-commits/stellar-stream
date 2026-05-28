import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IssueBacklog } from "./IssueBacklog";
import { OpenIssue } from "../types/stream";

const issues: OpenIssue[] = [
  {
    id: "medium-api",
    title: "Add API pagination",
    labels: ["api", "backend"],
    summary: "Paginate API responses.",
    complexity: "Medium",
    points: 150,
  },
  {
    id: "trivial-docs",
    title: "Document local setup",
    labels: ["documentation"],
    summary: "Add local setup notes.",
    complexity: "Trivial",
    points: 100,
  },
  {
    id: "high-ui",
    title: "Improve dashboard filters",
    labels: ["frontend", "ux"],
    summary: "Add better filtering controls.",
    complexity: "High",
    points: 200,
  },
];

describe("IssueBacklog", () => {
  it("sorts issues by points from high to low by default", () => {
    render(<IssueBacklog issues={issues} />);

    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(titles).toEqual([
      "Improve dashboard filters",
      "Add API pagination",
      "Document local setup",
    ]);
  });

  it("filters issues by label", () => {
    render(<IssueBacklog issues={issues} />);

    fireEvent.change(screen.getByLabelText("Filter issues by label"), {
      target: { value: "documentation" },
    });

    expect(screen.getByText("Document local setup")).toBeInTheDocument();
    expect(screen.queryByText("Add API pagination")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Improve dashboard filters"),
    ).not.toBeInTheDocument();
  });

  it("sorts issues by title", () => {
    render(<IssueBacklog issues={issues} />);

    fireEvent.change(screen.getByLabelText("Sort issues"), {
      target: { value: "title" },
    });

    const titles = screen
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(titles).toEqual([
      "Add API pagination",
      "Document local setup",
      "Improve dashboard filters",
    ]);
  });
});
