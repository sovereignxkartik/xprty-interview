import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middlewares/auth.middleware';
import { db } from '../services/database.service';
import { getInterviewById, isInterviewCandidateWaiting, setInterviewWaitingPresence, recordInterviewProctoringEvent } from '../services/interview.service';
import { ProctoringEventType, ProctoringSeverity } from '../types';

export function setupSocketHandlers(io: Server) {
  const candidateSockets = new Map<string, Set<string>>();
  // Socket Authentication Middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    // Allow anonymous candidate key connections if interviewKey provided
    const interviewKey = socket.handshake.auth.interviewKey || socket.handshake.query.interviewKey;
    if (interviewKey) {
      const session = db.getSessionByCode(interviewKey as string);
      if (session) {
        (socket as any).authenticatedUser = {
          id: session.candidate_id,
          role: 'candidate',
          sessionId: session.id
        };
        return next();
      }
    }

    if (!token) {
      // Mark as unverified socket
      (socket as any).authenticatedUser = null;
      return next();
    }

    jwt.verify(token as string, JWT_SECRET, (err, decoded: any) => {
      if (err) {
        (socket as any).authenticatedUser = null;
        return next();
      }
      (socket as any).authenticatedUser = decoded;
      next();
    });
  });

  io.on('connection', (socket: Socket) => {
    const authUser = (socket as any).authenticatedUser;
    console.log(`[Socket.io] Client connected: ${socket.id} (User: ${authUser?.id || 'guest'})`);

    // Join Interview Session Room with Membership Validation
    socket.on('join_interview_session', async ({ sessionId, userId, role }: { sessionId: string; userId: string; role: string }) => {
      const session = await getInterviewById(sessionId);
      if (!session) {
        socket.emit('error', { message: 'Session does not exist.' });
        return;
      }

      // Security check: Verify user is participant in this session or an admin
      if (authUser && authUser.role !== 'super_admin') {
        if (session.interviewer_id !== authUser.id && session.candidate_id !== authUser.id) {
          console.warn(`[Socket.io] Blocked unauthorized session join attempt from user: ${authUser.id}`);
          socket.emit('error', { message: 'Unauthorized to join this interview session room.' });
          return;
        }
      }

      socket.join(`session:${sessionId}`);
      (socket.data as any).sessionId = sessionId;
      (socket.data as any).role = authUser?.role || role;
      if ((authUser?.role || role) === 'candidate') {
        await setInterviewWaitingPresence(session, true);
        const sockets = candidateSockets.get(sessionId) || new Set<string>();
        sockets.add(socket.id);
        candidateSockets.set(sessionId, sockets);
        io.to(`session:${sessionId}`).emit('candidate_waiting', { present: true, timestamp: new Date().toISOString() });
      } else if ((authUser?.role || role) === 'interviewer' || (authUser?.role || role) === 'super_admin') {
        socket.emit('candidate_waiting', { present: await isInterviewCandidateWaiting(sessionId) });
      }
      console.log(`[Socket.io] Validated user ${userId} (${role}) joined session:${sessionId}`);
      
      socket.to(`session:${sessionId}`).emit('participant_joined', {
        userId,
        role,
        timestamp: new Date().toISOString()
      });
    });

    // Authenticated Proctoring Event Telemetry
    socket.on('report_proctoring_event', async (data: {
      sessionId: string;
      userId: string;
      eventType: ProctoringEventType;
      severity: ProctoringSeverity;
      metadata?: Record<string, any>;
    }) => {
      const { sessionId, userId, eventType, severity, metadata } = data;
      const session = await getInterviewById(sessionId);
      if (!session) return;

      // Ensure user reporting matches session candidate or extension agent
      const effectiveUserId = authUser?.id || session.candidate_id;
      if (effectiveUserId !== session.candidate_id) return;

      const recordedEvent = await recordInterviewProctoringEvent({
        session_id: sessionId,
        user_id: effectiveUserId,
        event_type: eventType,
        severity: severity || 'medium',
        metadata: metadata || {}
      });

      console.warn(`[Proctoring Engine] Verified event for session ${sessionId} [${severity}]: ${eventType}`);

      // Broadcast to interviewer in the session room
      io.to(`session:${sessionId}`).emit('proctoring_alert', recordedEvent);
    });

    // Interviewer website allowlist updates
    socket.on('allowlist_updated', ({ sessionId }: { sessionId: string }) => {
      const resources = db.getResources(sessionId);
      io.to(`session:${sessionId}`).emit('allowlist_refreshed', resources);
    });

    // Real-time status update
    socket.on('interview_status_changed', ({ sessionId, status }: { sessionId: string; status: any }) => {
      io.to(`session:${sessionId}`).emit('interview_status_update', {
        status,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('disconnect', async () => {
      const sessionId = (socket.data as any).sessionId;
      if (sessionId && (socket.data as any).role === 'candidate') {
        const sockets = candidateSockets.get(sessionId);
        sockets?.delete(socket.id);
        if (!sockets?.size) {
          const session = await getInterviewById(sessionId);
          if (session) await setInterviewWaitingPresence(session, false);
          candidateSockets.delete(sessionId);
          io.to(`session:${sessionId}`).emit('candidate_waiting', { present: false, timestamp: new Date().toISOString() });
        }
      }
      console.log(`[Socket.io] Disconnected: ${socket.id}`);
    });
  });
}
