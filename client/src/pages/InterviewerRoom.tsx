import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.service';
import { useAppStore } from '../store/useAppStore';
import { Logo } from '../components/ui/Logo';
import { VideoRoom } from '../components/video/VideoRoom';
import { ProctoringMonitor } from '../components/proctoring/ProctoringMonitor';
import { AllowlistManager } from '../components/allowlist/AllowlistManager';
import { CodeWorkspace } from '../components/code/CodeWorkspace';
import { EvaluationModal } from '../components/feedback/EvaluationModal';
import { ProctoringEvent } from '../types';
import { Clock, Award, LogOut, Play, CheckCircle, AlertCircle, Key, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';

export const InterviewerRoom: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sessionId = id || 'session_demo_101';

  const {
    currentUser,
    currentSession,
    setCurrentSession,
    allowlist,
    setAllowlist,
    addResource,
    updateResourceStatus,
    removeResource,
    proctoringEvents,
    setProctoringEvents,
    addProctoringEvent,
  } = useAppStore();

  const [activeCenterTab, setActiveCenterTab] = useState<'video' | 'code' | 'resources'>('video');
  const [activeRightTab, setActiveRightTab] = useState<'proctoring' | 'allowlist' | 'notes'>('proctoring');
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [meetingDetails, setMeetingDetails] = useState<{ roomName: string; domain: string } | null>(null);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isScreenShareActive, setIsScreenShareActive] = useState(false);
  const [candidatePresent, setCandidatePresent] = useState(false);
  const [isVideoMaximized, setIsVideoMaximized] = useState(false);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [latestIncident, setLatestIncident] = useState<ProctoringEvent | null>(null);
  const isLive = currentSession?.status === 'in_progress';

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'interviewer' && currentUser.role !== 'super_admin')) {
      navigate('/login');
      return;
    }

    async function loadData() {
      try {
        const sessionData = await api.getSession(sessionId);
        setCurrentSession(sessionData);

        const resourcesData = await api.getResources(sessionId);
        setAllowlist(resourcesData);

        const eventsData = await api.getProctoringEvents(sessionId);
        setProctoringEvents(eventsData);

        setMeetingDetails(await api.getMeetingDetails(sessionId));
      } catch (err: any) {
        console.error('Session load error', err);
      }
    }
    loadData();

    // Socket Setup
    const socket = api.getSocket();
    socket.emit('join_interview_session', {
      sessionId,
      userId: currentUser.id,
      role: currentUser.role,
    });

    socket.on('proctoring_alert', (event: ProctoringEvent) => {
      addProctoringEvent(event);
      setLatestIncident(event);
      setActiveRightTab('proctoring');
    });

    socket.on('allowlist_refreshed', (updated: any) => {
      setAllowlist(updated);
    });
    socket.on('candidate_waiting', ({ present }: { present: boolean }) => setCandidatePresent(present));

    return () => {
      socket.off('proctoring_alert');
      socket.off('allowlist_refreshed');
      socket.off('candidate_waiting');
    };
  }, [sessionId, currentUser]);

  useEffect(() => {
    if (isLive) return;
    const refreshPresence = async () => {
      try { setCandidatePresent((await api.getWaitingRoomPresence(sessionId)).present); } catch { /* socket presence remains as fallback */ }
    };
    refreshPresence();
    const interval = window.setInterval(refreshPresence, 2_000);
    return () => window.clearInterval(interval);
  }, [sessionId, isLive]);

  useEffect(() => {
    if (currentSession?.status !== 'in_progress') {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = currentSession.actual_start_time ? new Date(currentSession.actual_start_time).getTime() : Date.now();
    const updateTimer = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [currentSession?.status, currentSession?.actual_start_time]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartInterview = async () => {
    if (!candidatePresent) {
      setStatusError('The candidate has not joined the waiting room yet. Start is available once they are present.');
      return;
    }
    setStatusError(null);
    try {
      const response = await api.updateSessionStatus(sessionId, 'in_progress');
      setCurrentSession(response.updated);
      api.getSocket().emit('interview_status_changed', { sessionId, status: 'in_progress' });
    } catch (err: any) {
      setStatusError(err.message);
    }
  };

  const handleCompleteInterview = async () => {
    try {
      const res = await api.endInterview(sessionId);
      setCurrentSession(res.updated || { ...currentSession!, status: 'completed' });
      api.getSocket().emit('interview_status_changed', { sessionId, status: 'completed' });
      setShowEvaluation(true);
    } catch (err: any) {
      setStatusError(err.message || 'Could not end the interview.');
    }
  };

  const handleAddResource = async (domain: string, title: string, includeSubdomains: boolean) => {
    try {
      const newRes = await api.addResource(sessionId, domain, title, includeSubdomains);
      addResource(newRes);
      api.getSocket().emit('allowlist_updated', { sessionId });
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleResource = async (resId: string, isActive: boolean) => {
    try {
      await api.toggleResource(sessionId, resId, isActive);
      updateResourceStatus(resId, isActive);
      api.getSocket().emit('allowlist_updated', { sessionId });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteResource = async (resId: string) => {
    try {
      await api.deleteResource(sessionId, resId);
      removeResource(resId);
      api.getSocket().emit('allowlist_updated', { sessionId });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitEvaluation = async (feedbackData: any) => {
    await api.submitFeedback(sessionId, feedbackData);
    setStatusError('Scorecard saved. The evaluation is available to you and platform administrators.');
  };

  const statusLabel = String(currentSession?.status || 'scheduled').replace('_', ' ');
  const candidate = currentSession?.candidate;
  const candidateProfile = currentSession?.candidate_profile;

  const centerTabs = [
    { id: 'video' as const, label: 'Video & Screen' },
    { id: 'code' as const, label: 'Live Code' },
  ];

  const rightTabs = [
    { id: 'proctoring' as const, label: `Proctoring (${proctoringEvents.length})` },
    { id: 'allowlist' as const, label: 'Allowlist' },
    { id: 'notes' as const, label: 'Notes' },
  ];

  const panel = 'bg-[#161412] border border-white/[0.08] rounded-2xl';

  if (currentSession?.status === 'completed') {
    return (
      <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-xl rounded-2xl border border-emerald-500/30 bg-[#161412] p-10 text-center">
          <CheckCircle className="w-14 h-14 mx-auto text-emerald-400" strokeWidth={1.3} />
          <div className="mt-7 text-[10px] tracking-[0.35em] uppercase text-emerald-300">Session released</div>
          <h1 className="mt-4 text-3xl font-serif font-light">Interview ended for both participants</h1>
          <p className="mt-4 text-[13px] leading-[1.8] text-[#A9A39A]">Complete the scorecard now. It is stored securely and visible to you and platform administrators.</p>
          <div className="mt-8 flex justify-center gap-3"><button onClick={() => setShowEvaluation(true)} className="h-11 px-7 rounded-full bg-[#DB7A57] text-[#0E0C0B] text-[11px] font-semibold tracking-[0.16em] uppercase">{currentSession.feedback ? 'View scorecard' : 'Complete scorecard'}</button><button onClick={() => navigate('/interviewer')} className="h-11 px-7 rounded-full border border-white/15 text-[11px] font-semibold tracking-[0.16em] uppercase">Back to dashboard</button></div>
        </div>
        {showEvaluation && <EvaluationModal sessionId={sessionId} interviewerId={currentUser?.id || ''} candidateName={currentSession?.candidate?.full_name || 'Candidate'} existingFeedback={currentSession.feedback} onSubmit={handleSubmitEvaluation} onClose={() => setShowEvaluation(false)} />}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0E0C0B] text-[#F4F2EB] overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 px-6 border-b border-white/[0.07] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5 min-w-0">
          <Logo size="sm" />
          <div className="h-6 w-px bg-white/10" />
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-base font-serif font-light truncate">
                {currentSession?.title || 'Technical Evaluation'}
              </h1>
              <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider px-2.5 py-0.5 rounded-full border border-[#DB7A57]/30 text-[#DB7A57]">
                <Key className="w-3 h-3" strokeWidth={1.5} />
                {currentSession?.session_code || 'XPRTY-SYS-2026'}
              </span>
            </div>
            <p className="text-[11px] text-[#A9A39A] font-light">
              Candidate{' '}
              <span className="text-[#F4F2EB]">
                {candidate?.full_name || 'Loading candidate…'}
              </span>
            </p>
          </div>
        </div>

        {/* Timer & status */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-[#DB7A57]" strokeWidth={1.5} />
            <span className="font-mono text-sm tracking-wider tabular-nums">
              {formatTimer(elapsedSeconds)}
            </span>
          </div>
          <span
            className={`text-[10px] tracking-[0.2em] uppercase px-3 py-1 rounded-full border ${
              isLive
                ? 'text-emerald-300 border-emerald-500/40'
                : 'text-[#CBC3B9] border-white/15'
            }`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {!isLive ? (
            <button
              onClick={handleStartInterview}
              disabled={!candidatePresent}
              className="flex items-center gap-2 h-9 px-5 rounded-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-45 disabled:cursor-not-allowed text-[#0E0C0B] text-[11px] font-semibold tracking-[0.15em] uppercase"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{candidatePresent ? 'Start & Admit' : 'Waiting for candidate'}</span>
            </button>
          ) : (
            <button
              onClick={handleCompleteInterview}
              className="flex items-center gap-2 h-9 px-5 rounded-full border border-rose-500/50 text-rose-300 hover:bg-rose-500/10 text-[11px] font-semibold tracking-[0.15em] uppercase"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>End & Release</span>
            </button>
          )}

          <button
            onClick={() => setShowEvaluation(true)}
            className="flex items-center gap-2 h-9 px-5 rounded-full bg-[#DB7A57] hover:bg-[#E58C6A] text-[#0E0C0B] text-[11px] font-semibold tracking-[0.15em] uppercase"
          >
            <Award className="w-3.5 h-3.5" />
            <span>{currentSession?.feedback ? 'View Scorecard' : 'Scorecard'}</span>
          </button>

          <button
            onClick={() => navigate('/interviewer')}
            className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-[#A9A39A] hover:text-[#F4F2EB] hover:border-white/30"
            title="Exit Room"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {statusError && (
        <div className="bg-rose-950/60 border-b border-rose-900 px-6 py-2.5 text-[12px] text-rose-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{statusError}</span>
          </div>
          <button onClick={() => setStatusError(null)} className="text-[#A9A39A] hover:text-white">
            ✕
          </button>
        </div>
      )}

      {latestIncident && (
        <div role="alert" className="fixed z-[100] right-6 top-20 w-full max-w-sm rounded-xl border border-rose-500/50 bg-[#21100f] p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] tracking-[0.2em] uppercase text-rose-300">Live proctoring alert</div><p className="mt-1 text-sm text-[#F4F2EB]">{latestIncident.event_type.replace(/_/g, ' ')}</p><p className="mt-1 text-[11px] text-[#CBC3B9]">{latestIncident.metadata?.reason || 'Candidate activity requires review.'}</p></div><button onClick={() => setLatestIncident(null)} className="text-[#A9A39A] hover:text-white" aria-label="Dismiss proctoring alert">×</button></div>
        </div>
      )}

      {/* 3-panel layout */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* LEFT: Candidate dossier */}
        <aside className={`${panel} ${isLeftCollapsed ? 'w-12 p-2' : 'w-[260px] p-6'} flex flex-col justify-between shrink-0 overflow-hidden transition-[width,padding] duration-200 ${isVideoMaximized ? 'hidden' : ''}`}>
          <button onClick={() => setIsLeftCollapsed((value) => !value)} className="w-8 h-8 shrink-0 rounded-lg border border-white/10 text-[#A9A39A] hover:text-[#F4F2EB] flex items-center justify-center" title={isLeftCollapsed ? 'Expand candidate panel' : 'Collapse candidate panel'}>{isLeftCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}</button>
          {!isLeftCollapsed && <>
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-[#DB7A57]">
              Candidate Dossier
            </div>
            <div className="mt-5 pb-5 border-b border-white/[0.07]">
              <div className="text-xl font-serif font-light">
                {currentSession?.candidate?.full_name || 'Jordan Rivera'}
              </div>
              <div className="mt-1 text-[11px] font-mono text-[#A9A39A] break-all">
                {candidate?.email || 'Candidate details are loading'}
              </div>
            </div>

            <dl className="mt-2 text-[12px]">
              <div className="flex justify-between items-center py-3.5 border-b border-white/[0.07]">
                <dt className="text-[#A9A39A] font-light">Connection</dt>
                <dd className="text-emerald-300 font-mono">Live · 1080p</dd>
              </div>
              <div className="flex justify-between items-center py-3.5 border-b border-white/[0.07]">
                <dt className="text-[#A9A39A] font-light">Skills</dt>
                <dd className="text-[#F4F2EB] text-right max-w-[135px]">{candidateProfile?.skills?.length ? candidateProfile.skills.join(', ') : 'Not provided'}</dd>
              </div>
              <div className="flex justify-between items-center py-3.5">
                <dt className="text-[#A9A39A] font-light">Guardian</dt>
                <dd className="text-emerald-300 font-mono">Active · V3</dd>
              </div>
              <div className="flex justify-between items-center py-3.5 border-t border-white/[0.07]">
                <dt className="text-[#A9A39A] font-light">Phone</dt>
                <dd className="text-[#F4F2EB] font-mono text-right break-all">{candidateProfile?.phone || 'Not provided'}</dd>
              </div>
              <div className="flex justify-between items-center py-3.5 border-t border-white/[0.07]">
                <dt className="text-[#A9A39A] font-light">Portfolio</dt>
                <dd className="text-[#F4F2EB] text-right max-w-[135px] break-all">{candidateProfile?.portfolio_url || 'Not provided'}</dd>
              </div>
              <div className="flex justify-between items-center py-3.5 border-t border-white/[0.07]">
                <dt className="text-[#A9A39A] font-light">Resume</dt>
                <dd className="text-[#F4F2EB] text-right max-w-[135px] break-all">{candidateProfile?.resume_url || 'Not provided'}</dd>
              </div>
            </dl>
          </div>

          <p className="text-[11px] text-[#6B6761] leading-[1.8] font-light">
            <span className="text-[#A9A39A]">Strict 1-to-1 concurrency.</span> Other candidates
            assigned to you stay in the live queue until this interview is marked completed.
          </p>
          </>}
        </aside>

        {/* CENTER: Main stage */}
        <section className={`${isVideoMaximized ? 'fixed inset-0 z-50 bg-[#0E0C0B] p-4 pt-20 overflow-hidden' : 'flex-1'} flex flex-col h-full min-w-0`}>
          <div className="flex items-center gap-8 border-b border-white/[0.07] mb-3 shrink-0">
            {centerTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveCenterTab(t.id)}
                className={`relative h-10 text-[11px] tracking-[0.2em] uppercase ${
                  activeCenterTab === t.id ? 'text-[#F4F2EB]' : 'text-[#A9A39A] hover:text-[#F4F2EB]'
                }`}
              >
                {t.label}
                {activeCenterTab === t.id && (
                  <span className="absolute left-0 right-0 bottom-0 h-px bg-[#DB7A57]" />
                )}
              </button>
            ))}
            <button onClick={() => { if (!isVideoMaximized) setActiveCenterTab('video'); setIsVideoMaximized((value) => !value); }} className="ml-auto mb-1 w-8 h-8 rounded-lg border border-white/10 text-[#A9A39A] hover:text-[#F4F2EB] flex items-center justify-center" title={isVideoMaximized ? 'Restore layout' : 'Maximize video and screen'}>
              {isVideoMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex-1 min-h-0 relative">
            <div className={`absolute inset-0 ${activeCenterTab === 'video' ? '' : 'invisible pointer-events-none'}`}>
              <VideoRoom
                roomName={meetingDetails?.roomName || currentSession?.jitsi_room_name || ''}
                domain={meetingDetails?.domain || 'meet.jit.si'}
                userName={currentUser?.full_name || 'Alex Turner (Host)'}
                onScreenShareToggle={setIsScreenShareActive}
                onLeave={() => navigate('/interviewer')}
              />
            </div>
            <div className={`absolute inset-0 ${activeCenterTab === 'code' ? '' : 'invisible pointer-events-none'}`}><CodeWorkspace /></div>
          </div>
        </section>

        {/* RIGHT: Proctoring, allowlist, notes */}
        <aside className={`${isRightCollapsed ? 'w-12' : 'w-[380px]'} flex flex-col h-full shrink-0 overflow-hidden transition-[width] duration-200 ${isVideoMaximized ? 'hidden' : ''}`}>
          <button onClick={() => setIsRightCollapsed((value) => !value)} className="mb-3 w-8 h-8 shrink-0 rounded-lg border border-white/10 text-[#A9A39A] hover:text-[#F4F2EB] flex items-center justify-center" title={isRightCollapsed ? 'Expand tools panel' : 'Collapse tools panel'}>{isRightCollapsed ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}</button>
          {!isRightCollapsed && <>
          <div className="flex items-center gap-7 border-b border-white/[0.07] mb-3 shrink-0">
            {rightTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveRightTab(t.id)}
                className={`relative h-10 text-[11px] tracking-[0.2em] uppercase ${
                  activeRightTab === t.id ? 'text-[#F4F2EB]' : 'text-[#A9A39A] hover:text-[#F4F2EB]'
                }`}
              >
                {t.label}
                {activeRightTab === t.id && (
                  <span className="absolute left-0 right-0 bottom-0 h-px bg-[#DB7A57]" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            {activeRightTab === 'proctoring' && (
              <ProctoringMonitor events={proctoringEvents} isScreenSharingActive={isScreenShareActive} />
            )}
            {activeRightTab === 'allowlist' && (
              <AllowlistManager
                resources={allowlist}
                onAddResource={handleAddResource}
                onToggleResource={handleToggleResource}
                onDeleteResource={handleDeleteResource}
                isInterviewer={true}
              />
            )}
            {activeRightTab === 'notes' && (
              <div className={`${panel} flex flex-col h-full p-6`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-serif font-light">Private notes</h3>
                  <span className="text-[10px] tracking-[0.2em] uppercase text-[#6B6761]">
                    Protected
                  </span>
                </div>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Record timestamped interviewer notes, code evaluation comments, and candidate strengths..."
                  className="flex-1 w-full p-4 rounded-xl bg-[#0E0C0B] border border-white/10 text-[12px] text-[#F4F2EB] placeholder-[#6B6761] focus:outline-none focus:border-[#DB7A57]/70 resize-none font-mono leading-[1.8]"
                />
              </div>
            )}
          </div>
          </>}
        </aside>
      </main>

      {/* Scorecard Modal */}
      {showEvaluation && (
        <EvaluationModal
          sessionId={sessionId}
          interviewerId={currentUser?.id || 'u_interviewer_001'}
          candidateName={currentSession?.candidate?.full_name || 'Jordan Rivera'}
          existingFeedback={currentSession?.feedback}
          onSubmit={handleSubmitEvaluation}
          onClose={() => setShowEvaluation(false)}
        />
      )}
    </div>
  );
};
