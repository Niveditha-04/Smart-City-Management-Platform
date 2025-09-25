import React, { useEffect, useState } from "react";
import MatrixHeatmap from "./MatrixHeatmap";
import axios from "axios";
import { FaCar, FaLeaf, FaTrash, FaBolt } from "react-icons/fa";
import MetricChart from "./MetricChart";
import Recommendations from "./Recommendations";

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [live, setLive] = useState(true);

  const [trafficH, setTrafficH] = useState([]);
  const [airH, setAirH] = useState([]);
  const [wasteH, setWasteH] = useState([]);
  const [powerH, setPowerH] = useState([]);

  const load = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/metrics/summary`);
      const m = res.data;
      setMetrics(m);
      setLastUpdated(new Date().toLocaleTimeString());
      setError("");

      const keep10 = (arr) => arr.slice(-10);
      setTrafficH((p = []) => keep10([...p, m.traffic]));
      setAirH((p = []) => keep10([...p, m.airQuality]));
      setWasteH((p = []) => keep10([...p, m.waste]));
      setPowerH((p = []) => keep10([...p, m.electricity]));
    } catch {
      setError("Failed to load metrics");
    }
  };

  useEffect(() => {
    load(); // initial
    if (!live) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [live]);

  if (error) return <p style={{ color: "red", textAlign: "center" }}>{error}</p>;
  if (!metrics) return <p style={{ textAlign: "center" }}>Loading metrics...</p>;

  const card = {
    base: {
      borderRadius: 12,
      padding: 20,
      display: "flex",
      alignItems: "center",
      gap: 16,
      boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
      color: "#111",
    },
    title: { margin: 0, fontSize: 16, fontWeight: 600 },
    value: { margin: 0, fontSize: 28, fontWeight: 700 },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 10,
      display: "grid",
      placeItems: "center",
      background: "rgba(255,255,255,0.4)",
    },
  };

  return (
    <div style={{ maxWidth: 1100, margin: "80px auto", padding: "0 16px" }}>
      <h2 style={{ textAlign: "center", marginBottom: 8 }}>SmartCity Dashboard</h2>
      <p style={{ textAlign: "center", marginTop: 0, color: "#666" }}>
        Last updated: {lastUpdated || "—"}{" "}
        |{" "}
        <button onClick={() => setLive(!live)}>
          {live ? "⏸ Pause Live" : "▶ Resume Live"}
        </button>
      </p>

      {/* metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
        }}
      >
        <div style={{ ...card.base, background: "linear-gradient(135deg,#e0f2ff,#b3e5ff)" }}>
          <div style={card.iconWrap}><FaCar size={22} /></div>
          <div>
            <p style={card.title}>Traffic</p>
            <p style={card.value}>{metrics.traffic}</p>
          </div>
        </div>

        <div style={{ ...card.base, background: "linear-gradient(135deg,#e3f9e5,#b7efc5)" }}>
          <div style={card.iconWrap}><FaLeaf size={22} /></div>
          <div>
            <p style={card.title}>Air Quality</p>
            <p style={card.value}>{metrics.airQuality}</p>
          </div>
        </div>

        <div style={{ ...card.base, background: "linear-gradient(135deg,#fff4e5,#ffd6a5)" }}>
          <div style={card.iconWrap}><FaTrash size={22} /></div>
          <div>
            <p style={card.title}>Waste</p>
            <p style={card.value}>{metrics.waste}</p>
          </div>
        </div>

        <div style={{ ...card.base, background: "linear-gradient(135deg,#efe5ff,#d5c2ff)" }}>
          <div style={card.iconWrap}><FaBolt size={22} /></div>
          <div>
            <p style={card.title}>Electricity</p>
            <p style={card.value}>{metrics.electricity}</p>
          </div>
        </div>
      </div>

      {/* charts */}
      <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr", gap: 36 }}>
        <div>
          <h3>Traffic Trend (last 10 updates)</h3>
          <MetricChart title="Traffic" points={trafficH} color="rgba(13, 148, 136, 1)" />
        </div>
        <div>
          <h3>Air Quality Trend</h3>
          <MetricChart title="Air Quality" points={airH} color="rgba(16, 185, 129, 1)" />
        </div>
        <div>
          <h3>Waste Trend</h3>
          <MetricChart title="Waste" points={wasteH} color="rgba(245, 158, 11, 1)" />
        </div>
        <div>
          <h3>Electricity Trend</h3>
          <MetricChart title="Electricity" points={powerH} color="rgba(139, 92, 246, 1)" />
        </div>
      </div>

      {/* analytics + recommendations */}
      <Recommendations
        traffic={trafficH}
        air={airH}
        waste={wasteH}
        power={powerH}
      />
    </div>
  );
}


/* Heatmap container appended */
export function HeatmapSection({ matrixData }){
  return (
    <div style={{ width: "100%", height: 360, padding: 12, border: "1px solid #eee", borderRadius: 12, boxSizing: "border-box" }}>
      <MatrixHeatmap data={matrixData.data} options={matrixData.options} padding={12} />
    </div>
  );
}
