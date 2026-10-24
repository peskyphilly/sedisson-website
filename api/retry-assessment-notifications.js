import { getSql, recordNotificationResult, sendAssessmentNotification } from "./_assessment.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false });
  }

  const sql = getSql();
  const pending = await sql`
    SELECT id, reference, payload, notification_status
    FROM assessment_submissions
    WHERE notification_status <> 'sent'
      AND notification_attempts < 10
      AND (notification_last_attempt_at IS NULL OR notification_last_attempt_at < now() - interval '30 minutes')
    ORDER BY submitted_at ASC
    LIMIT 25
  `;

  let sent = 0;
  for (const submission of pending) {
    try {
      const result = await sendAssessmentNotification(submission);
      await recordNotificationResult(sql, submission.id, result);
      if (result.status === "sent") sent += 1;
    } catch (error) {
      await recordNotificationResult(sql, submission.id, { status: "failed", error: error.message });
    }
  }

  return res.status(200).json({ ok: true, checked: pending.length, sent });
}
