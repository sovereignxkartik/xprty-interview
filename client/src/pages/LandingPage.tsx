import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import {
  ShieldCheck,
  Video,
  Globe,
  Terminal,
  ArrowRight,
  Users,
  FileCheck2,
  Key,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Video,
    title: 'Jitsi Meet',
    text: 'High-definition encrypted video, audio and screen sharing.',
  },
  {
    icon: ShieldCheck,
    title: 'Proctoring Guardian',
    text: 'Dual-layer visibility and tab-switching telemetry.',
  },
  {
    icon: Globe,
    title: 'Domain Allowlist',
    text: 'Real-time, interviewer-controlled website permissions.',
  },
  {
    icon: Terminal,
    title: 'Live Coding',
    text: 'Interactive editor with multi-language execution.',
  },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [interviewKey, setInterviewKey] = useState('');

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/candidate-join', { state: { key: interviewKey.trim() } });
  };

  return (
    <div className="min-h-screen bg-[#0E0C0B] text-[#F4F2EB] flex flex-col font-sans">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-[#0E0C0B]/95 border-b border-white/[0.07]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="cursor-pointer" onClick={() => navigate('/')}>
            <Logo size="md" />
          </div>

          <nav className="hidden md:flex items-center gap-10">
            {[
              ['Access', '#access'],
              ['Capabilities', '#capabilities'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                className="text-[11px] tracking-[0.2em] uppercase text-[#A9A39A] hover:text-[#F4F2EB]"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/candidate-join')}
              className="hidden sm:block text-[11px] tracking-[0.15em] uppercase text-[#A9A39A] hover:text-[#F4F2EB]"
            >
              Candidate   
            </button>
            <button
              onClick={() => navigate('/login')}
              className="h-9 px-5 rounded-full bg-[#F4F2EB] text-[#0E0C0B] text-[11px] font-medium tracking-[0.15em] uppercase hover:bg-white"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-28 pb-24 flex flex-col items-center text-center">
          <div className="text-[10px] tracking-[0.35em] uppercase text-[#DB7A57]">
            Independent Proctored Interviews
          </div>

          {/* <h1 className="mt-8 font-serif font-light text-5xl sm:text-6xl md:text-7xl leading-[1.05] tracking-[-0.02em]">
            Interviews, held to
            <br />
            <span className="italic text-[#DB7A57]">a higher standard.</span>
          </h1>

          <p className="mt-8 max-w-xl text-[15px] leading-[1.8] text-[#A9A39A] font-light">
            Live video interviews, real-time proctoring and controlled web
            access, designed for teams who value integrity and candidates who
            value clarity.
          </p> */}

          <form
  onSubmit={handleConnect}
  className="mt-12 flex flex-col sm:flex-row sm:items-center w-full max-w-lg gap-3 sm:gap-0
             rounded-3xl sm:rounded-full border border-white/10 bg-[#161412]
             p-3 sm:pl-5 sm:pr-1.5 sm:py-1.5 focus-within:border-[#DB7A57]/70"
>
  <div className="flex items-center flex-1 min-w-0 px-2 sm:px-0 h-10 sm:h-auto">
    <Key className="w-4 h-4 text-[#DB7A57] mr-3 shrink-0 hidden md:block" strokeWidth={1.5} />
    <input
      type="text"
      value={interviewKey}
      onChange={(e) => setInterviewKey(e.target.value.toUpperCase())}
      placeholder="Enter interview key · XP-APL-2026"
      aria-label="Interview key"
      className="w-full bg-transparent text-[#F4F2EB] placeholder-[#6B6761] text-[13px] tracking-[0.08em] focus:outline-none"
    />
  </div>
  <button
    type="submit"
    className="shrink-0 flex items-center justify-center gap-2 h-11 sm:h-10 w-full sm:w-auto px-6 rounded-full bg-[#DB7A57] hover:bg-[#E58C6A] text-[#0E0C0B] text-[11px] font-semibold tracking-[0.15em] uppercase"
  >
    Connect
    <ArrowRight className="w-3.5 h-3.5" />
  </button>
</form>
        </section>

        {/* Access */}
        {/* <section id="access" className="max-w-4xl mx-auto px-6 pb-24">
          <h2 className="font-serif font-light text-3xl tracking-tight mb-10">
            Choose your entrance
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              onClick={() => navigate('/login')}
              className="cursor-pointer rounded-2xl border border-white/[0.08] bg-[#161412] p-9 flex flex-col justify-between min-h-[300px] hover:border-[#DB7A57]/50"
            >
              <div>
                <div className="w-11 h-11 rounded-full border border-[#DB7A57]/30 text-[#DB7A57] flex items-center justify-center">
                  <Users className="w-5 h-5" strokeWidth={1.4} />
                </div>
                <h3 className="mt-8 text-2xl font-serif font-light">Interviewer Suite</h3>
                <p className="mt-3 text-[13px] text-[#A9A39A] leading-[1.8] font-light">
                  Host live video interviews, manage dynamic website allowlists,
                  observe candidate telemetry in real time, and submit
                  structured evaluations.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase text-[#DB7A57]">
                Enter Host Suite <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={() => navigate('/candidate-join')}
              className="cursor-pointer rounded-2xl border border-white/[0.08] bg-[#161412] p-9 flex flex-col justify-between min-h-[300px] hover:border-emerald-400/40"
            >
              <div>
                <div className="w-11 h-11 rounded-full border border-emerald-400/25 text-emerald-300 flex items-center justify-center">
                  <FileCheck2 className="w-5 h-5" strokeWidth={1.4} />
                </div>
                <h3 className="mt-8 text-2xl font-serif font-light">Candidate Portal</h3>
                <p className="mt-3 text-[13px] text-[#A9A39A] leading-[1.8] font-light">
                  Complete hardware pre-flight checks, join your assigned
                  proctored session via your session key, and access permitted
                  references.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase text-emerald-300">
                Join With Key <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </section> */}

        {/* Capabilities */}
        <section id="capabilities" className="max-w-4xl mx-auto px-6 pb-28">
          <h2 className="font-serif font-light text-3xl tracking-tight mb-10">
            Capabilities
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-white/[0.08]">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-7 border-r border-b border-white/[0.08]">
                <f.icon className="w-5 h-5 text-[#DB7A57]" strokeWidth={1.4} />
                <h3 className="mt-5 font-serif text-lg font-light">{f.title}</h3>
                <p className="mt-2 text-[12px] leading-[1.8] text-[#A9A39A] font-light">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.07] py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] tracking-[0.25em] uppercase text-[#6B6761]">
          <Logo size="sm" />
          <span>© {new Date().getFullYear()} · Independent Proctored Interviews</span>
        </div>
      </footer>
    </div>
  );
};