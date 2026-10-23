-- Run explicitly before deploying the invitation-only OAuth flow.
CREATE TABLE IF NOT EXISTS youtube_oauth_invitations (
  token_hash CHAR(64) PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
