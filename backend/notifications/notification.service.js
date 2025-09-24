// backend/notifications/notification.service.js
const webpush = require("web-push");
const twilio = require("twilio");
const nodemailer = require("nodemailer");

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails("mailto:admin@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const subscriptions = new Map(); // userId -> subscription

function saveSubscription(userId, sub) {
  subscriptions.set(String(userId), sub);
}
function getSubscription(userId) {
  return subscriptions.get(String(userId));
}

async function sendWebPush(sub, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("VAPID keys missing");
  return webpush.sendNotification(sub, JSON.stringify(payload));
}

// Twilio
const sid = process.env.TWILIO_ACCOUNT_SID || "";
const token = process.env.TWILIO_AUTH_TOKEN || "";
const fromPhone = process.env.TWILIO_FROM_NUMBER || "";
const twilioClient = (sid && token) ? twilio(sid, token) : null;

async function sendSMS(to, body) {
  if (!twilioClient) throw new Error("Twilio not configured");
  return twilioClient.messages.create({ from: fromPhone, to, body });
}

// Email (Nodemailer)
const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || "false") === "true";
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const emailFrom = process.env.EMAIL_FROM || "Smart City Alerts <no-reply@example.com>";

const transporter = (smtpHost && smtpUser && smtpPass) ? nodemailer.createTransport({
  host: smtpHost, port: smtpPort, secure: smtpSecure, auth: { user: smtpUser, pass: smtpPass }
}) : null;

async function sendEmail(to, subject, html, text) {
  if (!transporter) throw new Error("Email not configured");
  return transporter.sendMail({ from: emailFrom, to, subject, html, text });
}

async function notifyAllChannels({ userId, email, phone }, payload) {
  const out = {};
  try {
    const sub = getSubscription(userId);
    if (sub) {
      await sendWebPush(sub, { title: payload.title, body: payload.body, data: payload.data || {} });
      out.push = "ok";
    } else out.push = "no-subscription";
  } catch (e) { out.push = String(e); }
  try {
    if (phone) { await sendSMS(phone, `${payload.title}: ${payload.body}`); out.sms = "ok"; }
  } catch (e) { out.sms = String(e); }
  try {
    if (email) {
      await sendEmail(email, payload.title, `<p>${payload.body}</p>`, payload.body);
      out.email = "ok";
    }
  } catch (e) { out.email = String(e); }
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
