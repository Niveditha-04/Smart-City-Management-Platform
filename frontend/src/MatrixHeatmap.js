import React, { useMemo } from "react";
import { Chart as ChartJS, LinearScale, Tooltip, Legend } from "chart.js";
import { Chart } from "react-chartjs-2";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix"; // <-- ESM import

// Register everything once
ChartJS.register(LinearScale, Tooltip, Legend, MatrixController, MatrixElement);

export default function MatrixHeatmap({ data, options }) {
  const defaultOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 20 }, // padding on all sides
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true },
      },
      // single-row heatmap; hide axes, keep y centered on 0
      scales: {
        x: { type: "linear", grid: { display: false }, ticks: { display: false } },
        y: { type: "linear", grid: { display: false }, ticks: { display: false }, min: -0.5, max: 0.5 },
      },
    }),
    []
  );

  const mergedOptions = useMemo(() => {
    const o = { ...(options || {}) };
    // ensure we always have padding for size calculations
    o.layout = { padding: 20, ...(o.layout || {}) };
    return {
      ...defaultOptions,
      ...o,
      layout: { ...(defaultOptions.layout || {}), ...(o.layout || {}) },
      plugins: { ...(defaultOptions.plugins || {}), ...(o.plugins || {}) },
      scales: {
        ...(defaultOptions.scales || {}),
        ...(o.scales || {}),
        x: { ...((defaultOptions.scales && defaultOptions.scales.x) || {}), ...((o.scales && o.scales.x) || {}) },
        y: { ...((defaultOptions.scales && defaultOptions.scales.y) || {}), ...((o.scales && o.scales.y) || {}) },
      },
    };
  }, [options, defaultOptions]);

  // Ensure cells fill chartArea minus padding
  const computedData = useMemo(() => {
    const ds = (data?.datasets || []).map((d) => ({
      ...d,
      width:
        d.width ||
        ((ctx) => {
          const ca = ctx.chart?.chartArea;
          if (!ca) return 20;
          const p = mergedOptions.layout?.padding || 0;
          const left = typeof p === "number" ? p : p.left || 0;
          const right = typeof p === "number" ? p : p.right || 0;
          const available = ca.width - left - right;
          const n = Math.max(1, d.data?.length || 1);
          return available / n;
        }),
      height:
        d.height ||
        ((ctx) => {
          const ca = ctx.chart?.chartArea;
          if (!ca) return 40;
          const p = mergedOptions.layout?.padding || 0;
          const top = typeof p === "number" ? p : p.top || 0;
          const bottom = typeof p === "number" ? p : p.bottom || 0;
          const available = ca.height - top - bottom;
          return available; // single row fills height
        }),
    }));
    return { ...(data || {}), datasets: ds };
  }, [data, mergedOptions]);

  return (
    <Chart
      type="matrix"
      data={computedData}
      options={mergedOptions}
      datasetIdKey="id"
      style={{ height: "100%", width: "100%" }}
    />
  );
}
