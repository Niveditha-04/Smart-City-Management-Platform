// backend/routes/breaches.js
const express = require("express");
const router = express.Router();

// In-memory dummy breaches list
let breaches = [
  { id: 1, severity: "critical", metric: "traffic", message: "Heavy congestion on Highway", created_at: new Date() },
  { id: 2, severity: "medium", metric: "power", message: "Voltage fluctuation detected", created_at: new Date() }
];

// GET active breaches
router.get("/", (req, res) => {
  res.json({ breaches });
});

// ACK breach
router.post("/:id/ack", (req, res) => {
  const id = parseInt(req.params.id, 10);
  breaches = breaches.filter(b => b.id !== id);
  res.json({ ok: true });
});

module.exports = router;
