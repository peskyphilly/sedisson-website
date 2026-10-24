CREATE TABLE IF NOT EXISTS assessment_submissions (
  id uuid PRIMARY KEY,
  reference text UNIQUE NOT NULL,
  idempotency_key text UNIQUE NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  company text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  payload jsonb NOT NULL,
  notification_recipient text NOT NULL,
  notification_status text NOT NULL DEFAULT 'pending'
    CHECK (notification_status IN ('pending', 'sent', 'failed')),
  notification_attempts integer NOT NULL DEFAULT 0,
  notification_provider_id text,
  notification_last_error text,
  notification_last_attempt_at timestamptz,
  notified_at timestamptz
);

CREATE INDEX IF NOT EXISTS assessment_submissions_submitted_at_idx
  ON assessment_submissions (submitted_at DESC);

CREATE INDEX IF NOT EXISTS assessment_submissions_notification_queue_idx
  ON assessment_submissions (notification_status, notification_last_attempt_at)
  WHERE notification_status <> 'sent';

