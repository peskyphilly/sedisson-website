import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const NOTIFICATION_RECIPIENT = process.env.ASSESSMENT_NOTIFY_TO || "support@sedisson.co.uk";

const limits = {
  company: 180,
  website: 500,
  industry: 180,
  country: 120,
  employees: 40,
  "business-stage": 120,
  funding: 80,
  description: 5000,
  problem: 5000,
  customer: 5000,
  "deal-size": 120,
  "sales-cycle": 80,
  constraint: 5000,
  priority: 5000,
  markets: 3000,
  objectives: 5000,
  success: 5000,
  name: 180,
  role: 180,
  email: 320,
  phone: 80,
  linkedin: 500,
  "contact-method": 80,
  consent: 20
};

const required = [
  "company", "website", "industry", "country", "employees", "business-stage",
  "description", "problem", "customer", "constraint", "priority",
  "objectives", "success", "name", "role", "email", "consent"
];

function cleanString(value, maxLength) {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}

function cleanList(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(list.map(item => cleanString(item, 120)).filter(Boolean))].slice(0, 20);
}

function normaliseWebUrl(value, label) {
  if (!value) return "";
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    const hostLooksPublic = url.hostname.includes(".") || /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname);
    if (!/^https?:$/.test(url.protocol) || !hostLooksPublic || url.username || url.password) throw new Error();
    return url.href;
  } catch {
    throw new ValidationError(`Please enter a valid ${label}, such as example.com.`);
  }
}

export function parseAssessment(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("The submitted assessment is not valid.");
  }

  const payload = {};
  Object.entries(limits).forEach(([key, maxLength]) => {
    payload[key] = cleanString(input[key], maxLength);
  });
  payload.channels = cleanList(input.channels);
  payload.assets = cleanList(input.assets);
  payload.website = normaliseWebUrl(payload.website, "website address");
  payload.linkedin = normaliseWebUrl(payload.linkedin, "LinkedIn profile");

  const missing = required.filter(key => !payload[key]);
  if (missing.length) throw new ValidationError("Please complete every required field.");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new ValidationError("Please enter a valid business email address.");
  }

  if (payload.consent !== "accepted") {
    throw new ValidationError("Consent is required before submitting the assessment.");
  }

  return payload;
}

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 400;
  }
}

export function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("Submission storage is not configured.");
  return neon(process.env.DATABASE_URL);
}

export function createSubmissionIdentity() {
  const id = randomUUID();
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return { id, reference: `SED-${date}-${id.slice(0, 8).toUpperCase()}` };
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[character]));
}

function row(label, value) {
  const display = Array.isArray(value) ? value.join(", ") : value || "Not provided";
  return `<tr><th style="padding:10px 14px;text-align:left;vertical-align:top;border-bottom:1px solid #e4e0d7;color:#17324d;width:185px">${escapeHtml(label)}</th><td style="padding:10px 14px;border-bottom:1px solid #e4e0d7;white-space:pre-wrap">${escapeHtml(display)}</td></tr>`;
}

export async function sendAssessmentNotification(submission) {
  if (!process.env.RESEND_API_KEY || !process.env.ASSESSMENT_FROM_EMAIL) {
    return { status: "pending", error: "Email delivery is not configured yet." };
  }

  const p = submission.payload;
  const fields = [
    ["Reference", submission.reference], ["Company", p.company], ["Website", p.website],
    ["Industry", p.industry], ["Country", p.country], ["Employees", p.employees],
    ["Business stage", p["business-stage"] || p.funding], ["What the company does", p.description],
    ["What clients rely on it for", p.problem], ["Priority customers or clients", p.customer], ["Typical contract or purchase value", p["deal-size"]],
    ["Typical decision or sales cycle", p["sales-cycle"]], ["Current channels", p.channels], ["Commercial assets", p.assets],
    ["Constraint on commercial progress", p.constraint], ["Immediate priority", p.priority], ["Markets, customer groups or regions", p.markets],
    ["12-month objectives", p.objectives], ["Definition of success", p.success], ["Contact name", p.name],
    ["Role", p.role], ["Email", p.email], ["Phone", p.phone], ["LinkedIn", p.linkedin],
    ["Preferred contact method", p["contact-method"]]
  ];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `assessment/${submission.id}`
    },
    body: JSON.stringify({
      from: process.env.ASSESSMENT_FROM_EMAIL,
      to: [NOTIFICATION_RECIPIENT],
      reply_to: p.email,
      subject: `New commercial assessment — ${p.company} (${submission.reference})`,
      html: `<div style="font-family:Arial,sans-serif;color:#26384a;max-width:760px"><h1 style="color:#0d2c49">New commercial assessment</h1><p>A new assessment has been stored successfully. Replying to this email will reply directly to ${escapeHtml(p.name)}.</p><table style="width:100%;border-collapse:collapse">${fields.map(([label, value]) => row(label, value)).join("")}</table></div>`
    })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { status: "failed", error: result.message || `Resend returned HTTP ${response.status}.` };
  }
  return { status: "sent", providerId: result.id };
}

export async function recordNotificationResult(sql, submissionId, result) {
  const error = result.error ? String(result.error).slice(0, 1000) : null;
  const providerId = result.providerId || null;
  await sql`
    UPDATE assessment_submissions
    SET notification_status = ${result.status},
        notification_attempts = notification_attempts + CASE WHEN ${result.status} = 'pending' THEN 0 ELSE 1 END,
        notification_provider_id = COALESCE(${providerId}, notification_provider_id),
        notification_last_error = ${error},
        notification_last_attempt_at = CASE WHEN ${result.status} = 'pending' THEN notification_last_attempt_at ELSE now() END,
        notified_at = CASE WHEN ${result.status} = 'sent' THEN now() ELSE notified_at END
    WHERE id = ${submissionId}::uuid
  `;
}
