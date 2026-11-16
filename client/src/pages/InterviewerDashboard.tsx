import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.service';
import { useAppStore } from '../store/useAppStore';
import { Logo } from '../components/ui/Logo';
import { Calendar, Video, ArrowRight, Key, LogOut } from 'lucide-react';
import { ActionDialog } from '../components/ui/ActionDialog';

type Nav = 'overview' | 'interviews' | 'history';

const STATUS_STYLE: Record<string, string> = {
  in_progress: 'text-emerald-300 border-emerald-500/40',
  scheduled: 'text-[#CBC3B9] border-white/15',
  completed: 'text-[#6B6761] border-white/10',
};

export const InterviewerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAppStore();

  const [sessions, setSessions] = useState<any[]>([]);
  const [activeNav, setActiveNav] = useState<Nav>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [dialog, setDialog] = useState<{ action: 'reschedule' | 'cancel' | 'reinterview'; session: any } | null>(null);

  useEffect(() => {
    if (!currentUser || (currentUser.role !== 'interviewer' && currentUser.role !== 'super_admin')) {
      navigate('/login');
      return;
    }
    loadSessions();
  }, [currentUser]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeSessions = sessions.filter((s) => s.status === 'in_progress');
  const upcomingSessions = sessions.filter((s) => s.status === 'scheduled');
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  const visibleSessions =
    activeNav === 'history'
      ? completedSessions
      : activeNav === 'overview'
      ? sessions.filter((s) => s.status !== 'completed')
      : sessions;

  const listTitle =
    activeNav === 'history'
      ? 'Interview history'
      : activeNav === 'overview'
      ? 'Active & upcoming'
      : 'All interviews';

  const tabs: { id: Nav; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'interviews', label: `My Interviews (${sessions.length})` },
    { id: 'history', label: 'History' },
  ];

  const metrics = [
    { label: 'Total Interviews', value: sessions.length, note: 'Conducted on platform', color: 'text-[#F4F2EB]' },
    { label: 'Active Now', value: activeSessions.length, note: '1-to-1 sessions live', color: 'text-[#DB7A57]' },
    { label: 'Upcoming', value: upcomingSessions.length, note: 'Keys generated and ready', color: 'text-emerald-300' },
    { label: 'Completed', value: completedSessions.length, note: 'Scorecards submitted', color: 'text-[#CBC3B9]' },
  ];

  const manageSession = async (action: 'reschedule' | 'cancel' | 'reinterview', session: any, times?: { start: string; end: string }) => {
    try {
      if (action === 'cancel') await api.cancelInterview(session.id);
      else if (times) action === 'reschedule' ? await api.rescheduleInterview(session.id, times.start, times.end) : await api.createReinterview(session.id, times.start, times.end);
      await loadSessions();
    } catch (error: any) { console.error(error); }
  };

  return (
    <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex flex-col font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-[#0E0C0B]/95 border-b border-white/[0.07]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <Logo size="md" />

          <nav className="hidden md:flex items-center gap-8">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveNav(t.id)}
                className={`relative h-16 text-[11px] tracking-[0.2em] uppercase ${
                  activeNav === t.id ? 'text-[#F4F2EB]' : 'text-[#A9A39A] hover:text-[#F4F2EB]'
                }`}
              >
                {t.label}
                {activeNav === t.id && (
                  <span className="absolute left-0 right-0 bottom-0 h-px bg-[#DB7A57]" />
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-[#A9A39A] hover:text-[#F4F2EB] hover:border-white/30"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 pt-14 pb-20">
        {/* Welcome */}
        <section className="mb-14">
          <div className="text-[10px] tracking-[0.35em] uppercase text-[#DB7A57]">
            Interviewer Workspace
          </div>
          <h1 className="mt-5 font-serif font-light text-4xl md:text-5xl tracking-[-0.02em]">
            Welcome,{' '}
            <span className="italic text-[#DB7A57]">
              {currentUser?.full_name?.split(' ')[0] || 'Interviewer'}
            </span>
          </h1>
        </section>

        {/* Metrics */}
        <section className="grid grid-cols-2 lg:grid-cols-4 border-t border-l border-white/[0.08] mb-16">
          {metrics.map((m) => (
            <div key={m.label} className="p-7 border-r border-b border-white/[0.08]">
              <div className="text-[10px] tracking-[0.2em] uppercase text-[#6B6761]">
                {m.label}
              </div>
              <div className={`mt-4 text-5xl font-serif font-light ${m.color}`}>{m.value}</div>
              <div className="mt-3 text-[12px] text-[#A9A39A] font-light">{m.note}</div>
            </div>
          ))}
        </section>

        {/* Sessions */}
        <section>
          <div className="flex items-end justify-between mb-6">
            <h2 className="font-serif font-light text-3xl tracking-tight">{listTitle}</h2>
            <span className="text-[11px] tracking-[0.2em] uppercase text-[#6B6761]">
              {visibleSessions.length} {visibleSessions.length === 1 ? 'session' : 'sessions'}
            </span>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-[12px] text-[#6B6761] tracking-[0.2em] uppercase border border-white/[0.08] rounded-2xl">
              Loading sessions...
            </div>
          ) : visibleSessions.length === 0 ? (
            <div className="py-16 px-6 text-center rounded-2xl border border-white/[0.08] bg-[#161412]">
              <Calendar className="w-8 h-8 text-[#6B6761] mx-auto" strokeWidth={1.2} />
              <h3 className="mt-5 text-2xl font-serif font-light">
                {sessions.length === 0 ? 'No interviews scheduled' : 'Nothing to show here'}
              </h3>
              <p className="mt-2 text-[13px] text-[#A9A39A] font-light">
                {sessions.length === 0
                  ? 'Your administrator will assign upcoming interviews here.'
                  : 'Sessions matching this view will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSessions.map((sess) => (
                <div
                  key={sess.id}
                  className="px-7 py-6 rounded-2xl border border-white/[0.08] bg-[#161412] hover:border-[#DB7A57]/40 flex flex-col md:flex-row md:items-center justify-between gap-5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-lg font-serif font-light">{sess.title}</span>
                      <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-wider px-2.5 py-0.5 rounded-full border border-[#DB7A57]/30 text-[#DB7A57]">
                        <Key className="w-3 h-3" strokeWidth={1.5} />
                        {sess.session_code}
                      </span>
                      <span
                        className={`text-[10px] tracking-[0.15em] uppercase px-2.5 py-0.5 rounded-full border ${
                          STATUS_STYLE[sess.status] || STATUS_STYLE.scheduled
                        }`}
                      >
                        {String(sess.status).replace('_', ' ')}
                      </span>
                    </div>

                    {sess.description && (
                      <p className="mt-2 text-[13px] text-[#A9A39A] font-light line-clamp-1">
                        {sess.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[12px] text-[#A9A39A]">
                      <span>
                        Candidate{' '}
                        <span className="text-[#F4F2EB]">
                          {sess.candidate?.full_name || 'Assigned Candidate'}
                        </span>
                      </span>
                      <span>
                        Scheduled{' '}
                        <span className="text-[#F4F2EB]">
                          {new Date(sess.scheduled_start_time).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 shrink-0">
                    {sess.status === 'completed' ? <button onClick={() => setDialog({ action: 'reinterview', session: sess })} className="h-9 px-4 rounded-full border border-[#DB7A57]/50 text-[#DB7A57] text-[10px] tracking-[0.14em] uppercase">Re-interview</button> : <><button onClick={() => setDialog({ action: 'reschedule', session: sess })} className="h-9 px-4 rounded-full border border-white/15 text-[10px] tracking-[0.14em] uppercase">Reschedule</button><button onClick={() => setDialog({ action: 'cancel', session: sess })} className="h-9 px-4 rounded-full border border-rose-500/40 text-rose-300 text-[10px] tracking-[0.14em] uppercase">Cancel</button></>}
                    <button onClick={() => navigate(`/interviewer-room/${sess.id}`)} className="flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-[#F4F2EB] hover:bg-white text-[#0E0C0B] text-[11px] font-medium tracking-[0.15em] uppercase"><Video className="w-4 h-4 text-[#DB7A57]" strokeWidth={1.6} />Enter Room<ArrowRight className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      {dialog && <ActionDialog title={dialog.action === 'cancel' ? 'Cancel this interview?' : dialog.action === 'reinterview' ? 'Schedule a re-interview' : 'Reschedule interview'} message={dialog.action === 'cancel' ? 'The candidate will no longer be able to join this session.' : 'Choose the new interview window.'} confirmLabel={dialog.action === 'cancel' ? 'Cancel interview' : 'Save schedule'} danger={dialog.action === 'cancel'} schedule={dialog.action === 'cancel' ? undefined : { start: new Date(dialog.session.scheduled_start_time).toISOString().slice(0, 16), end: new Date(dialog.session.scheduled_end_time).toISOString().slice(0, 16) }} onConfirm={(times) => manageSession(dialog.action, dialog.session, times)} onClose={() => setDialog(null)} />}
    </div>
  );
};
