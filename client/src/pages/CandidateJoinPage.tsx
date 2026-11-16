import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api.service';
import { useAppStore } from '../store/useAppStore';
import { Logo } from '../components/ui/Logo';
import {
  Key,
  ArrowRight,
  Clock,
  ShieldCheck,
  AlertCircle,
  RotateCw,
} from 'lucide-react';

const DEMO_KEYS = [
  {
    key: 'XPRTY-SYS-2026',
    note: 'Candidate 1 · Jordan Rivera',
    tag: 'Primary',
    tagClass: 'text-[#DB7A57] border-[#DB7A57]/30',
  },
  {
    key: 'XPRTY-DEV-8899',
    note: 'Candidate 2 · Sophia Chen',
    tag: 'Queue Test',
    tagClass: 'text-amber-400 border-amber-700/50',
  },
];

export const CandidateJoinPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledKey = (location.state as { key?: string } | null)?.key;

  const [interviewKey, setInterviewKey] = useState(prefilledKey || 'XPRTY-SYS-2026');
  const setAuth = useAppStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notOpenSession, setNotOpenSession] = useState<{ title: string; scheduled_start_time: string } | null>(null);
  const [closedOutcome, setClosedOutcome] = useState<'MISSED' | 'ALREADY_ATTEMPTED' | null>(null);
  const [now, setNow] = useState(Date.now());

  // Queue State
  const [isQueued, setIsQueued] = useState(false);
  const [queueInfo, setQueueInfo] = useState<{
    position: number;
    totalInQueue: number;
    interviewerName: string;
    sessionId: string;
    sessionCode: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (!isQueued || !queueInfo) return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getQueueStatus(queueInfo.sessionId);
        if (status.canJoinNow) {
          clearInterval(interval);
          navigate(`/candidate/${queueInfo.sessionId}`);
        } else {
          setQueueInfo((prev) =>
            prev ? { ...prev, position: status.position, totalInQueue: status.totalInQueue } : null
          );
        }
      } catch (err) {
        console.error('Queue check error', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isQueued, queueInfo, navigate]);

  useEffect(() => {
    if (!notOpenSession) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [notOpenSession]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewKey.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      const res = await api.accessInterviewByKey(interviewKey.trim(), email.trim());
      if (res.accessToken && res.candidate) setAuth(res.candidate, res.accessToken);

      if (res.status === 'WAITING_IN_QUEUE') {
        setIsQueued(true);
        setQueueInfo(res.queue);
      } else if (res.status === 'WAITING_FOR_ADMISSION') {
        navigate(`/candidate/${res.session.id}`);
      } else if (res.status === 'NOT_OPEN_YET') {
        setNotOpenSession(res.session);
      }
    } catch (err: any) {
      const message = err.message || 'Unable to join interview. Please check your interview key.';
      if (message.includes('already attempted')) setClosedOutcome('ALREADY_ATTEMPTED');
      else if (message.includes('missed your interview')) setClosedOutcome('MISSED');
      else setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  /* ------------------------------ Queue view ------------------------------ */
  if (isQueued && queueInfo) {
    return (
      <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex items-center justify-center px-6 py-12 font-sans">
        <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#161412] p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-7 rounded-full border border-[#DB7A57]/30 flex items-center justify-center text-[#DB7A57]">
            <Clock className="w-6 h-6" strokeWidth={1.4} />
          </div>

          <div className="text-[10px] tracking-[0.35em] uppercase text-[#DB7A57]">
            Interviewer Currently Busy
          </div>

          <h2 className="mt-4 text-3xl font-serif font-light tracking-tight">
            You are in the queue
          </h2>

          <p className="mt-4 text-[13px] text-[#A9A39A] leading-[1.8] font-light max-w-sm mx-auto">
            Your host <span className="text-[#F4F2EB]">{queueInfo.interviewerName}</span> is in
            session with another candidate. This window will connect you automatically the moment
            they are ready.
          </p>

          <div className="mt-8 grid grid-cols-2 border border-white/[0.08] rounded-xl divide-x divide-white/[0.08]">
            <div className="py-5">
              <div className="text-[10px] tracking-[0.2em] uppercase text-[#6B6761]">
                Your Position
              </div>
              <div className="mt-2 text-4xl font-serif font-light text-[#DB7A57]">
                #{queueInfo.position}
              </div>
            </div>
            <div className="py-5">
              <div className="text-[10px] tracking-[0.2em] uppercase text-[#6B6761]">
                Total Waiting
              </div>
              <div className="mt-2 text-4xl font-serif font-light text-[#CBC3B9]">
                {queueInfo.totalInQueue}
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2.5 text-[12px] text-[#A9A39A]">
            <ShieldCheck className="w-4 h-4 text-[#DB7A57]" strokeWidth={1.5} />
            <span>
              Validated key{' '}
              <span className="font-mono text-[#F4F2EB] tracking-wider">
                {queueInfo.sessionCode}
              </span>
            </span>
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.07] flex items-center justify-center gap-2 text-[11px] text-[#6B6761]">
            <RotateCw className="w-3.5 h-3.5 animate-spin text-[#DB7A57]" />
            <span>Status refreshes automatically. Please keep this tab open.</span>
          </div>
        </div>
      </div>
    );
  }

  if (notOpenSession) {
    const seconds = Math.max(0, Math.ceil((new Date(notOpenSession.scheduled_start_time).getTime() - now) / 1000));
    const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex items-center justify-center px-6 font-sans"><div className="w-full max-w-lg rounded-2xl border border-[#DB7A57]/30 bg-[#161412] p-10 text-center"><Clock className="w-14 h-14 mx-auto text-[#DB7A57]" strokeWidth={1.3} /><div className="mt-7 text-[10px] tracking-[0.35em] uppercase text-[#DB7A57]">Interview access opens soon</div><h1 className="mt-4 text-3xl font-serif font-light">{notOpenSession.title}</h1><div className="mt-8 font-mono text-4xl tracking-[0.12em] text-[#F4F2EB]">{hours}:{minutes}:{secs}</div><p className="mt-5 text-[13px] leading-[1.8] text-[#A9A39A]">Access will become available at {new Date(notOpenSession.scheduled_start_time).toLocaleString()}.</p><button onClick={() => { setNotOpenSession(null); setError(null); }} disabled={seconds > 0} className="mt-8 h-11 px-7 rounded-full bg-[#F4F2EB] disabled:opacity-40 text-[#0E0C0B] text-[11px] font-semibold tracking-[0.16em] uppercase">{seconds > 0 ? 'Please wait' : 'Connect now'}</button></div></div>;
  }

  if (closedOutcome) {
    const attempted = closedOutcome === 'ALREADY_ATTEMPTED';
    return <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex items-center justify-center px-6 font-sans"><div className="w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[#161412] p-10 text-center"><AlertCircle className="w-14 h-14 mx-auto text-rose-400" strokeWidth={1.3} /><div className="mt-7 text-[10px] tracking-[0.35em] uppercase text-rose-300">Scheduled window closed</div><h1 className="mt-4 text-3xl font-serif font-light">{attempted ? 'You already attempted this interview' : 'You missed your interview'}</h1><p className="mt-4 text-[13px] leading-[1.8] text-[#A9A39A]">{attempted ? 'This interview has already been accessed. Please contact the interviewer if you need assistance.' : 'The allowed interview time has ended before an attempt was recorded. Please contact the interviewer or administrator.'}</p><button onClick={() => { setClosedOutcome(null); setError(null); }} className="mt-8 h-11 px-7 rounded-full border border-white/15 text-[11px] font-semibold tracking-[0.16em] uppercase">Back to key entry</button></div></div>;
  }

  /* ------------------------------- Join view ------------------------------- */
  return (
    <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex flex-col font-sans">
      <header className="border-b border-white/[0.07]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => navigate('/')}>
            <Logo size="md" />
          </div>
          <button
            onClick={() => navigate('/login')}
            className="text-[11px] tracking-[0.15em] uppercase text-[#A9A39A] hover:text-[#F4F2EB]"
          >
            Interviewer / Admin Sign In →
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-md">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full border border-[#DB7A57]/30 text-[#DB7A57] flex items-center justify-center">
              <Key className="w-5 h-5" strokeWidth={1.4} />
            </div>
            <h1 className="mt-7 text-4xl font-serif font-light tracking-tight">
              Direct key <span className="italic text-[#DB7A57]">connection</span>
            </h1>
            <p className="mt-3 text-[13px] text-[#A9A39A] font-light">
              Enter your private interview session code
            </p>
          </div>

          {error && (
            <div className="mt-8 px-4 py-3 rounded-xl bg-rose-950/60 border border-rose-900 text-[12px] text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="mt-8 space-y-5">
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase text-[#A9A39A] mb-2">
                Interview Key / Session Code
              </label>
              <input
                type="text"
                required
                value={interviewKey}
                onChange={(e) => setInterviewKey(e.target.value.toUpperCase())}
                placeholder="e.g. XPRTY-SYS-2026"
                className="w-full h-12 px-4 rounded-xl bg-[#0E0C0B] border border-white/10 text-sm font-mono text-[#DB7A57] tracking-[0.12em] placeholder-[#6B6761] focus:outline-none focus:border-[#DB7A57]/70 uppercase"
              />
            </div>

            <div><label className="block text-[10px] tracking-[0.2em] uppercase text-[#A9A39A] mb-2">Invited email address</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full h-12 px-4 rounded-xl bg-[#0E0C0B] border border-white/10 text-sm text-[#F4F2EB] placeholder-[#6B6761] focus:outline-none focus:border-[#DB7A57]/70" /></div>
            <p className="text-[11px] leading-[1.7] text-[#6B6761]">Enter the email address that received this interview invitation. No candidate account login is required.</p>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-full bg-[#DB7A57] hover:bg-[#E58C6A] text-[#0E0C0B] text-[11px] font-semibold tracking-[0.2em] uppercase flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{isLoading ? 'Verifying Key...' : 'Connect to Session'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Demo keys */}
          
        </div>
      </main>
    </div>
  );
};
