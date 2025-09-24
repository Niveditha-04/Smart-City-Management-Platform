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

export default function TrafficChart({ dataPoints = [] }) {
  const safe = Array.isArray(dataPoints) && dataPoints.length ? dataPoints : [0];

  const data = {
    labels: safe.map((_, i) => `T${i + 1}`),
    datasets: [
      {
        label: "Traffic Flow",
        data: safe,
        borderColor: "rgba(13, 148, 136, 1)",     
        backgroundColor: "rgba(13, 148, 136, 0.18)", 
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
