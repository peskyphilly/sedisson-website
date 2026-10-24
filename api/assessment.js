import {
  NOTIFICATION_RECIPIENT,
  ValidationError,
  createSubmissionIdentity,
  getSql,
  parseAssessment,
  recordNotificationResult,
  sendAssessmentNotification
} from "./_assessment.js";

function json(res, status, body) {
  res.status(status).setHeader("Cache-Control", "no-store").json(body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { captured: false, message: "Method not allowed." });
  }

  try {
    if (Number(req.headers["content-length"] || 0) > 100_000) {
      return json(res, 413, { captured: false, message: "The assessment is too large to submit." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (body?.fax_number) return json(res, 200, { captured: true, reference: "received" });

    const payload = parseAssessment(body);
    const idempotencyKey = String(body.idempotencyKey || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
      throw new ValidationError("The submission identifier is invalid. Please reload and try again.");
    }

    const sql = getSql();
    const recent = await sql`
      SELECT count(*)::int AS count
      FROM assessment_submissions
      WHERE lower(contact_email) = lower(${payload.email})
        AND submitted_at > now() - interval '10 minutes'
        AND idempotency_key <> ${idempotencyKey}
    `;
    if ((recent[0]?.count || 0) >= 5) {
      return json(res, 429, { captured: false, message: "Too many recent submissions. Please wait a few minutes and try again." });
    }

    const identity = createSubmissionIdentity();
    const inserted = await sql`
      INSERT INTO assessment_submissions (
        id, reference, idempotency_key, company, contact_name, contact_email,
        payload, notification_recipient
      ) VALUES (
        ${identity.id}::uuid, ${identity.reference}, ${idempotencyKey}, ${payload.company},
        ${payload.name}, ${payload.email}, ${JSON.stringify(payload)}::jsonb, ${NOTIFICATION_RECIPIENT}
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id, reference, payload, notification_status
    `;

    const rows = inserted.length ? inserted : await sql`
      SELECT id, reference, payload, notification_status
      FROM assessment_submissions
      WHERE idempotency_key = ${idempotencyKey}
      LIMIT 1
    `;
    const submission = rows[0];
    if (!submission) throw new Error("The submission could not be confirmed after storage.");

    if (submission.notification_status !== "sent") {
      try {
        const notification = await sendAssessmentNotification(submission);
        await recordNotificationResult(sql, submission.id, notification);
      } catch (error) {
        await recordNotificationResult(sql, submission.id, { status: "failed", error: error.message });
      }
    }

    return json(res, inserted.length ? 201 : 200, {
      captured: true,
      reference: submission.reference,
      message: "Your assessment has been stored securely."
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return json(res, 400, { captured: false, message: "The submitted assessment is not valid." });
    }
    const status = error.statusCode || 500;
    if (status === 500) console.error("Assessment submission failed", error);
    return json(res, status, {
      captured: false,
      message: status === 500 ? "We could not store your assessment. Your answers remain in this browser; please try again." : error.message
    });
  }
}
