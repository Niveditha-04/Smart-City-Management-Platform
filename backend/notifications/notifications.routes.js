// backend/notifications/notifications.routes.js
const express = require("express");
const router = express.Router();
const {
  VAPID_PUBLIC_KEY,
  saveSubscription,
  notifyAllChannels,
} = require("./notification.service");

// GET public VAPID key
router.get("/vapid-public-key", (_req, res) => {
  res.json({ key: VAPID_PUBLIC_KEY });
});

// POST subscribe
router.post("/subscribe", (req, res) => {
  const { userId, subscription } = req.body || {};
  if (!userId || !subscription) return res.status(400).json({ ok:false, message:"userId & subscription required" });
  saveSubscription(userId, subscription);
  res.json({ ok: true });
});

// POST notify
router.post("/notify", async (req, res) => {
  const { userId, email, phone, title, body, data } = req.body || {};
  if (!userId || !title || !body) return res.status(400).json({ ok:false, message:"userId, title, body required" });
  try {
    const result = await notifyAllChannels({ userId, email, phone }, { title, body, data });
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
});

module.exports = router;
