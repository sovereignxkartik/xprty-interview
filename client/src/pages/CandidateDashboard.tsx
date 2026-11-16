import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api.service';
import { useAppStore } from '../store/useAppStore';
import { Logo } from '../components/ui/Logo';
import { VideoRoom } from '../components/video/VideoRoom';
import { CodeWorkspace } from '../components/code/CodeWorkspace';
import {
  Camera,
  Mic,
  Monitor,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  LogOut,
  Maximize2,
  Clock,
} from 'lucide-react';

export const CandidateDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sessionId = id || 'session_demo_101';

  const {
    currentUser,
    currentSession,
    setCurrentSession,
    allowlist,
    setAllowlist,
  } = useAppStore();

  const [hasCompletedCheck, setHasCompletedCheck] = useState(false);
  const [meetingDetails, setMeetingDetails] = useState<{ roomName: string; domain: string } | null>(null);
  const [candidateTab, setCandidateTab] = useState<'workspace' | 'resources'>('workspace');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [violationNotice, setViolationNotice] = useState<string | null>(null);
  const lastViolationAt = useRef<Record<string, number>>({});

  useEffect(() => {
    async function init() {
      try {
        const sessionData = await api.getSession(sessionId);
        setCurrentSession(sessionData);

        const resourcesData = await api.getResources(sessionId);
        setAllowlist(resourcesData);

        setMeetingDetails(await api.getMeetingDetails(sessionId));
      } catch (err) {
        console.error('Candidate init error', err);
      }
    }
    init();

    const socket = api.getSocket();

    socket.on('allowlist_refreshed', (updatedResources: any) => {
      setAllowlist(updatedResources);
    });
    socket.on('interview_status_update', ({ status }: { status: string }) => {
      const previous = useAppStore.getState().currentSession;
      if (previous) {
        setCurrentSession({ ...previous, status: status as typeof previous.status, actual_start_time: status === 'in_progress' ? new Date().toISOString() : previous.actual_start_time });
      }
    });

    return () => {
      socket.off('allowlist_refreshed');
      socket.off('interview_status_update');
    };
  }, [sessionId, currentUser]);

  const isAdmitted = currentSession?.status === 'in_progress';

  useEffect(() => {
    if (!hasCompletedCheck || isAdmitted || !currentUser) return;
    const socket = api.getSocket();
    socket.emit('join_interview_session', { sessionId, userId: currentUser.id, role: currentUser.role });
    const heartbeat = () => api.updateWaitingRoomPresence(sessionId).catch(() => {});
    heartbeat();
    const interval = window.setInterval(heartbeat, 5_000);
    return () => {
      window.clearInterval(interval);
      api.updateWaitingRoomPresence(sessionId, false).catch(() => {});
    };
  }, [hasCompletedCheck, isAdmitted, sessionId, currentUser]);

  useEffect(() => {
    if (!hasCompletedCheck || isAdmitted) return;
    const poll = window.setInterval(async () => {
      try { setCurrentSession(await api.getSession(sessionId)); } catch { /* retain waiting state until the next poll */ }
    }, 4000);
    return () => window.clearInterval(poll);
  }, [hasCompletedCheck, isAdmitted, sessionId]);

  useEffect(() => {
    if (!isAdmitted) { setElapsedSeconds(0); return; }
    const startedAt = currentSession?.actual_start_time ? new Date(currentSession.actual_start_time).getTime() : Date.now();
    const updateTimer = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [isAdmitted, currentSession?.actual_start_time]);

  // Dual-Layer Browser Proctoring Listeners
  useEffect(() => {
    if (!hasCompletedCheck) return;

    const socket = api.getSocket();
    const reportViolation = (eventType: any, severity: 'medium' | 'high' | 'critical', reason: string) => {
      const now = Date.now();
      if (now - (lastViolationAt.current[eventType] || 0) < 1_500) return;
      lastViolationAt.current[eventType] = now;
      const payload = { sessionId, userId: currentUser?.id, eventType, severity, metadata: { timestamp: new Date().toISOString(), reason } };
      if (socket.connected) socket.emit('report_proctoring_event', payload);
      else if (currentUser) api.reportProctoringEvent(sessionId, currentUser.id, eventType, severity, payload.metadata).catch(() => {});
      setViolationNotice(reason);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportViolation('tab_hidden', 'high', 'Tab switched or browser was minimized');
      }
    };

    const handleWindowBlur = () => {
      reportViolation('window_blur', 'high', 'Interview window lost focus');
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        reportViolation('fullscreen_exit', 'critical', 'Fullscreen mode was exited');
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F12' || (event.ctrlKey && event.shiftKey && ['I', 'J', 'C'].includes(event.key.toUpperCase()))) {
        event.preventDefault();
        reportViolation('dev_tools_opened', 'high', 'Developer tools shortcut was attempted');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [hasCompletedCheck, sessionId, currentUser]);

  const enterFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeResources = allowlist.filter((r) => r.is_active);

  if (currentSession?.status === 'completed') {
    return (
      <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-lg rounded-2xl border border-emerald-500/30 bg-[#161412] p-10 text-center">
          <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-400" strokeWidth={1.3} />
          <div className="mt-7 text-[10px] tracking-[0.35em] uppercase text-emerald-300">Interview completed</div>
          <h1 className="mt-4 text-3xl font-serif font-light">Your interview has successfully ended</h1>
          <p className="mt-4 text-[13px] leading-[1.8] text-[#A9A39A]">Thank you for your time. Your interviewer has closed this session and your participation has been recorded.</p>
          <button onClick={() => navigate('/')} className="mt-8 h-11 px-7 rounded-full bg-[#F4F2EB] text-[#0E0C0B] text-[11px] font-semibold tracking-[0.16em] uppercase">Return home</button>
        </div>
      </div>
    );
  }

  /* ----------------------------- Readiness screen ----------------------------- */
  if (!hasCompletedCheck) {
    const checks = [
      {
        icon: Camera,
        title: 'Webcam video permission',
        text: 'Face video stream active for proctoring verification',
      },
      {
        icon: Mic,
        title: 'Microphone audio input',
        text: 'Two-way audio transmission enabled',
      },
      {
        icon: Monitor,
        title: 'Entire desktop sharing',
        text: 'Live view of code workspace and authorized resources',
      },
    ];

    return (
      <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex flex-col font-sans">
        <header className="border-b border-white/[0.07]">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
            <Logo size="md" />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-14">
          <div className="w-full max-w-xl">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full border border-[#DB7A57]/30 text-[#DB7A57] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" strokeWidth={1.4} />
              </div>
              <div className="mt-7 text-[10px] tracking-[0.35em] uppercase text-[#DB7A57]">
                Candidate Pre-Flight Verification
              </div>
              <h1 className="mt-4 text-4xl font-serif font-light tracking-tight leading-[1.1]">
                Readiness &amp; <span className="italic text-[#DB7A57]">integrity check</span>
              </h1>
            </div>

            <div className="mt-10 border-t border-white/[0.08]">
              {checks.map((c) => (
                <div
                  key={c.title}
                  className="flex items-center justify-between py-5 border-b border-white/[0.08]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-[#DB7A57] shrink-0">
                      <c.icon className="w-4 h-4" strokeWidth={1.4} />
                    </div>
                    <div>
                      <div className="text-[14px] font-serif">{c.title}</div>
                      <div className="text-[12px] text-[#A9A39A] font-light mt-0.5">{c.text}</div>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={1.6} />
                </div>
              ))}
            </div>

            <div className="mt-8 px-5 py-4 rounded-xl border border-[#DB7A57]/20 bg-[#DB7A57]/[0.06] text-[12px] text-[#CBC3B9] leading-[1.8] font-light">
              <span className="block text-[10px] tracking-[0.25em] uppercase text-[#DB7A57] mb-1.5">
                Dual-layer proctoring notice
              </span>
              By entering the session, you acknowledge and agree that window focus changes, tab
              visibility switches, and external domain visits will be logged and streamed in real
              time to the interviewer.
            </div>

            <button
              onClick={() => {
                setHasCompletedCheck(true);
                enterFullscreen();
              }}
              className="mt-8 w-full h-12 rounded-full bg-[#DB7A57] hover:bg-[#E58C6A] text-[#0E0C0B] text-[11px] font-semibold tracking-[0.2em] uppercase flex items-center justify-center gap-2"
            >
              <span>Confirm readiness &amp; enter room</span>
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmitted) {
    return (
      <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#161412] p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-full border border-[#DB7A57]/30 flex items-center justify-center text-[#DB7A57]"><Clock className="w-6 h-6" /></div>
          <div className="mt-7 text-[10px] tracking-[0.35em] uppercase text-[#DB7A57]">Waiting room</div>
          <h1 className="mt-4 text-3xl font-serif font-light">Ready for your interviewer</h1>
          <p className="mt-4 text-[13px] leading-[1.8] text-[#A9A39A]">Your readiness check is complete. Your interviewer has been notified and will admit you when the session is ready. The interview timer has not started.</p>
          <div className="mt-8 pt-6 border-t border-white/[0.07] flex items-center justify-center gap-2 text-[11px] text-[#6B6761]"><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />Waiting for admission</div>
        </div>
      </div>
    );
  }

  /* ------------------------------- Live session ------------------------------- */
  const tabs = [
    { id: 'workspace' as const, label: 'Coding Workspace' },
    { id: 'resources' as const, label: `Approved Documentation (${activeResources.length})` },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0E0C0B] text-[#F4F2EB] overflow-hidden font-sans">
      {/* Header */}
      <header className="h-16 px-6 border-b border-white/[0.07] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5 min-w-0">
          <Logo size="sm" />
          <div className="h-6 w-px bg-white/10" />
          <div className="min-w-0">
            <h1 className="text-base font-serif font-light truncate">
              {currentSession?.title || 'Technical Evaluation'}
            </h1>
            <p className="text-[11px] text-[#A9A39A] font-light">Candidate Interview Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-[#DB7A57]" strokeWidth={1.5} />
            <span className="font-mono text-sm tracking-wider tabular-nums">
              {formatTimer(elapsedSeconds)}
            </span>
          </div>

          <span className="hidden sm:flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase px-3 py-1 rounded-full border border-emerald-500/40 text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.6} />
            Proctored session
          </span>

          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-[#A9A39A] hover:text-[#F4F2EB] hover:border-white/30"
            title="Leave Session"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {violationNotice && (
        <div role="alert" className="fixed z-[100] top-20 left-1/2 w-[min(92vw,520px)] -translate-x-1/2 rounded-xl border border-rose-500/60 bg-[#260d0c] p-4 text-center shadow-2xl">
          <button onClick={() => setViolationNotice(null)} className="absolute right-3 top-3 rounded p-1 text-rose-100 hover:bg-white/10" aria-label="Dismiss proctoring warning">×</button>
          <p className="text-[10px] tracking-[0.22em] uppercase text-rose-300">Proctoring violation recorded</p>
          <p className="mt-2 text-sm text-[#F4F2EB]">{violationNotice}</p>
          <button onClick={() => { setViolationNotice(null); enterFullscreen(); }} className="mt-3 h-8 px-4 rounded-full border border-rose-300/40 text-[10px] tracking-[0.15em] uppercase text-rose-100">Return to fullscreen</button>
        </div>
      )}

      {/* Workspace */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Video */}
        <section className="w-[45%] flex flex-col h-full shrink-0">
          <VideoRoom
            roomName={meetingDetails?.roomName || currentSession?.jitsi_room_name || ''}
            domain={meetingDetails?.domain || 'meet.jit.si'}
            userName={currentUser?.full_name || 'Candidate'}
            onLeave={() => navigate('/')}
          />
        </section>

        {/* Candidate workspace */}
        <section className="flex-1 flex flex-col h-full min-w-0">
          <div className="flex items-center gap-8 border-b border-white/[0.07] mb-3 shrink-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setCandidateTab(t.id)}
                className={`relative h-10 text-[11px] tracking-[0.2em] uppercase ${
                  candidateTab === t.id ? 'text-[#F4F2EB]' : 'text-[#A9A39A] hover:text-[#F4F2EB]'
                }`}
              >
                {t.label}
                {candidateTab === t.id && (
                  <span className="absolute left-0 right-0 bottom-0 h-px bg-[#DB7A57]" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            {candidateTab === 'workspace' ? (
              <CodeWorkspace />
            ) : (
              <div className="flex flex-col h-full bg-[#161412] border border-white/[0.08] rounded-2xl p-8 overflow-y-auto">
                <h3 className="text-2xl font-serif font-light tracking-tight">
                  Approved documentation
                </h3>
                <p className="mt-2 text-[13px] text-[#A9A39A] font-light">
                  The host interviewer has granted access to the following documentation websites.
                </p>

                {activeResources.length === 0 ? (
                  <div className="mt-8 py-12 text-center text-[12px] text-[#6B6761] border border-white/[0.08] rounded-xl">
                    No websites have been approved yet.
                  </div>
                ) : (
                  <div className="mt-8 border-t border-white/[0.08]">
                    {activeResources.map((res) => (
                      <div
                        key={res.id}
                        className="py-5 border-b border-white/[0.08] flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="text-[15px] font-serif truncate">{res.title}</div>
                          <div className="mt-0.5 text-[12px] font-mono text-[#DB7A57] truncate">
                            {res.domain}
                          </div>
                        </div>
                        <a
                          href={`https://${res.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-2 h-9 px-5 rounded-full border border-white/15 hover:border-[#DB7A57]/60 text-[11px] tracking-[0.15em] uppercase text-[#F4F2EB]"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
