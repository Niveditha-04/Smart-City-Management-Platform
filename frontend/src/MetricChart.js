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

ChartJS.register(LineElement, PointElement, BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function MetricChart({ title, points = [], color = "rgba(75,192,192,1)" }) {
  const [type, setType] = useState("line"); // line | bar | pie | heatmap

  const labels = useMemo(() => points.map((_, i) => String(i + 1)), [points]);

  const dataLineBar = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: title,
          data: points,
          backgroundColor: color,
          borderColor: color,
        },
      ],
    }),
    [labels, points, color, title]
  );

  const dataPie = useMemo(
    () => ({
      labels,
      datasets: [{ data: points }],
    }),
    [labels, points]
  );

  const maxV = Math.max(1, ...points);
  const heatData = useMemo(
    () => ({
      datasets: [
        {
          label: title || "Heatmap",
          data: points.map((v, i) => ({ x: i, y: 0, v, label: String(i + 1) })),
          // cell width based on chart area width and number of points
          width: (ctx) => {
            const w = ctx.chart.chartArea?.width || 100;
            const n = Math.max(1, points.length);
            return w / n;
          },
          height: 40,
          borderColor: "#1f2b5e",
          backgroundColor: (ctx) => {
            const v = ctx.raw?.v || 0;
            const alpha = Math.max(0.1, Math.min(1, v / maxV));
            return `rgba(16,52,189,${alpha})`;
          },
        },
      ],
    }),
    [points, title, maxV]
  );

  // Only legend color styling; scales are set in MatrixHeatmap
  const commonOptions = {
    plugins: { legend: { labels: { color: "#e8eefc" } } },
    scales: {
      x: { ticks: { color: "#e8eefc" } },
      y: { ticks: { color: "#e8eefc" } },
    },
  };

  return (
    <div style={{ background: "#0f1533", border: "1px solid #273063", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>{title}</strong>
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

      {type === "line" && <Line data={dataLineBar} options={commonOptions} />}
      {type === "bar" && <Bar data={dataLineBar} options={commonOptions} />}
      {type === "pie" && <Pie data={dataPie} options={{ plugins: { legend: { labels: { color: "#e8eefc" } } } }} />}
      {type === "heatmap" && <MatrixHeatmap data={heatData} />}
    </div>
  );
}
