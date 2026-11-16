import bcrypt from 'bcryptjs';
import { 
  User, 
  InterviewerProfile,
  CandidateProfile,
  InterviewSession, 
  ResourcePermission, 
  ProctoringEvent, 
  InterviewFeedback, 
  InterviewNote,
  PlatformSettings,
  QueueEntry
} from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enterprise In-Memory Database Store for XPRTY Interview
 * Includes full Authentication, Profiles, Platform-level Admin Control,
 * Interviewer Single-Candidate Concurrency, and Real-Time Candidate Queueing.
 */
class DatabaseService {
  private users: Map<string, User> = new Map();
  private interviewerProfiles: Map<string, InterviewerProfile> = new Map();
  private candidateProfiles: Map<string, CandidateProfile> = new Map();
  private sessions: Map<string, InterviewSession> = new Map();
  private resources: Map<string, ResourcePermission[]> = new Map();
  private proctoringEvents: Map<string, ProctoringEvent[]> = new Map();
  private feedback: Map<string, InterviewFeedback> = new Map();
  private notes: Map<string, InterviewNote[]> = new Map();
  
  // Real-time Queue per Interviewer (InterviewerId -> QueueEntry[])
  private interviewerQueues: Map<string, QueueEntry[]> = new Map();
  // Last candidate waiting-room heartbeat by session. A heartbeat expires after
  // 15 seconds, so stale browser tabs never leave a session permanently ready.
  private waitingRoomPresence: Map<string, number> = new Map();

  // Platform Level Settings managed by Super Admin
  private platformSettings: PlatformSettings = {
    allow_self_registration: true,
    require_interviewer_verification: true,
    max_concurrent_interviews_per_host: 1, // Strictly 1 candidate at a time
    default_proctoring_strictness: 'high',
    recording_retention_days: 30
  };

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    const salt = bcrypt.genSaltSync(10);
    const defaultPasswordHash = bcrypt.hashSync('Password@123', salt);

    // 1. Super Admin User
    const adminId = 'u_admin_001';
    this.users.set(adminId, {
      id: adminId,
      email: 'admin@xprty.io',
      full_name: 'Dr. Sarah Mitchell',
      role: 'super_admin',
      password_hash: defaultPasswordHash,
      is_active: true,
      created_at: new Date().toISOString()
    });

    // 2. Verified Interviewer
    const interviewerId = 'u_interviewer_001';
    this.users.set(interviewerId, {
      id: interviewerId,
      email: 'interviewer@xprty.io',
      full_name: 'Alex Turner (Lead Architect)',
      role: 'interviewer',
      password_hash: defaultPasswordHash,
      is_active: true,
      created_at: new Date().toISOString()
    });

    this.interviewerProfiles.set(interviewerId, {
      id: uuidv4(),
      user_id: interviewerId,
      organization_name: 'XPRTY Engineering Labs',
      title: 'Principal Software Architect',
      verification_status: 'verified',
      total_interviews_conducted: 48,
      is_busy: false,
      current_active_session_id: null,
      created_at: new Date().toISOString()
    });

    // 3. Candidate 1 (Jordan Rivera)
    const candidateId1 = 'u_candidate_001';
    this.users.set(candidateId1, {
      id: candidateId1,
      email: 'jordan@example.com',
      full_name: 'Jordan Rivera (Senior React Engineer)',
      role: 'candidate',
      password_hash: defaultPasswordHash,
      is_active: true,
      created_at: new Date().toISOString()
    });

    this.candidateProfiles.set(candidateId1, {
      id: uuidv4(),
      user_id: candidateId1,
      phone: '+1-555-0199',
      resume_url: 'https://xprty.io/resumes/jordan-rivera.pdf',
      skills: ['React', 'TypeScript', 'WebRTC', 'Tailwind CSS', 'Distributed Systems'],
      created_at: new Date().toISOString()
    });

    // 4. Candidate 2 (Sophia Chen - for Queue demonstration)
    const candidateId2 = 'u_candidate_002';
    this.users.set(candidateId2, {
      id: candidateId2,
      email: 'sophia@example.com',
      full_name: 'Sophia Chen (Full-Stack Engineer)',
      role: 'candidate',
      password_hash: defaultPasswordHash,
      is_active: true,
      created_at: new Date().toISOString()
    });

    this.candidateProfiles.set(candidateId2, {
      id: uuidv4(),
      user_id: candidateId2,
      phone: '+1-555-0244',
      resume_url: 'https://xprty.io/resumes/sophia-chen.pdf',
      skills: ['Node.js', 'PostgreSQL', 'Express', 'React', 'Docker'],
      created_at: new Date().toISOString()
    });

    // 5. Active Interview Session for Candidate 1 (Key: XPRTY-SYS-2026)
    const sessionId1 = 'session_demo_101';
    const now = new Date();
    const scheduledEnd = new Date(now.getTime() + 60 * 60 * 1000);

    const demoSession1: InterviewSession = {
      id: sessionId1,
      session_code: 'XPRTY-SYS-2026',
      title: 'Senior Distributed Systems & React Architecture Interview',
      description: 'Technical evaluation covering high-concurrency Node.js, WebSockets, and React performance.',
      interviewer_id: interviewerId,
      candidate_id: candidateId1,
      jitsi_room_name: 'xprty-demo101-local-only',
      jitsi_room_url: 'https://meet.jit.si/xprty-demo101-local-only',
      meeting_provider: 'jitsi',
      status: 'scheduled',
      scheduled_start_time: now.toISOString(),
      scheduled_end_time: scheduledEnd.toISOString(),
      require_screen_share: true,
      require_fullscreen: true,
      require_webcam: true,
      require_audio: true,
      code_workspace_enabled: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };
    this.sessions.set(sessionId1, demoSession1);

    // 6. Second Interview Session assigned to same interviewer for Candidate 2 (Key: XPRTY-DEV-8899)
    const sessionId2 = 'session_demo_102';
    const demoSession2: InterviewSession = {
      id: sessionId2,
      session_code: 'XPRTY-DEV-8899',
      title: 'Full-Stack Node.js & Real-Time APIs Interview',
      description: 'System design and backend implementation evaluation.',
      interviewer_id: interviewerId,
      candidate_id: candidateId2,
      jitsi_room_name: 'xprty-demo102-local-only',
      jitsi_room_url: 'https://meet.jit.si/xprty-demo102-local-only',
      meeting_provider: 'jitsi',
      status: 'scheduled',
      scheduled_start_time: now.toISOString(),
      scheduled_end_time: scheduledEnd.toISOString(),
      require_screen_share: true,
      require_fullscreen: true,
      require_webcam: true,
      require_audio: true,
      code_workspace_enabled: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    };
    this.sessions.set(sessionId2, demoSession2);

    // Default Allowlisted Websites for session 1
    this.resources.set(sessionId1, [
      {
        id: uuidv4(),
        session_id: sessionId1,
        domain: 'developer.mozilla.org',
        title: 'MDN Web Docs',
        include_subdomains: true,
        is_active: true,
        added_by: interviewerId,
        created_at: now.toISOString()
      },
      {
        id: uuidv4(),
        session_id: sessionId1,
        domain: 'react.dev',
        title: 'Official React Documentation',
        include_subdomains: true,
        is_active: true,
        added_by: interviewerId,
        created_at: now.toISOString()
      }
    ]);
  }

  // --- Users & Profiles ---
  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  createUser(user: Omit<User, 'id' | 'created_at'>): User {
    const id = uuidv4();
    const newUser: User = {
      ...user,
      id,
      created_at: new Date().toISOString()
    };
    this.users.set(id, newUser);
    return newUser;
  }

  createUserWithId(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }

  // Profiles
  getInterviewerProfile(userId: string): InterviewerProfile | undefined {
    return this.interviewerProfiles.get(userId);
  }

  setInterviewerProfile(profile: InterviewerProfile): void {
    this.interviewerProfiles.set(profile.user_id, profile);
  }

  getAllInterviewerProfiles(): (InterviewerProfile & { user?: User })[] {
    return Array.from(this.interviewerProfiles.values()).map(p => ({
      ...p,
      user: this.getUserById(p.user_id)
    }));
  }

  getCandidateProfile(userId: string): CandidateProfile | undefined {
    return this.candidateProfiles.get(userId);
  }

  setCandidateProfile(profile: CandidateProfile): void {
    this.candidateProfiles.set(profile.user_id, profile);
  }

  // --- Single-Candidate Concurrency & Waiting Queue ---
  /**
   * Check if interviewer is currently busy with another candidate
   */
  isInterviewerBusy(interviewerId: string, currentSessionId?: string): boolean {
    const profile = this.interviewerProfiles.get(interviewerId);
    if (!profile) return false;

    // Check if profile explicitly marked busy and in different session
    if (profile.is_busy && profile.current_active_session_id && profile.current_active_session_id !== currentSessionId) {
      return true;
    }

    // Check if any other session of this interviewer is in 'in_progress'
    const activeSession = Array.from(this.sessions.values()).find(
      s => s.interviewer_id === interviewerId && s.status === 'in_progress' && s.id !== currentSessionId
    );
    return !!activeSession;
  }

  setInterviewerBusyStatus(interviewerId: string, isBusy: boolean, sessionId?: string | null) {
    const profile = this.interviewerProfiles.get(interviewerId);
    if (profile) {
      profile.is_busy = isBusy;
      profile.current_active_session_id = isBusy ? (sessionId || null) : null;
      this.interviewerProfiles.set(interviewerId, profile);
    }
  }

  /**
   * Add a candidate to the interviewer's queue
   */
  enqueueCandidate(interviewerId: string, sessionId: string, candidateId: string): QueueEntry {
    let queue = this.interviewerQueues.get(interviewerId) || [];
    
    // Remove if already in queue
    queue = queue.filter(q => q.sessionId !== sessionId);
    
    const candidate = this.getUserById(candidateId);
    const entry: QueueEntry = {
      sessionId,
      candidateId,
      candidateName: candidate ? candidate.full_name : 'Candidate',
      interviewerId,
      queuedAt: new Date().toISOString(),
      position: queue.length + 1
    };

    queue.push(entry);
    this.interviewerQueues.set(interviewerId, queue);
    return entry;
  }

  getQueueForInterviewer(interviewerId: string): QueueEntry[] {
    return this.interviewerQueues.get(interviewerId) || [];
  }

  getCandidateQueueStatus(interviewerId: string, sessionId: string): { inQueue: boolean; position: number; totalInQueue: number } {
    const queue = this.interviewerQueues.get(interviewerId) || [];
    const index = queue.findIndex(q => q.sessionId === sessionId);
    if (index === -1) {
      return { inQueue: false, position: 0, totalInQueue: queue.length };
    }
    return { inQueue: true, position: index + 1, totalInQueue: queue.length };
  }

  setCandidateWaiting(sessionId: string, present: boolean): void {
    if (present) this.waitingRoomPresence.set(sessionId, Date.now());
    else this.waitingRoomPresence.delete(sessionId);
  }

  isCandidateWaiting(sessionId: string): boolean {
    const lastSeen = this.waitingRoomPresence.get(sessionId);
    if (!lastSeen) return false;
    if (Date.now() - lastSeen > 15_000) { this.waitingRoomPresence.delete(sessionId); return false; }
    return true;
  }

  dequeueNextCandidate(interviewerId: string): QueueEntry | undefined {
    const queue = this.interviewerQueues.get(interviewerId) || [];
    if (queue.length === 0) return undefined;
    const next = queue.shift();
    // Update positions
    queue.forEach((item, idx) => {
      item.position = idx + 1;
    });
    this.interviewerQueues.set(interviewerId, queue);
    return next;
  }

  removeCandidateFromQueue(interviewerId: string, sessionId: string) {
    let queue = this.interviewerQueues.get(interviewerId) || [];
    queue = queue.filter(q => q.sessionId !== sessionId);
    queue.forEach((item, idx) => {
      item.position = idx + 1;
    });
    this.interviewerQueues.set(interviewerId, queue);
  }

  // --- Platform Settings (Super Admin) ---
  getPlatformSettings(): PlatformSettings {
    return this.platformSettings;
  }

  updatePlatformSettings(settings: Partial<PlatformSettings>): PlatformSettings {
    this.platformSettings = { ...this.platformSettings, ...settings };
    return this.platformSettings;
  }

  // --- Sessions ---
  getSessionById(id: string): InterviewSession | undefined {
    return this.sessions.get(id);
  }

  getSessionByCode(code: string): InterviewSession | undefined {
    return Array.from(this.sessions.values()).find(
      s => s.session_code.trim().toUpperCase() === code.trim().toUpperCase()
    );
  }

  getAllSessions(): InterviewSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionsForInterviewer(interviewerId: string): InterviewSession[] {
    return Array.from(this.sessions.values()).filter(s => s.interviewer_id === interviewerId);
  }

  getSessionsForCandidate(candidateId: string): InterviewSession[] {
    return Array.from(this.sessions.values()).filter(s => s.candidate_id === candidateId);
  }

  createSession(session: Omit<InterviewSession, 'id' | 'created_at' | 'updated_at'>): InterviewSession {
    const id = uuidv4();
    const newSession: InterviewSession = {
      ...session,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.sessions.set(id, newSession);
    return newSession;
  }

  updateSessionJitsiRoom(sessionId: string, room: { name: string; url: string }): InterviewSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    // A room is immutable once provisioned. This prevents a retry from
    // accidentally replacing an active interview's room.
    if (session.jitsi_room_name && session.jitsi_room_url) return session;
    session.jitsi_room_name = room.name;
    session.jitsi_room_url = room.url;
    session.meeting_provider = 'jitsi';
    session.updated_at = new Date().toISOString();
    this.sessions.set(sessionId, session);
    return session;
  }

  updateSessionStatus(sessionId: string, status: InterviewSession['status']): InterviewSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    session.status = status;
    session.updated_at = new Date().toISOString();
    
    if (status === 'in_progress') {
      if (!session.actual_start_time) {
        session.actual_start_time = new Date().toISOString();
      }
      // Mark interviewer as busy with this specific session
      this.setInterviewerBusyStatus(session.interviewer_id, true, sessionId);
    }
    
    if (status === 'completed' || status === 'cancelled') {
      if (!session.actual_end_time) {
        session.actual_end_time = new Date().toISOString();
      }
      // Release interviewer busy status if they were in this session
      const profile = this.interviewerProfiles.get(session.interviewer_id);
      if (profile && profile.current_active_session_id === sessionId) {
        this.setInterviewerBusyStatus(session.interviewer_id, false, null);
      }
      // Remove from waiting queue if completed
      this.removeCandidateFromQueue(session.interviewer_id, sessionId);
    }

    this.sessions.set(sessionId, session);
    return session;
  }

  // --- Resources ---
  getResources(sessionId: string): ResourcePermission[] {
    return this.resources.get(sessionId) || [];
  }

  addResource(resource: Omit<ResourcePermission, 'id' | 'created_at'>): ResourcePermission {
    const id = uuidv4();
    const newRes: ResourcePermission = {
      ...resource,
      id,
      created_at: new Date().toISOString()
    };
    const list = this.resources.get(resource.session_id) || [];
    list.push(newRes);
    this.resources.set(resource.session_id, list);
    return newRes;
  }

  toggleResource(sessionId: string, resourceId: string, isActive: boolean): boolean {
    const list = this.resources.get(sessionId);
    if (!list) return false;
    const item = list.find(r => r.id === resourceId);
    if (item) {
      item.is_active = isActive;
      return true;
    }
    return false;
  }

  deleteResource(sessionId: string, resourceId: string): boolean {
    const list = this.resources.get(sessionId);
    if (!list) return false;
    const filtered = list.filter(r => r.id !== resourceId);
    this.resources.set(sessionId, filtered);
    return true;
  }

  // --- Proctoring Events ---
  addProctoringEvent(event: Omit<ProctoringEvent, 'id' | 'detected_at'>): ProctoringEvent {
    const id = uuidv4();
    const newEvent: ProctoringEvent = {
      ...event,
      id,
      detected_at: new Date().toISOString()
    };
    const list = this.proctoringEvents.get(event.session_id) || [];
    list.unshift(newEvent);
    this.proctoringEvents.set(event.session_id, list);
    return newEvent;
  }

  getProctoringEvents(sessionId: string): ProctoringEvent[] {
    return this.proctoringEvents.get(sessionId) || [];
  }

  // --- Feedback ---
  saveFeedback(fb: Omit<InterviewFeedback, 'id' | 'submitted_at'>): InterviewFeedback {
    const id = uuidv4();
    const item: InterviewFeedback = {
      ...fb,
      id,
      submitted_at: new Date().toISOString()
    };
    this.feedback.set(fb.session_id, item);
    return item;
  }

  getFeedback(sessionId: string): InterviewFeedback | undefined {
    return this.feedback.get(sessionId);
  }

  // --- Notes ---
  getNotes(sessionId: string): InterviewNote[] {
    return this.notes.get(sessionId) || [];
  }

  saveNote(note: Omit<InterviewNote, 'id' | 'created_at' | 'updated_at'>): InterviewNote {
    const id = uuidv4();
    const now = new Date().toISOString();
    const item: InterviewNote = {
      ...note,
      id,
      created_at: now,
      updated_at: now
    };
    const list = this.notes.get(note.session_id) || [];
    list.unshift(item);
    this.notes.set(note.session_id, list);
    return item;
  }
}

export const db = new DatabaseService();
