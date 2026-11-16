import { db } from './database.service';
import { isSupabaseConfigured, supabase } from './supabase.service';
import { InterviewSession, InterviewFeedback, ProctoringEvent, ProctoringEventType, ProctoringSeverity } from '../types';

type NewSession = Omit<InterviewSession, 'id' | 'created_at' | 'updated_at'>;

function fail(error: unknown, action: string): never {
  // PostgREST errors are plain objects, rather than Error instances. Using
  // String(error) for them produces "[object Object]" and hides the database
  // response that an interviewer needs to act on.
  const databaseError = error as {
    message?: unknown;
    details?: unknown;
    hint?: unknown;
    code?: unknown;
  } | null;
  const message = error instanceof Error
    ? error.message
    : typeof databaseError?.message === 'string'
      ? [
          databaseError.message,
          typeof databaseError.details === 'string' && databaseError.details,
          typeof databaseError.hint === 'string' && `Hint: ${databaseError.hint}`,
          typeof databaseError.code === 'string' && databaseError.code && `Code: ${databaseError.code}`,
        ].filter(Boolean).join(' ')
      : 'An unexpected database error occurred.';
  throw new Error(`${action}: ${message}`);
}

export async function getInterviewById(id: string): Promise<InterviewSession | undefined> {
  if (!isSupabaseConfigured || !supabase) return db.getSessionById(id);
  const { data, error } = await supabase.from('interview_sessions').select('*').eq('id', id).maybeSingle();
  if (error) fail(error, 'Could not load interview');
  return data || undefined;
}

export async function getInterviewByCode(code: string): Promise<InterviewSession | undefined> {
  if (!isSupabaseConfigured || !supabase) return db.getSessionByCode(code);
  const { data, error } = await supabase.from('interview_sessions').select('*').ilike('session_code', code.trim()).maybeSingle();
  if (error) fail(error, 'Could not load interview');
  return data || undefined;
}

export async function createInterview(session: NewSession): Promise<InterviewSession> {
  if (!isSupabaseConfigured || !supabase) return db.createSession(session);
  let organizationId = session.organization_id;
  if (!organizationId) {
    const { data: interviewer, error: interviewerError } = await supabase
      .from('interviewer_profiles').select('organization_id').eq('user_id', session.interviewer_id).maybeSingle();
    if (interviewerError || !interviewer) throw new Error('The assigned interviewer does not belong to an organization.');
    organizationId = interviewer.organization_id;
  }
  const { data, error } = await supabase.from('interview_sessions').insert({ ...session, organization_id: organizationId }).select().single();
  if (error) fail(error, 'Could not save interview');
  return data;
}

export async function updateInterviewRoom(id: string, room: { name: string; url: string }): Promise<InterviewSession | undefined> {
  if (!isSupabaseConfigured || !supabase) return db.updateSessionJitsiRoom(id, room);
  const existing = await getInterviewById(id);
  if (!existing) return undefined;
  if (existing.jitsi_room_name && existing.jitsi_room_url) return existing;
  const { data, error } = await supabase.from('interview_sessions')
    .update({ jitsi_room_name: room.name, jitsi_room_url: room.url, meeting_provider: 'jitsi', updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) fail(error, 'Could not save Jitsi meeting');
  return data;
}

export async function updateInterviewStatus(
  id: string,
  status: InterviewSession['status'],
): Promise<InterviewSession | undefined> {
  if (!isSupabaseConfigured || !supabase) return db.updateSessionStatus(id, status);

  const now = new Date().toISOString();
  const timestampField = status === 'in_progress'
    // A previously reset/re-scheduled session can retain an old end time.
    // Starting it with a new start time must clear that value, otherwise the
    // database's end >= start constraint rejects the status update.
    ? { actual_start_time: now, actual_end_time: null }
    : status === 'completed'
      ? { actual_end_time: now }
      : {};
  const { data, error } = await supabase
    .from('interview_sessions')
    .update({ status, ...timestampField, updated_at: now })
    .eq('id', id)
    .select()
    .maybeSingle();
  if (error) fail(error, 'Could not update interview status');
  return data || undefined;
}

export async function markCandidateAttempt(id: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('interview_sessions')
    .update({ candidate_attempted_at: new Date().toISOString() })
    .eq('id', id)
    .is('candidate_attempted_at', null);
  if (error) fail(error, 'Could not record interview attempt');
}

export async function rescheduleInterview(id: string, start: string, end: string): Promise<InterviewSession | undefined> {
  if (!isSupabaseConfigured || !supabase) {
    const session = db.getSessionById(id);
    if (!session) return undefined;
    Object.assign(session, { status: 'scheduled', scheduled_start_time: start, scheduled_end_time: end, actual_start_time: undefined, actual_end_time: undefined, candidate_attempted_at: undefined, updated_at: new Date().toISOString() });
    return session;
  }
  const { data, error } = await supabase.from('interview_sessions').update({
    status: 'scheduled', scheduled_start_time: start, scheduled_end_time: end,
    actual_start_time: null, actual_end_time: null, candidate_attempted_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select().maybeSingle();
  if (error) fail(error, 'Could not reschedule interview');
  return data || undefined;
}

export async function saveInterviewFeedback(input: Omit<InterviewFeedback, 'id' | 'submitted_at'>): Promise<InterviewFeedback> {
  if (!isSupabaseConfigured || !supabase) return db.saveFeedback(input);
  const { data, error } = await supabase.from('interview_feedback').upsert(input, { onConflict: 'session_id' }).select().single();
  if (error) fail(error, 'Could not save scorecard');
  return data as InterviewFeedback;
}

export async function getInterviewFeedback(sessionId: string): Promise<InterviewFeedback | undefined> {
  if (!isSupabaseConfigured || !supabase) return db.getFeedback(sessionId);
  const { data, error } = await supabase.from('interview_feedback').select('*').eq('session_id', sessionId).maybeSingle();
  if (error) fail(error, 'Could not load scorecard');
  return data as InterviewFeedback || undefined;
}

export async function interviewsForUser(userId: string, role: string): Promise<InterviewSession[]> {
  if (!isSupabaseConfigured || !supabase) {
    return role === 'super_admin' ? db.getAllSessions() : role === 'interviewer' ? db.getSessionsForInterviewer(userId) : db.getSessionsForCandidate(userId);
  }
  let query = supabase.from('interview_sessions').select('*').order('scheduled_start_time', { ascending: false });
  if (role === 'interviewer') query = query.eq('interviewer_id', userId);
  if (role === 'candidate') query = query.eq('candidate_id', userId);
  const { data, error } = await query;
  if (error) fail(error, 'Could not load interviews');
  return data || [];
}

/** Waiting-room presence must use the same persistence layer as interview sessions. */
export async function setInterviewWaitingPresence(
  session: InterviewSession,
  present: boolean,
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    db.setCandidateWaiting(session.id, present);
    return db.isCandidateWaiting(session.id);
  }

  if (!present) {
    const { error } = await supabase
      .from('interview_waiting_rooms')
      .update({ status: 'left', last_heartbeat_at: new Date().toISOString() })
      .eq('session_id', session.id);
    if (error) fail(error, 'Could not update waiting-room presence');
    return false;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('interview_waiting_rooms')
    .upsert({
      session_id: session.id,
      candidate_id: session.candidate_id,
      status: 'waiting',
      joined_at: now,
      last_heartbeat_at: now,
    }, { onConflict: 'session_id' });
  if (error) fail(error, 'Could not update waiting-room presence');
  return true;
}

export async function isInterviewCandidateWaiting(sessionId: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return db.isCandidateWaiting(sessionId);

  const { data, error } = await supabase
    .from('interview_waiting_rooms')
    .select('status,last_heartbeat_at')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) fail(error, 'Could not load waiting-room presence');
  if (!data || data.status !== 'waiting' || !data.last_heartbeat_at) return false;
  return Date.now() - new Date(data.last_heartbeat_at).getTime() <= 15_000;
}

export async function getInterviewProctoringEvents(sessionId: string): Promise<ProctoringEvent[]> {
  if (!isSupabaseConfigured || !supabase) return db.getProctoringEvents(sessionId);
  const { data, error } = await supabase
    .from('proctoring_events')
    .select('*')
    .eq('session_id', sessionId)
    .order('detected_at', { ascending: false });
  if (error) fail(error, 'Could not load proctoring events');
  return (data || []) as ProctoringEvent[];
}

export async function recordInterviewProctoringEvent(input: {
  session_id: string;
  user_id: string;
  event_type: ProctoringEventType;
  severity: ProctoringSeverity;
  metadata?: Record<string, unknown>;
}): Promise<ProctoringEvent> {
  if (!isSupabaseConfigured || !supabase) {
    return db.addProctoringEvent({ ...input, metadata: input.metadata || {} });
  }
  const { data, error } = await supabase.from('proctoring_events').insert({
    ...input,
    metadata: input.metadata || {},
  }).select().single();
  if (error) fail(error, 'Could not record proctoring event');
  return data as ProctoringEvent;
}
