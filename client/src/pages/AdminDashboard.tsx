import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.service';
import { useAppStore } from '../store/useAppStore';
import { Logo } from '../components/ui/Logo';
import { ScheduleModal } from '../components/schedule/ScheduleModal';
import { ActionDialog } from '../components/ui/ActionDialog';
import { ShieldCheck, LogOut, Key, CheckCircle2 } from 'lucide-react';

type Tab = 'metrics' | 'organizations' | 'interviewers' | 'interviews' | 'users' | 'settings';

const pill = 'text-[10px] tracking-[0.15em] uppercase px-2.5 py-0.5 rounded-full border';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAppStore();

  const [activeTab, setActiveTab] = useState<Tab>('metrics');
  const [metrics, setMetrics] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [interviewers, setInterviewers] = useState<any[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [interviewerForm, setInterviewerForm] = useState({ full_name: '', email: '', password: '', organization: '', title: '', skills: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ action: 'reschedule' | 'cancel' | 'reinterview'; session: any } | null>(null);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'super_admin') {
      navigate('/login');
      return;
    }
    loadAdminData();
  }, [currentUser]);

  const loadAdminData = async () => {
    try {
      const overview = await api.getAdminOverview();
      setMetrics(overview.metrics);
      setInterviewers(overview.interviewers);
      setSettings(overview.settings);

      const allUsers = await api.getAdminUsers();
      setUsers(allUsers);

      const allSessions = await api.getAdminSessions();
      setInterviews(allSessions);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentActive: boolean) => {
    try {
      await api.toggleUserStatus(userId, !currentActive);
      setUsers(users.map((u) => (u.id === userId ? { ...u, is_active: !currentActive } : u)));
      setStatusMessage(`User status updated.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleVerificationChange = async (userId: string, newStatus: string) => {
    try {
      await api.updateInterviewerVerification(userId, newStatus);
      setInterviewers(
        interviewers.map((i) => (i.user_id === userId ? { ...i, verification_status: newStatus } : i))
      );
      setStatusMessage(`Interviewer verification updated.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updatePlatformSettings(settings);
      setStatusMessage('Platform configurations saved globally.');
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateInterviewer = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(null);
    try {
      await api.createInterviewer({ ...interviewerForm, skills: interviewerForm.skills.split(',').map((skill) => skill.trim()).filter(Boolean) });
      setInterviewerForm({ full_name: '', email: '', password: '', organization: '', title: '', skills: '' });
      setStatusMessage('Interviewer account created and ready for assignment.');
      await loadAdminData();
    } catch (err: any) { setFormError(err.message || 'Could not create interviewer.'); }
  };

  const manageInterview = async (action: 'reschedule' | 'cancel' | 'reinterview', session: any, times?: { start: string; end: string }) => {
    try {
      if (action === 'cancel') await api.cancelInterview(session.id);
      else if (times) action === 'reschedule' ? await api.rescheduleInterview(session.id, times.start, times.end) : await api.createReinterview(session.id, times.start, times.end);
      await loadAdminData();
      setStatusMessage(action === 'reinterview' ? 'Re-interview scheduled.' : `Interview ${action}d.`);
    } catch (error: any) { setStatusMessage(error.message || 'Unable to update the interview.'); }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'metrics', label: 'Overview' },
    { id: 'interviewers', label: 'Interviewers' },
    { id: 'interviews', label: 'Sessions & Queues' },
    { id: 'users', label: 'Users' },
    { id: 'settings', label: 'Settings' },
  ];

  const panel = 'bg-[#161412] border border-white/[0.08] rounded-2xl p-8';
  const th = 'pb-4 text-[10px] tracking-[0.2em] uppercase font-normal text-[#6B6761]';

  const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="text-2xl font-serif font-light tracking-tight mb-6">{children}</h2>
  );

  return (
    <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex flex-col font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-[#0E0C0B]/95 border-b border-white/[0.07]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Logo size="md" />
            <span className={`${pill} text-[#DB7A57] border-[#DB7A57]/30`}>Super Admin</span>
          </div>

          <nav className="hidden md:flex items-center gap-7">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`relative h-16 text-[11px] tracking-[0.2em] uppercase ${
                  activeTab === t.id ? 'text-[#F4F2EB]' : 'text-[#A9A39A] hover:text-[#F4F2EB]'
                }`}
              >
                {t.label}
                {activeTab === t.id && (
                  <span className="absolute left-0 right-0 bottom-0 h-px bg-[#DB7A57]" />
                )}
              </button>
            ))}
          </nav>

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
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 pt-14 pb-20">
        {/* Mobile tab selector */}
        <div className="md:hidden mb-8">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as Tab)}
            className="w-full h-11 px-4 rounded-xl bg-[#161412] border border-white/10 text-[12px] tracking-[0.15em] uppercase text-[#F4F2EB]"
          >
            {tabs.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {statusMessage && (
          <div className="mb-8 px-5 py-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/40 text-[12px] text-emerald-300 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4" strokeWidth={1.6} />
            {statusMessage}
          </div>
        )}

        {/* Overview */}
        {activeTab === 'metrics' && metrics && (
          <div>
            <div className="text-[10px] tracking-[0.35em] uppercase text-[#DB7A57]">
              Super Admin
            </div>
            <h1 className="mt-5 font-serif font-light text-4xl md:text-5xl tracking-[-0.02em]">
              Platform <span className="italic text-[#DB7A57]">master control</span>
            </h1>
            <p className="mt-4 text-[14px] text-[#A9A39A] max-w-xl leading-[1.8] font-light">
              Global oversight of all organizations, users, and proctoring telemetry.
            </p>

            <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 border-t border-l border-white/[0.08]">
              <div className="p-7 border-r border-b border-white/[0.08]">
                <div className="text-[10px] tracking-[0.2em] uppercase text-[#6B6761]">
                  Registered Accounts
                </div>
                <div className="mt-4 text-5xl font-serif font-light">{metrics.total_users}</div>
                <div className="mt-3 text-[12px] text-[#A9A39A] font-light">
                  {metrics.interviewers} hosts · {metrics.candidates} candidates
                </div>
              </div>

              <div className="p-7 border-r border-b border-white/[0.08]">
                <div className="text-[10px] tracking-[0.2em] uppercase text-[#6B6761]">
                  Interviews Conducted
                </div>
                <div className="mt-4 text-5xl font-serif font-light text-[#DB7A57]">
                  {metrics.total_interviews}
                </div>
                <div className="mt-3 text-[12px] text-[#A9A39A] font-light">
                  {metrics.completed_interviews} completed
                </div>
              </div>

              <div className="p-7 border-r border-b border-white/[0.08]">
                <div className="text-[10px] tracking-[0.2em] uppercase text-[#6B6761]">
                  Active In Progress
                </div>
                <div className="mt-4 text-5xl font-serif font-light text-emerald-300">
                  {metrics.in_progress_interviews}
                </div>
                <div className="mt-3 text-[12px] text-[#A9A39A] font-light">
                  1-to-1 concurrency enforced
                </div>
              </div>

              <div className="p-7 border-r border-b border-white/[0.08]">
                <div className="text-[10px] tracking-[0.2em] uppercase text-[#6B6761]">
                  Security Engine
                </div>
                <div className="mt-5 flex items-center gap-2.5 text-xl font-serif font-light">
                  <ShieldCheck className="w-5 h-5 text-[#DB7A57]" strokeWidth={1.4} />
                  Dual-Layer Guardian
                </div>
                <div className="mt-3 text-[12px] text-[#A9A39A] font-light">
                  Jitsi Meet + Manifest V3
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interviewers */}
        {activeTab === 'interviewers' && (
          <div className="space-y-6">
          <form onSubmit={handleCreateInterviewer} className={panel}>
            <SectionTitle>Create interviewer account</SectionTitle>
            <p className="-mt-4 mb-6 text-[12px] text-[#A9A39A]">Only administrators can create interviewer accounts. The organization is used when assigning sessions.</p>
            {formError && <div className="mb-4 px-4 py-3 rounded-xl bg-rose-950/60 border border-rose-900 text-[12px] text-rose-300">{formError}</div>}
            <div className="grid md:grid-cols-2 gap-4">
              {([['full_name', 'Full name', 'text'], ['email', 'Email', 'email'], ['password', 'Temporary password', 'password'], ['organization', 'Organization', 'text'], ['title', 'Job title', 'text'], ['skills', 'Skills (comma separated)', 'text']] as const).map(([field, label, type]) => <label key={field} className="text-[11px] tracking-[0.12em] uppercase text-[#A9A39A]">{label}<input required={field !== 'skills'} type={type} value={interviewerForm[field]} onChange={(e) => setInterviewerForm({ ...interviewerForm, [field]: e.target.value })} className="mt-2 w-full h-10 px-3 rounded-xl bg-[#0E0C0B] border border-white/10 text-[13px] normal-case tracking-normal text-[#F4F2EB]" /></label>)}
            </div>
            <button type="submit" className="mt-6 h-10 px-6 rounded-full bg-[#DB7A57] text-[#0E0C0B] text-[11px] font-semibold tracking-[0.15em] uppercase">Create interviewer</button>
          </form>
          <div className={panel}>
            <SectionTitle>Interviewer verification &amp; concurrency</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className={th}>Interviewer</th>
                    <th className={th}>Organization</th>
                    <th className={th}>Title</th>
                    <th className={th}>Conducted</th>
                    <th className={th}>Live Status</th>
                    <th className={th}>Verification</th>
                    <th className={`${th} text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {interviewers.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02]">
                      <td className="py-4 pr-4">
                        <div className="font-serif text-[15px]">
                          {item.user ? item.user.full_name : 'Interviewer'}
                        </div>
                        <div className="text-[11px] text-[#6B6761] mt-0.5">{item.user?.email}</div>
                      </td>
                      <td className="py-4 pr-4 text-[#CBC3B9] font-light">{item.organization_name}</td>
                      <td className="py-4 pr-4 text-[#A9A39A] font-light">{item.title}</td>
                      <td className="py-4 pr-4 font-mono text-[#DB7A57]">
                        {item.total_interviews_conducted}
                      </td>
                      <td className="py-4 pr-4">
                        {item.is_busy ? (
                          <span className={`${pill} text-[#DB7A57] border-[#DB7A57]/40`}>
                            Busy in session
                          </span>
                        ) : (
                          <span className={`${pill} text-emerald-300 border-emerald-500/40`}>
                            Available
                          </span>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={`${pill} ${
                            item.verification_status === 'verified'
                              ? 'text-emerald-300 border-emerald-500/40'
                              : 'text-[#CBC3B9] border-white/15'
                          }`}
                        >
                          {item.verification_status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <select
                          value={item.verification_status}
                          onChange={(e) => handleVerificationChange(item.user_id, e.target.value)}
                          className="h-9 px-3 rounded-full bg-[#0E0C0B] border border-white/10 text-[11px] text-[#F4F2EB] focus:outline-none focus:border-[#DB7A57]/70"
                        >
                          <option value="verified">Verified</option>
                          <option value="pending">Pending</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )}

        {/* Sessions */}
        {activeTab === 'interviews' && (
          <div className={panel}>
            <div className="flex items-center justify-between gap-4"><SectionTitle>All sessions &amp; waiting queues</SectionTitle><button onClick={() => setShowScheduleModal(true)} className="mb-6 h-9 px-5 rounded-full bg-[#DB7A57] text-[#0E0C0B] text-[11px] font-semibold tracking-[0.15em] uppercase">Schedule / bulk CSV</button></div>
            <div className="border-t border-white/[0.08]">
              {interviews.map((sess) => (
                <div
                  key={sess.id}
                  className="py-5 border-b border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[17px] font-serif font-light">{sess.title}</span>
                      <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-wider px-2.5 py-0.5 rounded-full border border-[#DB7A57]/30 text-[#DB7A57]">
                        <Key className="w-3 h-3" strokeWidth={1.5} />
                        {sess.session_code}
                      </span>
                    </div>
                    <div className="mt-2 text-[12px] text-[#A9A39A]">
                      Interviewer{' '}
                      <span className="text-[#F4F2EB]">{sess.interviewer?.full_name}</span>
                      <span className="mx-2 text-[#6B6761]">·</span>
                      Candidate <span className="text-[#F4F2EB]">{sess.candidate?.full_name}</span>
                    </div>
                    {sess.feedback && <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#0E0C0B] px-3 py-2 text-[11px] text-[#CBC3B9]">Score <span className="font-mono text-[#DB7A57]">{sess.feedback.overall_rating}/5</span> · {String(sess.feedback.recommendation).replace('_', ' ')} · {sess.feedback.summary_notes}</div>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`${pill} ${
                        sess.status === 'in_progress'
                          ? 'text-emerald-300 border-emerald-500/40'
                          : 'text-[#CBC3B9] border-white/15'
                      }`}
                    >
                      {String(sess.status).replace('_', ' ')}
                    </span>
                    <button
                      onClick={() => navigate(`/interviewer-room/${sess.id}`)}
                      className="h-9 px-5 rounded-full border border-white/15 hover:border-[#DB7A57]/60 text-[11px] tracking-[0.15em] uppercase text-[#F4F2EB]"
                    >
                      Audit Session
                    </button>
                    {sess.status === 'completed' ? (
                      <button onClick={() => setDialog({ action: 'reinterview', session: sess })} className="h-9 px-4 rounded-full border border-[#DB7A57]/50 text-[#DB7A57] text-[10px] tracking-[0.13em] uppercase">Re-interview</button>
                    ) : (
                      <>
                        <button onClick={() => setDialog({ action: 'reschedule', session: sess })} className="h-9 px-4 rounded-full border border-white/15 text-[10px] tracking-[0.13em] uppercase">Reschedule</button>
                        <button onClick={() => setDialog({ action: 'cancel', session: sess })} className="h-9 px-4 rounded-full border border-rose-500/40 text-rose-300 text-[10px] tracking-[0.13em] uppercase">Cancel</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <div className={panel}>
            <SectionTitle>Master user accounts</SectionTitle>
            <div className="border-t border-white/[0.08]">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="py-4 border-b border-white/[0.08] flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="text-[15px] font-serif">{u.full_name}</div>
                    <div className="text-[11px] font-mono text-[#6B6761] mt-0.5 truncate">
                      {u.email}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className={`${pill} text-[#CBC3B9] border-white/15`}>{u.role}</span>
                    <button
                      onClick={() => handleToggleUserStatus(u.id, u.is_active)}
                      className={`h-9 px-5 rounded-full border text-[11px] tracking-[0.15em] uppercase ${
                        u.is_active
                          ? 'border-rose-500/50 text-rose-300 hover:bg-rose-500/10'
                          : 'border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10'
                      }`}
                    >
                      {u.is_active ? 'Suspend' : 'Activate'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        {activeTab === 'settings' && settings && (
          <form onSubmit={handleUpdateSettings} className={`${panel} max-w-2xl`}>
            <SectionTitle>Platform global configuration</SectionTitle>

            <div className="border-t border-white/[0.08]">
              <label className="flex items-center justify-between gap-6 py-5 border-b border-white/[0.08] cursor-pointer">
                <span className="text-[14px] text-[#CBC3B9] font-light">
                  Require interviewer identity verification
                </span>
                <input
                  type="checkbox"
                  checked={settings.require_interviewer_verification}
                  onChange={(e) =>
                    setSettings({ ...settings, require_interviewer_verification: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-white/20 text-[#DB7A57] focus:ring-0 bg-[#0E0C0B] accent-[#DB7A57]"
                />
              </label>

              <label className="flex items-center justify-between gap-6 py-5 border-b border-white/[0.08] cursor-pointer">
                <span className="text-[14px] text-[#CBC3B9] font-light">
                  Strict 1-candidate-at-a-time concurrency
                </span>
                <input
                  type="checkbox"
                  checked={settings.max_concurrent_interviews_per_host === 1}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      max_concurrent_interviews_per_host: e.target.checked ? 1 : 2,
                    })
                  }
                  className="w-4 h-4 rounded border-white/20 text-[#DB7A57] focus:ring-0 bg-[#0E0C0B] accent-[#DB7A57]"
                />
              </label>
            </div>

            <button
              type="submit"
              className="mt-8 h-11 px-8 rounded-full bg-[#DB7A57] hover:bg-[#E58C6A] text-[#0E0C0B] text-[11px] font-semibold tracking-[0.2em] uppercase"
            >
              Save global configuration
            </button>
          </form>
        )}
      </main>
      {showScheduleModal && <ScheduleModal interviewers={interviewers} onClose={() => setShowScheduleModal(false)} onScheduled={(session) => setInterviews((current) => [session, ...current])} />}
      {dialog && <ActionDialog title={dialog.action === 'cancel' ? 'Cancel this interview?' : dialog.action === 'reinterview' ? 'Schedule a re-interview' : 'Reschedule interview'} message={dialog.action === 'cancel' ? 'The candidate will no longer be able to join this session.' : 'Choose the new interview window.'} confirmLabel={dialog.action === 'cancel' ? 'Cancel interview' : 'Save schedule'} danger={dialog.action === 'cancel'} schedule={dialog.action === 'cancel' ? undefined : { start: new Date(dialog.session.scheduled_start_time).toISOString().slice(0, 16), end: new Date(dialog.session.scheduled_end_time).toISOString().slice(0, 16) }} onConfirm={(times) => manageInterview(dialog.action, dialog.session, times)} onClose={() => setDialog(null)} />}
    </div>
  );
};
