-- Preserve existing interview records while moving provider metadata to Jitsi.
ALTER TABLE interview_sessions RENAME COLUMN daily_room_name TO jitsi_room_name;
ALTER TABLE interview_sessions RENAME COLUMN daily_room_url TO jitsi_room_url;
ALTER TABLE interview_sessions DROP COLUMN IF EXISTS daily_room_config;
ALTER TABLE interview_sessions ADD COLUMN IF NOT EXISTS meeting_provider VARCHAR(32) NOT NULL DEFAULT 'jitsi';

ALTER TABLE interview_recordings RENAME COLUMN daily_recording_id TO provider_recording_id;
