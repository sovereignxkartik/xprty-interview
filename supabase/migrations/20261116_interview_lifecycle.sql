-- Durable candidate-attempt tracking supports the missed vs. already-attempted
-- decision after a session's scheduled end. Feedback already has a one-to-one
-- session constraint, so it is safely upserted by the application.
alter table public.interview_sessions
  add column if not exists candidate_attempted_at timestamptz;

create index if not exists sessions_candidate_attempt_idx
  on public.interview_sessions(candidate_id, candidate_attempted_at)
  where candidate_attempted_at is not null;
