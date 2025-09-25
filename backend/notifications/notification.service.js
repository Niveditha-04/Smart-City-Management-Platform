// backend/notifications/notification.service.js
const webpush = require("web-push");
const twilio = require("twilio");
const { Resend } = require("resend");

// ---------- Web Push (VAPID) ----------
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@example.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

const subscriptions = new Map(); // userId -> subscription
function saveSubscription(userId, sub) {
  subscriptions.set(String(userId), sub);
}
function getSubscription(userId) {
  return subscriptions.get(String(userId));
}

async function sendWebPush(sub, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error("VAPID keys missing");
  }
  return webpush.sendNotification(sub, JSON.stringify(payload));
}

// ---------- Twilio SMS ----------
const sid = process.env.TWILIO_ACCOUNT_SID || "";
const token = process.env.TWILIO_AUTH_TOKEN || "";
const fromPhone = process.env.TWILIO_FROM_NUMBER || "";
const twilioClient = sid && token ? twilio(sid, token) : null;

async function sendSMS(to, body) {
  if (!twilioClient) throw new Error("Twilio not configured");
  return twilioClient.messages.create({ from: fromPhone, to, body });
}

// ---------- Email via Resend (API-only) ----------
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "Smart City <no-reply@customizedsoftwares.com>"; // e.g. "no-reply@customizedsoftwares.com"
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/**
 * Send email using Resend
 * @param {string|string[]} to - recipient(s)
 * @param {string} subject
 * @param {string} html
 * @param {string} text
 */
async function sendEmail(to, subject, html, text) {
  if (!resend) throw new Error("Resend not configured");
  if (!RESEND_FROM) throw new Error("RESEND_FROM missing");
  // Resend requires the From to be on a verified domain/sender
  const { data, error } = await resend.emails.send({
    from: RESEND_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  });
  if (error) throw new Error(`ResendError: ${error.message || String(error)}`);
  return data;
}

// ---------- Notify across channels ----------
async function notifyAllChannels({ userId, email, phone }, payload) {
  const out = {};
  try {
    const sub = getSubscription(userId);
    if (sub) {
      await sendWebPush(sub, {
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
      });
      out.push = "ok";
    } else {
      out.push = "no-subscription";
    }
  } catch (e) {
    out.push = String(e.message || e);
  }

  try {
    if (phone) {
      await sendSMS(phone, `${payload.title}: ${payload.body}`);
      out.sms = "ok";
    } else {
      out.sms = "no-phone";
    }
  } catch (e) {
    out.sms = String(e.message || e);
  }

  try {
    if (email) {
      await sendEmail(
        email,
        payload.title,
        `<p>${payload.body}</p>`,
        payload.body
      );
      out.email = "ok";
    } else {
      out.email = "no-email";
    }
  } catch (e) {
    out.email = String(e.message || e);
  }

  return out;
}

module.exports = {
  VAPID_PUBLIC_KEY,
  saveSubscription,
  getSubscription,
  sendWebPush,
  sendSMS,
  sendEmail,
  notifyAllChannels,
};
