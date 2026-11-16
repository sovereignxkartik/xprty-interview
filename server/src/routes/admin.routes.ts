import { Router, Response } from 'express';
import { db } from '../services/database.service';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middlewares/auth.middleware';
import { findUserByEmail, registerUser } from '../services/user.service';
import { isSupabaseConfigured, supabase } from '../services/supabase.service';

const router = Router();

// Platform-level access control: Only super_admin allowed
router.use(authenticateToken);
router.use(requireRole(['super_admin']));

async function liveAdminData() {
  const [profilesResult, sessionsResult, interviewerResult, organizationsResult, settingsResult, feedbackResult] = await Promise.all([
    supabase!.from('profiles').select('*'),
    supabase!.from('interview_sessions').select('*').order('scheduled_start_time', { ascending: false }),
    supabase!.from('interviewer_profiles').select('*'),
    supabase!.from('organizations').select('id,name'),
    supabase!.from('platform_settings').select('*').eq('id', true).maybeSingle(),
    supabase!.from('interview_feedback').select('*'),
  ]);
  const error = profilesResult.error || sessionsResult.error || interviewerResult.error || organizationsResult.error || settingsResult.error || feedbackResult.error;
  if (error) throw error;
  const users = profilesResult.data || [];
  const sessions = sessionsResult.data || [];
  const usersById = new Map(users.map((user: any) => [user.id, user]));
  const organizationsById = new Map((organizationsResult.data || []).map((organization: any) => [organization.id, organization.name]));
  const feedbackBySession = new Map((feedbackResult.data || []).map((feedback: any) => [feedback.session_id, feedback]));
  const interviewers = (interviewerResult.data || []).map((profile: any) => ({
    ...profile,
    id: profile.user_id,
    user: usersById.get(profile.user_id),
    organization_name: organizationsById.get(profile.organization_id) || 'Organization',
    is_busy: sessions.some((session: any) => session.interviewer_id === profile.user_id && session.status === 'in_progress'),
  }));
  const enrichedSessions = sessions.map((session: any) => ({
    ...session,
    interviewer: usersById.get(session.interviewer_id) || null,
    candidate: usersById.get(session.candidate_id) || null,
    feedback: feedbackBySession.get(session.id) || null,
    queue_length: 0,
  }));
  return { users, sessions: enrichedSessions, interviewers, settings: settingsResult.data };
}

// 1. Get Platform Analytics & System Overview
router.get('/overview', async (req: AuthenticatedRequest, res: Response) => {
  if (isSupabaseConfigured && supabase) {
    const { users, sessions, interviewers, settings } = await liveAdminData();
    return res.json({
      metrics: {
        total_users: users.length, super_admins: users.filter((u: any) => u.role === 'super_admin').length,
        interviewers: users.filter((u: any) => u.role === 'interviewer').length, candidates: users.filter((u: any) => u.role === 'candidate').length,
        total_interviews: sessions.length, in_progress_interviews: sessions.filter((s: any) => s.status === 'in_progress').length,
        completed_interviews: sessions.filter((s: any) => s.status === 'completed').length, scheduled_interviews: sessions.filter((s: any) => s.status === 'scheduled').length,
      }, interviewers, settings
    });
  }
  const users = db.getAllUsers();
  const sessions = db.getAllSessions();
  const interviewers = db.getAllInterviewerProfiles();
  const settings = db.getPlatformSettings();

  return res.json({
    metrics: {
      total_users: users.length,
      super_admins: users.filter(u => u.role === 'super_admin').length,
      interviewers: users.filter(u => u.role === 'interviewer').length,
      candidates: users.filter(u => u.role === 'candidate').length,
      total_interviews: sessions.length,
      in_progress_interviews: sessions.filter(s => s.status === 'in_progress').length,
      completed_interviews: sessions.filter(s => s.status === 'completed').length,
      scheduled_interviews: sessions.filter(s => s.status === 'scheduled').length
    },
    interviewers,
    settings
  });
});

// 2. Manage Platform Settings
router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('platform_settings').select('*').eq('id', true).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }
  return res.json(db.getPlatformSettings());
});

router.patch('/settings', async (req: AuthenticatedRequest, res: Response) => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('platform_settings').update(req.body).eq('id', true).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ message: 'Platform settings updated successfully.', settings: data });
  }
  const updated = db.updatePlatformSettings(req.body);
  return res.json({ message: 'Platform settings updated successfully.', settings: updated });
});

// 3. User Management (All Users)
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  if (isSupabaseConfigured && supabase) {
    const { users } = await liveAdminData();
    return res.json(users.map((u: any) => ({ id: u.id, email: u.email, full_name: u.full_name, role: u.role, is_active: u.is_active, created_at: u.created_at })));
  }
  const users = db.getAllUsers().map(u => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    is_active: u.is_active,
    created_at: u.created_at
  }));
  return res.json(users);
});

router.patch('/users/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('profiles').update({ is_active: req.body.is_active }).eq('id', req.params.id).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found' });
    return res.json({ message: `User status changed to ${data.is_active ? 'active' : 'suspended'}.` });
  }
  const { is_active } = req.body;
  const user = db.updateUser(req.params.id, { is_active });
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ message: `User status changed to ${is_active ? 'active' : 'suspended'}.` });
});

// 4. Interviewer Verification & Status
router.patch('/interviewers/:userId/verification', async (req: AuthenticatedRequest, res: Response) => {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('interviewer_profiles').update({ verification_status: req.body.verification_status }).eq('user_id', req.params.userId).select().maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Interviewer profile not found' });
    return res.json({ message: 'Interviewer verification status updated.', profile: data });
  }
  const { verification_status } = req.body; // 'verified' | 'pending' | 'suspended'
  const profile = db.getInterviewerProfile(req.params.userId);
  if (!profile) return res.status(404).json({ error: 'Interviewer profile not found' });

  profile.verification_status = verification_status;
  db.setInterviewerProfile(profile);
  return res.json({ message: 'Interviewer verification status updated.', profile });
});

// 5. Provision interviewer accounts. This is the only interviewer-creation path.
router.post('/interviewers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, full_name, organization, title, skills, phone } = req.body;
    if (!email || !password || !full_name || !organization) {
      return res.status(400).json({ error: 'Name, email, temporary password, and organization are required.' });
    }
    if (await findUserByEmail(email)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    const user = await registerUser({
      email, password, full_name, role: 'interviewer', organization, title, phone,
      skills: Array.isArray(skills) ? skills : []
    });
    return res.status(201).json({
      message: 'Interviewer account created.',
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
      profile: db.getInterviewerProfile(user.id)
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Monitor All Interviews System-wide
router.get('/interviews', async (req: AuthenticatedRequest, res: Response) => {
  if (isSupabaseConfigured && supabase) return res.json((await liveAdminData()).sessions);
  const sessions = db.getAllSessions().map(s => {
    const interviewer = db.getUserById(s.interviewer_id);
    const candidate = db.getUserById(s.candidate_id);
    const queue = db.getQueueForInterviewer(s.interviewer_id);
    return {
      ...s,
      interviewer: interviewer ? { id: interviewer.id, full_name: interviewer.full_name, email: interviewer.email } : null,
      candidate: candidate ? { id: candidate.id, full_name: candidate.full_name, email: candidate.email } : null,
      queue_length: queue.length
    };
  });
  return res.json(sessions);
});

export default router;
