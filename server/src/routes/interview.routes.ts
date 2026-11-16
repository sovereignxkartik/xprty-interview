import { Router, Request, Response } from 'express';
import { db } from '../services/database.service';
import { jitsiService } from '../services/jitsi.service';
import { createInterview, getInterviewByCode, getInterviewById, getInterviewFeedback, interviewsForUser, markCandidateAttempt, rescheduleInterview, saveInterviewFeedback, updateInterviewRoom, updateInterviewStatus, setInterviewWaitingPresence, isInterviewCandidateWaiting, getInterviewProctoringEvents, recordInterviewProctoringEvent } from '../services/interview.service';
import { findUserByEmail, findUserById, getProfile } from '../services/user.service';
import { isSupabaseConfigured } from '../services/supabase.service';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { JWT_SECRET } from '../middlewares/auth.middleware';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const router = Router();

// ====================================================================
// CANDIDATE SPECIFIC ROUTE: ACCESS INTERVIEW VIA INTERVIEW KEY ONLY
// Directly connects candidate with their assigned interview session
// Enforces Single-Candidate queue if interviewer is busy
// ====================================================================
router.post('/access-by-key', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = z.object({ interviewKey: z.string().trim().min(1).max(32), email: z.string().trim().email().max(255) }).safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Enter the interview key and the email address that received the invitation.' });
    }

    const { interviewKey, email } = parsed.data;

    const session = await getInterviewByCode(interviewKey);
    if (!session) {
      return res.status(404).json({
        error: 'Invalid interview key. No scheduled interview found matching this key.'
      });
    }

    // Check if session is already completed or cancelled.
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'This interview has already been completed.' });
    }
    if (session.status === 'cancelled') {
      return res.status(400).json({ error: 'This interview was cancelled by the host.' });
    }

    const interviewer = await findUserById(session.interviewer_id);
    const candidate = await findUserById(session.candidate_id);
    const interviewerProfile = db.getInterviewerProfile(session.interviewer_id);

    // A candidate uses the key plus the invited email; no account login is required.
    if (!candidate || candidate.email.trim().toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: 'The interview key and email address do not match an invitation.' });
    }
    const accessToken = jwt.sign({ id: candidate.id, email: candidate.email, role: 'candidate', full_name: candidate.full_name, sessionId: session.id, candidateAccess: true }, JWT_SECRET, { expiresIn: '8h' });

    const now = Date.now();
    const startTime = new Date(session.scheduled_start_time).getTime();
    const endTime = new Date(session.scheduled_end_time).getTime();
    if (now < startTime) {
      return res.json({ status: 'NOT_OPEN_YET', accessToken, candidate: { id: candidate.id, email: candidate.email, full_name: candidate.full_name, role: 'candidate' }, session: { id: session.id, title: session.title, scheduled_start_time: session.scheduled_start_time } });
    }
    if (now > endTime) {
      return res.status(410).json({
        code: session.candidate_attempted_at ? 'ALREADY_ATTEMPTED' : 'MISSED',
        error: session.candidate_attempted_at ? 'You already attempted this interview. Please contact the interviewer for next steps.' : 'You missed your interview because the scheduled access window has closed.',
      });
    }
    await markCandidateAttempt(session.id);

    // ====================================================================
    // CRITICAL REQUIREMENT: SINGLE-CANDIDATE INTERVIEWER CONCURRENCY
    // If interviewer is currently busy with another candidate, queue this candidate
    // ====================================================================
    const isBusy = db.isInterviewerBusy(session.interviewer_id, session.id);

    if (isBusy) {
      // Add candidate to the interviewer's queue
      const queueEntry = db.enqueueCandidate(session.interviewer_id, session.id, session.candidate_id);

      return res.json({
        status: 'WAITING_IN_QUEUE',
        accessToken, candidate: { id: candidate.id, email: candidate.email, full_name: candidate.full_name, role: 'candidate' },
        message: 'Your interviewer is currently conducting an interview with another candidate. You have been placed in the live queue. Please stay on this screen — your session will automatically begin as soon as the interviewer is free.',
        queue: {
          position: queueEntry.position,
          totalInQueue: db.getQueueForInterviewer(session.interviewer_id).length,
          interviewerName: interviewer ? interviewer.full_name : 'Interviewer',
          sessionId: session.id,
          sessionCode: session.session_code,
          title: session.title
        }
      });
    }

    // A free interviewer does not automatically start the session. The candidate
    // enters a waiting room and the interviewer explicitly admits them.
    return res.json({
      status: 'WAITING_FOR_ADMISSION',
      accessToken, candidate: { id: candidate.id, email: candidate.email, full_name: candidate.full_name, role: 'candidate' },
      session: {
        id: session.id,
        session_code: session.session_code,
        title: session.title,
        description: session.description,
        jitsi_room_url: session.jitsi_room_url,
        status: session.status,
        require_screen_share: session.require_screen_share,
        require_fullscreen: session.require_fullscreen,
        require_webcam: session.require_webcam,
        require_audio: session.require_audio,
        code_workspace_enabled: session.code_workspace_enabled,
        interviewer: interviewer ? {
          full_name: interviewer.full_name,
          title: interviewerProfile ? interviewerProfile.title : 'Technical Interviewer'
        } : null
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

function canAccessSession(session: any, user: NonNullable<AuthenticatedRequest['user']>) {
  return user.role === 'super_admin' || session.interviewer_id === user.id || session.candidate_id === user.id;
}

function canManageSession(session: any, user: NonNullable<AuthenticatedRequest['user']>) {
  return user.role === 'super_admin' || session.interviewer_id === user.id;
}

const tokenRequests = new Map<string, number[]>();
function tokenRateLimit(req: AuthenticatedRequest, res: Response, next: Function) {
  const key = `${req.user!.id}:${req.params.id}`;
  const now = Date.now();
  const recent = (tokenRequests.get(key) || []).filter(time => now - time < 60_000);
  if (recent.length >= 10) return res.status(429).json({ error: 'Too many token requests. Please wait a minute.' });
  recent.push(now);
  tokenRequests.set(key, recent);
  next();
}

// Check Candidate Queue Status (Polling / WebSocket Sync)
router.get('/:id/queue-status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const session = db.getSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!canAccessSession(session, req.user!)) return res.status(403).json({ error: 'Unauthorized to view this interview session.' });

  const isBusy = db.isInterviewerBusy(session.interviewer_id, session.id);
  const queueStatus = db.getCandidateQueueStatus(session.interviewer_id, session.id);

  return res.json({
    interviewerBusy: isBusy,
    inQueue: queueStatus.inQueue,
    position: queueStatus.position,
    totalInQueue: queueStatus.totalInQueue,
    canJoinNow: !isBusy
  });
});

// Candidate waiting-room heartbeat, readable by the assigned interviewer.
router.post('/:id/waiting-room', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const session = await getInterviewById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (req.user!.id !== session.candidate_id) return res.status(403).json({ error: 'Only the assigned candidate can update waiting-room presence.' });
  const present = await setInterviewWaitingPresence(session, req.body?.present !== false);
  return res.json({ present });
});

router.get('/:id/waiting-room', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const session = await getInterviewById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!canManageSession(session, req.user!)) return res.status(403).json({ error: 'Unauthorized to view waiting-room presence.' });
  return res.json({ present: await isInterviewCandidateWaiting(session.id) });
});

// ====================================================================
// AUTHENTICATED ROUTES (Interviewer / Admin)
// ====================================================================

// Get All Sessions for the Authenticated Interviewer
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  let sessions: any[] = await interviewsForUser(user.id, user.role);

  const enriched = sessions.map(s => {
    const interviewer = db.getUserById(s.interviewer_id);
    const candidate = db.getUserById(s.candidate_id);
    return {
      ...s,
      interviewer: interviewer ? { id: interviewer.id, full_name: interviewer.full_name, email: interviewer.email } : null,
      candidate: candidate ? { id: candidate.id, full_name: candidate.full_name, email: candidate.email } : null
    };
  });

  return res.json(enriched);
});

// Get Single Session Details (Guarded)
router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const session = await getInterviewById(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Interview session not found' });
  }

  // Authorization check: User must be admin, the assigned interviewer, or the assigned candidate
  const user = req.user!;
  if (!canAccessSession(session, user)) {
    return res.status(403).json({ error: 'Unauthorized to view this interview session.' });
  }

  const interviewer = await findUserById(session.interviewer_id);
  const candidate = await findUserById(session.candidate_id);
  const candidateProfile = candidate ? await getProfile(candidate) : null;
  const resources = db.getResources(session.id);
  const queue = db.getQueueForInterviewer(session.interviewer_id);
  const feedback = canManageSession(session, user) ? await getInterviewFeedback(session.id) : undefined;

  return res.json({
    ...session,
    interviewer,
    candidate,
    candidate_profile: candidateProfile,
    feedback,
    resources,
    waiting_queue_count: queue.length
  });
});

// Initialize room after scheduling. Safe to retry: an existing room is returned.
router.post('/:id/room', authenticateToken, requireRole(['interviewer', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await getInterviewById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Interview session not found' });
    if (!canManageSession(session, req.user!)) return res.status(403).json({ error: 'You are not the designated interviewer for this session.' });
    if (session.jitsi_room_name && session.jitsi_room_url) return res.json({ roomName: session.jitsi_room_name, roomUrl: session.jitsi_room_url, created: false });
    const updated = await updateInterviewRoom(session.id, jitsiService.createRoom());
    if (!updated) return res.status(404).json({ error: 'Interview session not found' });
    return res.status(201).json({ roomName: updated.jitsi_room_name, roomUrl: updated.jitsi_room_url, created: true });
  } catch (err) {
    return res.status(502).json({ error: 'Unable to provision the video room. Please try again later.' });
  }
});

router.get('/:id/room-status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const session = db.getSessionById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Interview session not found' });
  if (!canAccessSession(session, req.user!)) return res.status(403).json({ error: 'Unauthorized to view this interview session.' });
  return res.json({ ready: Boolean(session.jitsi_room_name && session.jitsi_room_url), status: session.status });
});

async function resolveCandidate(candidateEmail: string, candidateName: string) {
  if (!candidateEmail || !/^\S+@\S+\.\S+$/.test(candidateEmail)) throw new Error('Use a valid candidate email address.');
  if (!candidateName?.trim()) throw new Error('Candidate name is required.');
  let candidate = await findUserByEmail(candidateEmail);
  if (!candidate) {
    if (isSupabaseConfigured) throw new Error('Each candidate must have a registered account before scheduling.');
    candidate = db.createUser({ email: candidateEmail, full_name: candidateName || 'Candidate', role: 'candidate', password_hash: '', is_active: true });
    db.setCandidateProfile({ id: `cand_${candidate.id}`, user_id: candidate.id, skills: [], created_at: new Date().toISOString() });
  }
  if (candidate.role !== 'candidate') throw new Error('The supplied candidate email belongs to a non-candidate account.');
  return candidate;
}

async function scheduleForInterviewer(input: any) {
  const interviewer = db.getUserById(input.interviewer_id);
  if (!interviewer || interviewer.role !== 'interviewer' || !interviewer.is_active) throw new Error('Select an active interviewer.');
  const candidate = input.candidate_id
    ? db.getUserById(input.candidate_id)
    : await resolveCandidate(input.candidate_email, input.candidate_name);
  if (!candidate || candidate.role !== 'candidate') throw new Error('Select a valid candidate.');
  const start = input.scheduled_start_time ? new Date(input.scheduled_start_time) : new Date();
  const end = input.scheduled_end_time ? new Date(input.scheduled_end_time) : new Date(start.getTime() + 3600000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error('Use valid start and end times.');
  const session = await createInterview({
    session_code: `XP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    title: input.title || 'Technical Evaluation Interview', description: input.description || '',
    interviewer_id: interviewer.id, candidate_id: candidate.id, jitsi_room_name: '', jitsi_room_url: '', meeting_provider: 'jitsi', status: 'scheduled',
    scheduled_start_time: start.toISOString(), scheduled_end_time: end.toISOString(),
    require_screen_share: input.require_screen_share !== false, require_fullscreen: input.require_fullscreen !== false,
    require_webcam: input.require_webcam !== false, require_audio: input.require_audio !== false,
    code_workspace_enabled: input.code_workspace_enabled !== false
  });
  return updateInterviewRoom(session.id, jitsiService.createRoom());
}

// Only admins schedule sessions so every session has an explicitly assigned host.
router.post('/', authenticateToken, requireRole(['super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      title,
      description,
      candidate_id,
      candidate_email,
      candidate_name,
      scheduled_start_time,
      scheduled_end_time,
      require_screen_share = true,
      require_fullscreen = true,
      require_webcam = true,
      require_audio = true,
      code_workspace_enabled = true
    } = req.body;

    if (!candidate_id && !candidate_email) return res.status(400).json({ error: 'Select a candidate or enter a candidate email.' });
    const session = await scheduleForInterviewer({ ...req.body, title, description, candidate_id, candidate_email, candidate_name, scheduled_start_time, scheduled_end_time, require_screen_share, require_fullscreen, require_webcam, require_audio, code_workspace_enabled });
    return res.status(201).json(session);
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// CSV rows are parsed in the browser, then validated and scheduled atomically per row.
router.post('/bulk', authenticateToken, requireRole(['super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 500) return res.status(400).json({ error: 'Upload 1 to 500 CSV rows.' });
  const results: any[] = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    try {
      if (!row.candidate_name || !row.candidate_email || !row.interviewer_id || !row.scheduled_start_time || !row.scheduled_end_time) throw new Error('candidate_name, candidate_email, interviewer_id, scheduled_start_time and scheduled_end_time are required.');
      const session = await scheduleForInterviewer(row);
      results.push({ row: index + 2, success: true, session });
    } catch (err: any) {
      results.push({ row: index + 2, success: false, error: err.message });
    }
  }
  const created = results.filter(result => result.success).length;
  return res.status(created ? 201 : 400).json({ created, failed: results.length - created, results });
});

// Update Interview Status (e.g. Host Starts or Ends Interview)
router.patch('/:id/status', authenticateToken, requireRole(['interviewer', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = z.object({
    status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Status must be scheduled, in_progress, completed, or cancelled.' });
  }

  try {
    const { status } = parsed.data;
    const session = await getInterviewById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Interviewer can only manage their own session unless admin.
    if (req.user!.role !== 'super_admin' && session.interviewer_id !== req.user!.id) {
      return res.status(403).json({ error: 'You are not the designated interviewer for this session.' });
    }

    if (status === 'in_progress' && db.isInterviewerBusy(session.interviewer_id, session.id)) {
      return res.status(409).json({
        error: 'You are currently conducting another interview! Finish or exit your current active interview before starting a new one.'
      });
    }

    const updated = await updateInterviewStatus(req.params.id, status);

    // If session completed, check if next candidate is waiting in queue.
    const nextInQueue = status === 'completed'
      ? db.dequeueNextCandidate(session.interviewer_id)
      : null;

    return res.json({ updated, nextInQueue });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update interview status.';
    console.error('[Interview status update failed]', { sessionId: req.params.id, message });
    return res.status(502).json({ error: message });
  }
});

// Generate Meeting Token for Interviewer
router.get('/:id/meeting', authenticateToken, tokenRateLimit, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await getInterviewById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Interview session not found' });
    const user = req.user!;
    if (!canAccessSession(session, user)) return res.status(403).json({ error: 'You are not a participant in this interview.' });
    if (!session.jitsi_room_name || !session.jitsi_room_url) return res.status(409).json({ error: 'The interview room has not been initialized yet.' });
    if (session.status === 'completed' || session.status === 'cancelled') return res.status(409).json({ error: 'This interview is no longer available.' });
    return res.json({ roomName: session.jitsi_room_name, roomUrl: session.jitsi_room_url, domain: jitsiService.getDomain() });
  } catch (err) {
    return res.status(502).json({ error: 'Unable to retrieve meeting details. Please try again later.' });
  }
});

router.post('/:id/end', authenticateToken, requireRole(['interviewer', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await getInterviewById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Interview session not found' });
    if (!canManageSession(session, req.user!)) return res.status(403).json({ error: 'You are not the designated interviewer for this session.' });
    const updated = await updateInterviewStatus(session.id, 'completed');
    if (!updated) return res.status(404).json({ error: 'Interview session not found' });
    return res.json({ updated, status: updated.status, actual_end_time: updated.actual_end_time });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to end the interview.' });
  }
});

router.patch('/:id/schedule', authenticateToken, requireRole(['interviewer', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = z.object({ scheduled_start_time: z.string().datetime(), scheduled_end_time: z.string().datetime() }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Provide valid ISO start and end times.' });
    const start = new Date(parsed.data.scheduled_start_time);
    const end = new Date(parsed.data.scheduled_end_time);
    if (end <= start) return res.status(400).json({ error: 'The end time must be after the start time.' });
    const session = await getInterviewById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Interview session not found' });
    if (!canManageSession(session, req.user!)) return res.status(403).json({ error: 'You are not allowed to reschedule this interview.' });
    if (session.status === 'in_progress') return res.status(409).json({ error: 'End the active interview before rescheduling it.' });
    const updated = await rescheduleInterview(session.id, start.toISOString(), end.toISOString());
    return res.json({ updated });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to reschedule the interview.' });
  }
});

router.post('/:id/cancel', authenticateToken, requireRole(['interviewer', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await getInterviewById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Interview session not found' });
    if (!canManageSession(session, req.user!)) return res.status(403).json({ error: 'You are not allowed to cancel this interview.' });
    if (session.status === 'in_progress') return res.status(409).json({ error: 'End the active interview before cancelling it.' });
    const updated = await updateInterviewStatus(session.id, 'cancelled');
    return res.json({ updated });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to cancel the interview.' });
  }
});

router.post('/:id/reinterview', authenticateToken, requireRole(['interviewer', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await getInterviewById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Interview session not found' });
    if (!canManageSession(session, req.user!)) return res.status(403).json({ error: 'You are not allowed to create a re-interview.' });
    if (session.status !== 'completed') return res.status(409).json({ error: 'Only completed interviews can be re-interviewed.' });
    const start = req.body?.scheduled_start_time ? new Date(req.body.scheduled_start_time) : new Date(Date.now() + 60 * 60 * 1000);
    const end = req.body?.scheduled_end_time ? new Date(req.body.scheduled_end_time) : new Date(start.getTime() + (new Date(session.scheduled_end_time).getTime() - new Date(session.scheduled_start_time).getTime()));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return res.status(400).json({ error: 'Provide valid re-interview times.' });
    const replacement = await createInterview({
      session_code: `XP-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      title: `${session.title} — Re-interview`, description: session.description, organization_id: session.organization_id,
      interviewer_id: session.interviewer_id, candidate_id: session.candidate_id, jitsi_room_name: '', jitsi_room_url: '', meeting_provider: 'jitsi', status: 'scheduled',
      scheduled_start_time: start.toISOString(), scheduled_end_time: end.toISOString(),
      require_screen_share: session.require_screen_share, require_fullscreen: session.require_fullscreen, require_webcam: session.require_webcam, require_audio: session.require_audio, code_workspace_enabled: session.code_workspace_enabled,
    });
    const updated = await updateInterviewRoom(replacement.id, jitsiService.createRoom());
    return res.status(201).json({ session: updated });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to create a re-interview.' });
  }
});

// Allowlist & Resources (CRUD)
router.get('/:id/resources', (req: Request, res: Response) => {
  const resources = db.getResources(req.params.id);
  return res.json(resources);
});

router.post('/:id/resources', authenticateToken, requireRole(['interviewer', 'super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { domain, title, include_subdomains } = req.body;
  const newRes = db.addResource({
    session_id: req.params.id,
    domain,
    title: title || domain,
    include_subdomains: include_subdomains !== undefined ? include_subdomains : true,
    is_active: true,
    added_by: req.user!.id
  });
  return res.status(201).json(newRes);
});

router.patch('/:id/resources/:resId', authenticateToken, requireRole(['interviewer', 'super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const { is_active } = req.body;
  const success = db.toggleResource(req.params.id, req.params.resId, is_active);
  if (!success) return res.status(404).json({ error: 'Resource not found' });
  return res.json({ success: true, is_active });
});

router.delete('/:id/resources/:resId', authenticateToken, requireRole(['interviewer', 'super_admin']), (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteResource(req.params.id, req.params.resId);
  if (!success) return res.status(404).json({ error: 'Resource not found' });
  return res.json({ success: true });
});

// Proctoring
router.get('/:id/proctoring', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const session = await getInterviewById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Interview session not found' });
  if (!canManageSession(session, req.user!)) return res.status(403).json({ error: 'Unauthorized to view proctoring events.' });
  return res.json(await getInterviewProctoringEvents(session.id));
});

router.post('/:id/proctoring', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const session = await getInterviewById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Interview session not found' });
  if (req.user!.id !== session.candidate_id) return res.status(403).json({ error: 'Only the assigned candidate can report proctoring events.' });
  const { event_type, severity, metadata } = req.body;
  const event = await recordInterviewProctoringEvent({
    session_id: session.id,
    user_id: session.candidate_id,
    event_type,
    severity: severity || 'medium',
    metadata: metadata || {}
  });
  return res.status(201).json(event);
});

// Feedback & Evaluation
router.post('/:id/feedback', authenticateToken, requireRole(['interviewer', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  const {
    technical_score,
    problem_solving_score,
    communication_score,
    overall_rating,
    recommendation,
    summary_notes,
    detailed_scores
  } = req.body;

  const session = await getInterviewById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Interview session not found' });
  if (!canManageSession(session, req.user!)) return res.status(403).json({ error: 'You are not allowed to evaluate this interview.' });
  const fb = await saveInterviewFeedback({
    session_id: req.params.id,
    interviewer_id: req.user!.id,
    technical_score: Number(technical_score) || 3,
    problem_solving_score: Number(problem_solving_score) || 3,
    communication_score: Number(communication_score) || 3,
    overall_rating: Number(overall_rating) || 3,
    recommendation: recommendation || 'hire',
    summary_notes: summary_notes || '',
    detailed_scores: { ...(detailed_scores || {}), strengths: req.body.strengths || '', improvements: req.body.improvements || '' }
  });

  return res.status(201).json(fb);
});

router.get('/:id/feedback', authenticateToken, requireRole(['interviewer', 'super_admin']), async (req: AuthenticatedRequest, res: Response) => {
  const session = await getInterviewById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Interview session not found' });
  if (!canManageSession(session, req.user!)) return res.status(403).json({ error: 'You are not allowed to view this scorecard.' });
  return res.json(await getInterviewFeedback(session.id));
});

// Scratchpad Notes
router.get('/:id/notes', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const notes = db.getNotes(req.params.id);
  return res.json(notes);
});

router.post('/:id/notes', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { content } = req.body;
  const note = db.saveNote({
    session_id: req.params.id,
    author_id: req.user!.id,
    content
  });
  return res.status(201).json(note);
});

export default router;
