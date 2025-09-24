import React, { useMemo } from "react";

function mean(arr) {
  if (!arr?.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
function stdev(arr) {
  if (!arr?.length) return 0;
  const m = mean(arr);
  const v = mean(arr.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}
function slope(arr) {
  const n = arr?.length || 0;
  if (n < 2) return 0;
  const xs = Array.from({ length: n }, (_, i) => i + 1);
  const xBar = mean(xs);
  const yBar = mean(arr);
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xBar) * (arr[i] - yBar);
    den += (xs[i] - xBar) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function analyzeMetric(name, points, opts) {
  const safe = Array.isArray(points) ? points : [];
  const latest = safe.at(-1);
  const avg = mean(safe);
  const sd = stdev(safe);
  const mSlope = slope(safe);

  const { anomalyHigh, anomalyLow } = opts || {};
  const hi = anomalyHigh ?? Infinity;
  const lo = anomalyLow ?? -Infinity;

  const z = sd ? (latest - avg) / sd : 0;
  const isHigh = latest !== undefined && latest > hi;
  const isLow = latest !== undefined && latest < lo;
  const isZHigh = z >= 2;
  const isZLow = z <= -2;

  let status = "normal";
  if (isHigh || isZHigh) status = "high";
  if (isLow || isZLow) status = "low";

  // Basic recommendations
  let rec = "No action needed.";
  if (name === "Traffic") {
    if (status === "high" || mSlope > 0.5) {
      rec = "Enable green-wave signal timing on congested corridors; notify traffic control.";
    } else if (status === "low" && mSlope < -0.5) {
      rec = "Traffic easing—restore normal signal cycles.";
    }
  } else if (name === "Air Quality") {
    if (status === "high" || mSlope > 0.5) {
      rec = "Issue air-quality advisory; reduce construction/diesel activity; prioritize green routes.";
    } else if (status === "low") {
      rec = "AQI improving—maintain routine monitoring.";
    }
  } else if (name === "Waste") {
    if (status === "high" || mSlope > 0.5) {
      rec = "Dispatch collection to hotspots; rebalance truck routes.";
    } else if (status === "low") {
      rec = "Waste levels stable—optimize routes for fuel savings.";
    }
  } else if (name === "Electricity") {
    if (status === "high" || mSlope > 0.5) {
      rec = "Shift non-critical loads; request demand response from large consumers.";
    } else if (status === "low") {
      rec = "Grid stable—maintain current supply plan.";
    }
  }

  return {
    latest,
    avg: Number(avg.toFixed(1)),
    sd: Number(sd.toFixed(1)),
    slope: Number(mSlope.toFixed(2)),
    z: Number(z.toFixed(2)),
    status,
    recommendation: rec,
  };
}

const limits = {
  traffic: { anomalyHigh: 140 },
  air: { anomalyHigh: 150 },
  waste: { anomalyHigh: 80 },
  power: { anomalyHigh: 500 },
};

export default function Recommendations({
  traffic = [],
  air = [],
  waste = [],
  power = [],
}) {
  const trafficA = useMemo(() => analyzeMetric("Traffic", traffic, limits.traffic), [traffic]);
  const airA = useMemo(() => analyzeMetric("Air Quality", air, limits.air), [air]);
  const wasteA = useMemo(() => analyzeMetric("Waste", waste, limits.waste), [waste]);
  const powerA = useMemo(() => analyzeMetric("Electricity", power, limits.power), [power]);

  const card = {
    wrap: {
      border: "1px solid #eee",
      borderRadius: 12,
      padding: 16,
      boxShadow: "0 6px 16px rgba(0,0,0,0.04)",
      background: "#fff",
    },
    title: { margin: "0 0 6px 0", fontWeight: 700 },
    row: { display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, margin: "4px 0" },
    label: { color: "#666" },
    value: { fontWeight: 600 },
    rec: { marginTop: 8 },
    status: (s) => ({
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      color: s === "high" ? "#B00020" : s === "low" ? "#0E7490" : "#2563EB",
      background:
        s === "high" ? "#FFE1E1" : s === "low" ? "#E0F2FE" : "#E5ECFF",
    }),
  };

  const items = [
    ["Traffic", trafficA],
    ["Air Quality", airA],
    ["Waste", wasteA],
    ["Electricity", powerA],
  ];

  return (
    <div style={{ marginTop: 36 }}>
      <h3>Analytics & Recommendations</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
        {items.map(([name, a]) => (
          <div key={name} style={card.wrap}>
            <h4 style={card.title}>
              {name} <span style={card.status(a.status)}>{a.status.toUpperCase()}</span>
            </h4>
            <div style={card.row}><span style={card.label}>Latest</span><span style={card.value}>{a.latest ?? "—"}</span></div>
            <div style={card.row}><span style={card.label}>Avg (n)</span><span style={card.value}>{a.avg}</span></div>
            <div style={card.row}><span style={card.label}>Std Dev</span><span style={card.value}>{a.sd}</span></div>
            <div style={card.row}><span style={card.label}>Trend slope</span><span style={card.value}>{a.slope}</span></div>
            <div style={card.row}><span style={card.label}>Z-score</span><span style={card.value}>{a.z}</span></div>
            <div style={card.rec}><strong>Recommendation:</strong> {a.recommendation}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
