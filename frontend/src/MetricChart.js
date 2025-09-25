import React, { useMemo, useState } from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Line, Bar, Pie } from "react-chartjs-2";
import MatrixHeatmap from "./MatrixHeatmap";

ChartJS.register(
  LineElement,
  PointElement,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
);

// ----- Pie slice palette -----
const PIE_COLORS = [
  "#1034BD", "#2E8AE6", "#52B0F2", "#7CD3FF", "#A6E4FF",
  "#4BC0C0", "#A78BFA", "#F59E0B", "#EF4444", "#10B981",
];

const CHART_HEIGHT = 240; // fixed height for all charts

// ----- Simple linear regression (y = a + b x) over indices x=0..n-1 -----
function linearRegression(yArr) {
  const y = Array.isArray(yArr) ? yArr.map(Number).filter((v) => Number.isFinite(v)) : [];
  const n = y.length;
  if (n < 2) {
    return { yhat: null, a: 0, b: 0, r2: 0 };
  }
  // x are indices
  const x = y.map((_, i) => i);
  const sumX = x.reduce((s, v) => s + v, 0);
  const sumY = y.reduce((s, v) => s + v, 0);
  const sumXY = y.reduce((s, v, i) => s + i * v, 0);
  const sumX2 = x.reduce((s, v) => s + v * v, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { yhat: null, a: 0, b: 0, r2: 0 };

  const b = (n * sumXY - sumX * sumY) / denom; // slope
  const a = (sumY - b * sumX) / n;             // intercept

  const yhat = x.map((xi) => a + b * xi);

  // R^2 for info (not displayed unless you want)
  const meanY = sumY / n;
  const ssTot = y.reduce((s, yi) => s + (yi - meanY) ** 2, 0);
  const ssRes = y.reduce((s, yi, i) => s + (yi - yhat[i]) ** 2, 0);
  const r2 = ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);

  return { yhat, a, b, r2 };
}

export default function MetricChart({ title, points = [], color = "rgba(75,192,192,1)" }) {
  const [type, setType] = useState("line"); // line | bar | pie | heatmap

  const safePoints = Array.isArray(points) ? points.map((v) => (Number.isFinite(+v) ? +v : 0)) : [];
  const labels = useMemo(() => safePoints.map((_, i) => String(i + 1)), [safePoints]);

  // ----- Stable common options (prevents resize on data updates) -----
  const commonOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false, // wrapper div controls height
      animation: { duration: 250 },
      plugins: { legend: { labels: { color: "#e8eefc" } } },
      scales: {
        x: { ticks: { color: "#e8eefc" }, grid: { color: "rgba(232,238,252,0.08)" } },
        y: { ticks: { color: "#e8eefc" }, grid: { color: "rgba(232,238,252,0.08)" } },
      },
    }),
    []
  );

  // ----- Regression line (same length as labels) -----
  const trend = useMemo(() => {
    const { yhat, r2 } = linearRegression(safePoints);
    if (!yhat) return null;
    return { yhat, r2 };
  }, [safePoints]);

  // ----- Line/Bar data with regression overlay -----
  const dataLineBar = useMemo(() => {
    const base = {
      labels,
      datasets: [
        {
          id: "metric-series",
          label: title || "Series",
          data: safePoints,
          backgroundColor: color,
          borderColor: color,
        },
      ],
    };
    if (trend?.yhat) {
      base.datasets.push({
        id: "metric-trend",
        label: `Trend (linear)`,
        data: trend.yhat,
        type: "line",             // for Bar chart: overlay as line
        borderColor: "#FFD166",
        backgroundColor: "#FFD166",
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0,               // straight regression line
      });
    }
    return base;
  }, [labels, safePoints, color, title, trend]);

  // ----- Pie -----
  const dataPie = useMemo(
    () => ({
      labels,
      datasets: [
        {
          id: "metric-pie",
          data: safePoints,
          backgroundColor: PIE_COLORS.slice(0, Math.max(safePoints.length, 1)),
          borderColor: "#0f1533",
          borderWidth: 1,
        },
      ],
    }),
    [labels, safePoints]
  );

  // ----- Heatmap (single row), cells fill area inside padding -----
  const maxV = Math.max(1, ...safePoints);
  const heatData = useMemo(
    () => ({
      datasets: [
        {
          id: "metric-heat",
          label: title || "Heatmap",
          data: safePoints.map((v, i) => ({ x: i, y: 0, v, label: String(i + 1) })),
          borderColor: "#1f2b5e",
          backgroundColor: (ctx) => {
            const v = ctx.raw?.v || 0;
            const alpha = Math.max(0.1, Math.min(1, v / maxV));
            return `rgba(16,52,189,${alpha})`;
          },
        },
      ],
    }),
    [safePoints, title, maxV]
  );

  const heatmapOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 20 },
      plugins: {
        legend: { labels: { color: "#e8eefc" } },
        tooltip: { enabled: true },
      },
      scales: {
        x: { grid: { display: false }, ticks: { display: false } },
        y: { grid: { display: false }, ticks: { display: false }, min: -0.5, max: 0.5 },
      },
    }),
    []
  );

  return (
    <div style={{ background: "#0f1533", border: "1px solid #273063", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ color: "#e8eefc" }}>{title}</strong>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ background: "#0e1534", color: "#e8eefc", border: "1px solid #2a366b", borderRadius: 8, padding: "4px 8px" }}
        >
          <option value="line">Trend line</option>
          <option value="bar">Bar</option>
          <option value="pie">Pie</option>
          <option value="heatmap">Heatmap</option>
        </select>
      </div>

      {type === "line" && (
        <div style={{ height: CHART_HEIGHT }}>
          <Line data={dataLineBar} options={commonOptions} datasetIdKey="id" />
        </div>
      )}

      {type === "bar" && (
        <div style={{ height: CHART_HEIGHT }}>
          <Bar data={dataLineBar} options={commonOptions} datasetIdKey="id" />
        </div>
      )}

      {type === "pie" && (
        <div style={{ height: CHART_HEIGHT, width: "50%", margin: "0 auto" }}>
          <Pie data={dataPie} options={{ ...commonOptions, scales: undefined }} datasetIdKey="id" />
        </div>
      )}

      {type === "heatmap" && (
        <div style={{ height: CHART_HEIGHT }}>
          <MatrixHeatmap data={heatData} options={heatmapOptions} />
        </div>
      )}
    </div>
  );
}
