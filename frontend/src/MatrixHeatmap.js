// src/MatrixHeatmap.js
import React, { useEffect, useRef } from "react";
import { Chart, LinearScale, CategoryScale, Tooltip, Legend } from "chart.js";
import { MatrixController, MatrixElement } from "chartjs-chart-matrix";

// IMPORTANT: register matrix pieces + scales + plugins (Chart.js v4)
Chart.register(MatrixController, MatrixElement, LinearScale, CategoryScale, Tooltip, Legend);

export default function MatrixHeatmap({ data, options }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");

    // Ensure defaults for linear scales (matrix expects numeric axes)
    const mergedOptions = {
      scales: {
        x: { type: "linear", ticks: { display: false }, grid: { display: false } },
        y: { type: "linear", display: false }
      },
      plugins: { legend: { display: false } },
      ...(options || {}),
    };

    const chart = new Chart(ctx, { type: "matrix", data, options: mergedOptions });
    return () => chart.destroy();
  }, [data, options]);

  return <canvas ref={canvasRef} />;
}
