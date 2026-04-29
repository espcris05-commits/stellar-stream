import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceArea,
} from "recharts";
import { useState, useRef, useMemo, useCallback } from "react";
import { MetricsSnapshot } from "../hooks/useMetricsHistory";

interface StreamMetricsChartProps {
  data: MetricsSnapshot[];
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function StreamMetricsChart({ data }: StreamMetricsChartProps) {
  const [zoomRange, setZoomRange] = useState<[number, number] | null>(null);
  const [interactionMode, setInteractionMode] = useState<"pan" | "zoom">("pan");
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startRange: [number, number]; active: boolean } | null>(null);
  const pinchRef = useRef<{ startDist: number; startRange: [number, number] } | null>(null);

  const maxIndex = Math.max(0, data.length - 1);
  const currentRange = zoomRange || [0, maxIndex];

  const currentData = useMemo(() => {
    return data.slice(Math.max(0, currentRange[0]), Math.min(data.length, currentRange[1] + 1));
  }, [data, currentRange]);

  const visibleMinutes = useMemo(() => {
    if (currentData.length < 2) return 1;
    const diffMs = currentData[currentData.length - 1].timestamp - currentData[0].timestamp;
    return Math.max(1, Math.round(diffMs / 60000));
  }, [currentData]);

  const zoomInOut = useCallback((factor: number) => {
    setZoomRange((prev) => {
      const range = prev || [0, maxIndex];
      const length = range[1] - range[0];
      if (length <= 1 && factor > 1) return range;
      
      const newLength = Math.max(1, Math.round(length / factor));
      const center = range[0] + length / 2;
      
      let newStart = Math.round(center - newLength / 2);
      let newEnd = Math.round(center + newLength / 2);
      
      return [Math.max(0, newStart), Math.min(maxIndex, newEnd)];
    });
  }, [maxIndex]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (interactionMode !== "pan") return;
    dragRef.current = { 
      startX: e.clientX, 
      startRange: zoomRange || [0, maxIndex],
      active: true 
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragRef.current?.active) {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth || 800;
      const { startX, startRange } = dragRef.current;
      const deltaX = e.clientX - startX;
      
      const length = startRange[1] - startRange[0];
      const shiftPoints = Math.round((deltaX / width) * length);
      
      let newStart = startRange[0] - shiftPoints;
      let newEnd = startRange[1] - shiftPoints;
      
      if (newStart < 0) {
        newEnd -= newStart;
        newStart = 0;
      }
      if (newEnd > maxIndex) {
        newStart -= (newEnd - maxIndex);
        newEnd = maxIndex;
      }
      setZoomRange([Math.max(0, newStart), Math.min(maxIndex, newEnd)]);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) dragRef.current.active = false;
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoomInOut(e.deltaY > 0 ? 0.9 : 1.1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchRef.current = { startDist: dist, startRange: zoomRange || [0, maxIndex] };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const { startDist, startRange } = pinchRef.current;
      const factor = dist / startDist;
      
      const length = startRange[1] - startRange[0];
      if (length <= 1 && factor > 1) return;
      
      const newLength = Math.max(1, Math.round(length / factor));
      const center = startRange[0] + length / 2;
      
      let newStart = Math.round(center - newLength / 2);
      let newEnd = Math.round(center + newLength / 2);
      
      setZoomRange([Math.max(0, newStart), Math.min(maxIndex, newEnd)]);
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  if (data.length === 0) {
    return (
      <div className="chart-empty-state">
        <div className="chart-empty-state__content">
          <span className="chart-empty-state__icon">📊</span>
          <h3>No Chart Data Yet</h3>
          <p>Metrics trends will appear here as data is collected over time.</p>
        </div>
      </div>
    );
  }

  const chartData = currentData.map((snapshot) => ({
    time: formatTime(snapshot.timestamp),
    Active: snapshot.active,
    Completed: snapshot.completed,
    "Vested Amount": snapshot.vested,
  }));

  return (
    <div className="chart-container" style={{ position: "relative" }}>
      <div
        className="chart-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <div style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
          Showing last {visibleMinutes} minutes
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={() => setInteractionMode(prev => prev === "pan" ? "zoom" : "pan")}
            style={{
              padding: "0.25rem 0.5rem",
              backgroundColor: interactionMode === "zoom" ? "#10b981" : "#3b82f6",
              color: "#f9fafb",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
              marginRight: "0.5rem",
            }}
          >
            {interactionMode === "pan" ? "✋ Pan Mode" : "🔍 Zoom Mode"}
          </button>
          <button
            onClick={() => zoomInOut(1.5)}
            style={{
              padding: "0.25rem 0.5rem",
              backgroundColor: "#374151",
              color: "#f9fafb",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Zoom In
          </button>
          <button
            onClick={() => zoomInOut(0.67)}
            style={{
              padding: "0.25rem 0.5rem",
              backgroundColor: "#374151",
              color: "#f9fafb",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Zoom Out
          </button>
          <button
            onClick={() => setZoomRange(null)}
            style={{
              padding: "0.25rem 0.5rem",
              backgroundColor: "#374151",
              color: "#f9fafb",
              borderRadius: "0.25rem",
              fontSize: "0.875rem",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          touchAction: "pan-y",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          onMouseDown={(e: any) => {
            if (interactionMode === "zoom" && e?.activeLabel) setRefAreaLeft(e.activeLabel);
          }}
          onMouseMove={(e: any) => {
            if (interactionMode === "zoom" && refAreaLeft && e?.activeLabel) setRefAreaRight(e.activeLabel);
          }}
          onMouseUp={() => {
            if (interactionMode === "zoom" && refAreaLeft && refAreaRight) {
              const startIndex = currentData.findIndex(d => formatTime(d.timestamp) === refAreaLeft);
              const endIndex = currentData.findIndex(d => formatTime(d.timestamp) === refAreaRight);
              if (startIndex !== -1 && endIndex !== -1) {
                const start = Math.min(startIndex, endIndex);
                const end = Math.max(startIndex, endIndex);
                const currentStart = currentRange[0];
                setZoomRange([Math.max(0, currentStart + start), Math.min(maxIndex, currentStart + end)]);
              }
              setRefAreaLeft(null);
              setRefAreaRight(null);
            } else if (interactionMode === "zoom") {
              setRefAreaLeft(null);
              setRefAreaRight(null);
            }
          }}
        >
          {refAreaLeft && refAreaRight && (
            <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#8b5cf6" />
          )}
          <defs>
            <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorVested" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
          <XAxis
            dataKey="time"
            stroke="#9ca3af"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            tickLine={{ stroke: "#4b5563" }}
          />
          <YAxis
            stroke="#9ca3af"
            tick={{ fill: "#9ca3af", fontSize: 12 }}
            tickLine={{ stroke: "#4b5563" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#f9fafb",
            }}
            labelStyle={{ color: "#d1d5db" }}
          />
          <Legend
            wrapperStyle={{ color: "#d1d5db", fontSize: 14 }}
            iconType="line"
          />
          <Area
            type="monotone"
            dataKey="Active"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colorActive)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="Completed"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorCompleted)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="Vested Amount"
            stroke="#8b5cf6"
            fillOpacity={1}
            fill="url(#colorVested)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
