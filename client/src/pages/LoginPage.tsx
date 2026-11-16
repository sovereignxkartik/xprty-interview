import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.service';
import { useAppStore } from '../store/useAppStore';
import { Logo } from '../components/ui/Logo';
import { Lock, Mail, ArrowRight, ShieldCheck, Video, Globe } from 'lucide-react';

const inputClass =
  'w-full h-11 px-4 rounded-xl bg-[#0E0C0B] border border-white/10 text-[13px] text-[#F4F2EB] placeholder-[#6B6761] focus:outline-none focus:border-[#DB7A57]/70';
const labelClass =
  'block text-[10px] tracking-[0.2em] uppercase text-[#A9A39A] mb-2';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAppStore((state) => state.setAuth);

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('interviewer@xprty.io');
  const [password, setPassword] = useState('Password@123');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [resumeUrl, setResumeUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [skills, setSkills] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        const res = await api.register({
          email,
          password,
          full_name: fullName,
          role: 'candidate',
          phone,
          resume_url: resumeUrl,
          portfolio_url: portfolioUrl,
          skills: skills.split(',').map((skill) => skill.trim()).filter(Boolean),
        });
        setAuth(res.user, res.token);
        if (res.user.role === 'super_admin') navigate('/admin');
        else if (res.user.role === 'interviewer') navigate('/interviewer');
        else navigate('/candidate-join');
      } else {
        const res = await api.login({ email, password });
        setAuth(res.user, res.token);
        if (res.user.role === 'super_admin') navigate('/admin');
        else if (res.user.role === 'interviewer') navigate('/interviewer');
        else navigate('/candidate-join');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const setPresetUser = (type: 'admin' | 'interviewer' | 'candidate') => {
    if (type === 'admin') {
      setEmail('admin@xprty.io');
      setPassword('Password@123');
      setIsRegistering(false);
    } else if (type === 'interviewer') {
      setEmail('interviewer@xprty.io');
      setPassword('Password@123');
      setIsRegistering(false);
    } else {
      setEmail('jordan@example.com');
      setPassword('Password@123');
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex flex-col font-sans">
      {/* Top bar */}
      <header className="border-b border-white/[0.07]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => navigate('/')}>
            <Logo size="md" />
          </div>
          <button
            onClick={() => navigate('/candidate-join')}
            className="text-[11px] tracking-[0.15em] uppercase text-[#DB7A57] hover:text-[#EA8D69]"
          >
            Have an interview key? <span className="hidden sm:inline">Join directly</span> →
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2">
        {/* Brand panel */}
        <section className="hidden lg:flex flex-col justify-between border-r border-white/[0.07] px-16 py-16 bg-[radial-gradient(ellipse_at_top_left,rgba(219,122,87,0.10),transparent_60%)]">
          <div>
            <div className="text-[10px] tracking-[0.35em] uppercase text-[#DB7A57]">
              Independent Proctored Interviews
            </div>
            <h1 className="mt-8 font-serif font-light text-5xl xl:text-6xl leading-[1.08] tracking-[-0.02em]">
              Welcome back to
              <br />
              <span className="italic text-[#DB7A57]">your workspace.</span>
            </h1>
            <p className="mt-6 max-w-sm text-[14px] leading-[1.8] text-[#A9A39A] font-light">
              Sign in to host, observe and evaluate interviews, or to prepare for
              your next session.
            </p>
          </div>

          <ul className="space-y-5">
            {[
              [Video, 'Encrypted live video and screen sharing'],
              [ShieldCheck, 'Real-time proctoring telemetry'],
              [Globe, 'Interviewer-controlled website allowlist'],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof Video;
              return (
                <li key={i} className="flex items-center gap-4 text-[13px] text-[#CBC3B9] font-light">
                  <span className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-[#DB7A57]">
                    <I className="w-4 h-4" strokeWidth={1.4} />
                  </span>
                  {text as string}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Form panel */}
        <section className="flex items-center justify-center px-6 py-14">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-11 h-11 rounded-full border border-[#DB7A57]/30 text-[#DB7A57] flex items-center justify-center">
                <Lock className="w-5 h-5" strokeWidth={1.4} />
              </div>
              <div>
                <h2 className="text-2xl font-serif font-light">
                  {isRegistering ? 'Create account' : 'Sign in'}
                </h2>
                <p className="text-[12px] text-[#A9A39A] font-light mt-0.5">
                  {isRegistering
                    ? 'Create a candidate account'
                    : 'Authenticate to your restricted workspace'}
                </p>
              </div>
            </div>

            {/* Quick fill */}
            {!isRegistering && (
              <div className="mb-6 flex items-center gap-2">
                <span className="text-[10px] tracking-[0.2em] uppercase text-[#6B6761] mr-1">
                  Quick fill
                </span>
                {(
                  [
                    ['admin', 'Admin', 'admin@xprty.io'],
                    ['interviewer', 'Interviewer', 'interviewer@xprty.io'],
                    ['candidate', 'Candidate', 'jordan@example.com'],
                  ] as const
                ).map(([key, label, presetEmail]) => {
                  const isActive = email === presetEmail;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setPresetUser(key)}
                      className={`h-7 px-3 rounded-full border text-[10px] tracking-[0.1em] uppercase font-medium ${
                        isActive
                          ? 'bg-[#DB7A57] border-[#DB7A57] text-[#0E0C0B]'
                          : 'border-white/10 text-[#CBC3B9] hover:border-[#DB7A57]/60 hover:text-[#DB7A57]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-rose-950/60 border border-rose-900 text-[12px] text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {isRegistering && (
                <>
                  <div className="px-4 py-3 rounded-xl bg-[#0E0C0B] border border-white/10 text-[12px] text-[#A9A39A]">Interviewer accounts are created and assigned by your organization administrator.</div>

                  <div>
                    <label className={labelClass}>Full Name</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Alex Turner"
                      className={inputClass}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Phone</label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass}>Skills</label>
                      <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Node.js" className={inputClass} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Resume URL</label>
                    <input type="url" value={resumeUrl} onChange={(e) => setResumeUrl(e.target.value)} placeholder="https://…" className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}>Portfolio URL</label>
                    <input type="url" value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="https://…" className={inputClass} />
                  </div>

                </>
              )}

              <div>
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#6B6761] absolute left-4 top-3.5" strokeWidth={1.5} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#6B6761] absolute left-4 top-3.5" strokeWidth={1.5} />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-full bg-[#DB7A57] hover:bg-[#E58C6A] text-[#0E0C0B] text-[11px] font-semibold tracking-[0.2em] uppercase flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>
                  {isLoading ? 'Authenticating...' : isRegistering ? 'Create Account' : 'Sign In'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-white/[0.07] text-center">
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-[12px] text-[#A9A39A] hover:text-[#DB7A57]"
              >
                {isRegistering
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Create one"}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
