import { useMemo, useState } from "react";
import { OpenIssue } from "../types/stream";

interface IssueBacklogProps {
  issues: OpenIssue[];
  loading?: boolean;
}

type SortOption = "points-desc" | "points-asc" | "complexity" | "title";

const complexityRank: Record<OpenIssue["complexity"], number> = {
  Trivial: 0,
  Medium: 1,
  High: 2,
};

export function IssueBacklog({ issues, loading }: IssueBacklogProps) {
  const [selectedLabel, setSelectedLabel] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("points-desc");

  const labels = useMemo(
    () => Array.from(new Set(issues.flatMap((issue) => issue.labels))).sort(),
    [issues],
  );

  const visibleIssues = useMemo(() => {
    const filtered = selectedLabel
      ? issues.filter((issue) => issue.labels.includes(selectedLabel))
      : issues;

    return [...filtered].sort((a, b) => {
      if (sortBy === "points-asc") {
        return a.points - b.points;
      }

      if (sortBy === "complexity") {
        return complexityRank[a.complexity] - complexityRank[b.complexity];
      }

      if (sortBy === "title") {
        return a.title.localeCompare(b.title);
      }

      return b.points - a.points;
    });
  }, [issues, selectedLabel, sortBy]);

  if (loading) {
    return (
      <div className="card">
        <h2>Maintainer Backlog</h2>
        <div className="activity-feed">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton skeleton-item"
              style={{ height: "100px" }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Maintainer Backlog</h2>
      <p className="muted">
        Open these as GitHub issues after publishing the repository.
      </p>

      <div className="filter-bar" style={{ marginBottom: "1rem" }}>
        <label>
          Label
          <select
            aria-label="Filter issues by label"
            value={selectedLabel}
            onChange={(event) => setSelectedLabel(event.target.value)}
          >
            <option value="">All labels</option>
            {labels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sort by
          <select
            aria-label="Sort issues"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
          >
            <option value="points-desc">Points: high to low</option>
            <option value="points-asc">Points: low to high</option>
            <option value="complexity">Complexity</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>

      {visibleIssues.length === 0 ? (
        <p className="muted">No backlog issues match this label.</p>
      ) : (
        <div className="issue-list">
          {visibleIssues.map((issue) => (
            <article key={issue.id} className="issue-item">
              <h3>{issue.title}</h3>
              <p>{issue.summary}</p>
              <p className="muted">
                Complexity: {issue.complexity} | Points: {issue.points}
              </p>
              <div className="chip-row">
                {issue.labels.map((label) => (
                  <span key={label} className="chip">
                    {label}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
