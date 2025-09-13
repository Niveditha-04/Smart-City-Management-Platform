import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

export default function MetricChart({ title, points = [], color = "rgba(75,192,192,1)" }) {
  const safe = Array.isArray(points) && points.length ? points : [0];

  const data = {
    labels: safe.map((_, i) => `T${i + 1}`),
    datasets: [
      {
        label: title,
        data: safe,
        borderColor: color,
        backgroundColor: color.replace("1)", "0.18)"), 
        tension: 0.3,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { display: true, position: "bottom" } },
    scales: { y: { beginAtZero: true } },
  };

  return <Line data={data} options={options} />;
}
