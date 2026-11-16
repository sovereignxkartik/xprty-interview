import React, { useMemo, useState } from 'react';
import { api } from '../../services/api.service';
import { Calendar, Clock, Globe, Code2, Video, Send, X } from 'lucide-react';

interface ScheduleModalProps {
  onClose: () => void;
  onScheduled: (newSession: any) => void;
  interviewers: any[];
}

const csvHeaders = ['candidate_name', 'candidate_email', 'interviewer_id', 'scheduled_start_time', 'scheduled_end_time', 'title', 'description'];

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(value.trim()); if (row.some(Boolean)) rows.push(row); row = []; value = '';
    } else value += char;
  }
  if (value || row.length) { row.push(value.trim()); rows.push(row); }
  const headers = (rows.shift() || []).map(header => header.replace(/^\uFEFF/, '').trim());
  if (headers.join(',') !== csvHeaders.join(',')) throw new Error(`CSV headers must be: ${csvHeaders.join(', ')}`);
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ onClose, onScheduled, interviewers }) => {
  const [title, setTitle] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [durationMins, setDurationMins] = useState(60);
  const [description, setDescription] = useState('');
  const [interviewerId, setInterviewerId] = useState('');
  const [requireScreenShare, setRequireScreenShare] = useState(true);
  const [requireFullscreen, setRequireFullscreen] = useState(true);
  const [requireWebcam, setRequireWebcam] = useState(true);
  const [requireAudio, setRequireAudio] = useState(true);
  const [codeWorkspace, setCodeWorkspace] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableInterviewers = useMemo(() => interviewers.filter(item => item.user?.is_active !== false && item.verification_status !== 'suspended'), [interviewers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !candidateEmail || !candidateName || !interviewerId) {
      setError('Please select an interviewer and fill in the candidate details.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const scheduledStart = date && time ? new Date(`${date}T${time}`).toISOString() : new Date().toISOString();
      const scheduledEnd = new Date(new Date(scheduledStart).getTime() + durationMins * 60000).toISOString();

      const newSession = await api.createSession({
        title,
        description,
        candidate_email: candidateEmail,
        candidate_name: candidateName,
        interviewer_id: interviewerId,
        scheduled_start_time: scheduledStart,
        scheduled_end_time: scheduledEnd,
        require_screen_share: requireScreenShare,
        require_fullscreen: requireFullscreen,
        require_webcam: requireWebcam,
        require_audio: requireAudio,
        code_workspace_enabled: codeWorkspace
      });

      onScheduled(newSession);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule interview');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const example = ['Jordan Rivera', 'jordan@example.com', availableInterviewers[0]?.user_id || 'interviewer-id', '2026-12-01T10:00:00+05:30', '2026-12-01T11:00:00+05:30', 'Frontend interview', 'React and TypeScript'];
    const blob = new Blob([[csvHeaders.join(','), example.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'xprty-bulk-schedule-template.csv'; link.click(); URL.revokeObjectURL(url);
  };

  const uploadCsv = async (file: File) => {
    setError(null); setIsLoading(true);
    try {
      const result = await api.bulkSchedule(parseCsv(await file.text()));
      if (result.failed) {
        const firstError = result.results?.find((item: any) => !item.success)?.error || 'Check the CSV data.';
        throw new Error(`${result.created || 0} scheduled; ${result.failed} row(s) failed. ${firstError}`);
      }
      result.results.forEach((item: any) => onScheduled(item.session));
      onClose();
    } catch (err: any) { setError(err.message || 'Could not process the CSV file.'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#110F0E]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-[#191715] border border-[#32302D] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#32302D] bg-[#110F0E] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-serif text-[#F4F2EB]">Schedule New Technical Interview</h2>
            <p className="text-xs text-[#ABA7A2]">Generate persistent interview keys & Jitsi meeting</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[#211E1C] text-[#ABA7A2]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="m-6 mb-0 p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          <div>
            <label className="block text-xs font-medium text-[#CBC3B9] mb-1">Interview Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Architecture Interview"
              className="w-full px-3 py-2 rounded-xl bg-[#110F0E] border border-[#32302D] text-xs text-[#F4F2EB] placeholder-[#ABA7A2] focus:outline-none focus:border-[#DB7A57]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#CBC3B9] mb-1">Candidate Name</label>
              <input
                type="text"
                required
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. Jordan Rivera"
                className="w-full px-3 py-2 rounded-xl bg-[#110F0E] border border-[#32302D] text-xs text-[#F4F2EB] placeholder-[#ABA7A2] focus:outline-none focus:border-[#DB7A57]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#CBC3B9] mb-1">Candidate Email</label>
              <input
                type="email"
                required
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                placeholder="jordan@example.com"
                className="w-full px-3 py-2 rounded-xl bg-[#110F0E] border border-[#32302D] text-xs text-[#F4F2EB] placeholder-[#ABA7A2] focus:outline-none focus:border-[#DB7A57]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#CBC3B9] mb-1">Assign interviewer</label>
            <select required value={interviewerId} onChange={(e) => setInterviewerId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-[#110F0E] border border-[#32302D] text-xs text-[#F4F2EB] focus:outline-none focus:border-[#DB7A57]">
              <option value="">Select an interviewer</option>
              {availableInterviewers.map((item) => <option key={item.user_id} value={item.user_id}>{item.organization_name} — {item.user?.full_name} ({item.title})</option>)}
            </select>
            <p className="mt-1.5 text-[11px] text-[#ABA7A2]">Interviewers are grouped by organization in this list.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#CBC3B9] mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#110F0E] border border-[#32302D] text-xs text-[#F4F2EB] focus:outline-none focus:border-[#DB7A57]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#CBC3B9] mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#110F0E] border border-[#32302D] text-xs text-[#F4F2EB] focus:outline-none focus:border-[#DB7A57]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#CBC3B9] mb-1">Duration</label>
              <select
                value={durationMins}
                onChange={(e) => setDurationMins(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#110F0E] border border-[#32302D] text-xs text-[#F4F2EB] focus:outline-none"
              >
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
                <option value={90}>90 Minutes</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#CBC3B9] mb-1">Description / Syllabus</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Covers real-time architectures, distributed queues, and React performance."
              className="w-full p-3 rounded-xl bg-[#110F0E] border border-[#32302D] text-xs text-[#F4F2EB] placeholder-[#ABA7A2] focus:outline-none focus:border-[#DB7A57] resize-none"
            />
          </div>

          {/* Security & Features Checklist */}
          <div className="p-4 rounded-2xl bg-[#110F0E] border border-[#32302D] space-y-2.5">
            <div className="text-xs font-semibold text-[#DB7A57] uppercase tracking-wider mb-1">
              Proctoring & Workspace Settings
            </div>
            <label className="flex items-center gap-2.5 text-xs text-[#CBC3B9] cursor-pointer">
              <input
                type="checkbox"
                checked={requireScreenShare}
                onChange={(e) => setRequireScreenShare(e.target.checked)}
                className="rounded border-[#32302D] text-[#DB7A57] focus:ring-0 bg-[#211E1C]"
              />
              <span>Require Full Screen Sharing</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-[#CBC3B9] cursor-pointer">
              <input
                type="checkbox"
                checked={requireFullscreen}
                onChange={(e) => setRequireFullscreen(e.target.checked)}
                className="rounded border-[#32302D] text-[#DB7A57] focus:ring-0 bg-[#211E1C]"
              />
              <span>Enforce Fullscreen Mode</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-[#CBC3B9] cursor-pointer">
              <input
                type="checkbox"
                checked={codeWorkspace}
                onChange={(e) => setCodeWorkspace(e.target.checked)}
                className="rounded border-[#32302D] text-[#DB7A57] focus:ring-0 bg-[#211E1C]"
              />
              <span>Enable Live Code Workspace</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-[#CBC3B9] cursor-pointer">
              <input type="checkbox" checked={requireWebcam} onChange={(e) => setRequireWebcam(e.target.checked)} className="rounded border-[#32302D] text-[#DB7A57] focus:ring-0 bg-[#211E1C]" />
              <span>Require Webcam</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-[#CBC3B9] cursor-pointer">
              <input type="checkbox" checked={requireAudio} onChange={(e) => setRequireAudio(e.target.checked)} className="rounded border-[#32302D] text-[#DB7A57] focus:ring-0 bg-[#211E1C]" />
              <span>Require Microphone</span>
            </label>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#32302D] text-xs font-medium text-[#CBC3B9] hover:bg-[#211E1C] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 rounded-full bg-[#DB7A57] hover:bg-[#EA8D69] text-[#110F0E] text-xs font-semibold shadow-glow flex items-center gap-2 transition-all duration-300 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Creating...' : 'Schedule & Issue Key'}</span>
            </button>
          </div>

          <div className="pt-4 border-t border-[#32302D] flex items-center justify-between gap-4">
            <div><div className="text-xs font-medium text-[#CBC3B9]">Bulk schedule students</div><div className="mt-1 text-[11px] text-[#ABA7A2]">CSV supports up to 500 valid rows.</div></div>
            <div className="flex gap-2 shrink-0"><button type="button" onClick={downloadTemplate} className="px-3 py-2 rounded-full border border-[#32302D] text-[11px] text-[#CBC3B9]">Template</button><label className="px-3 py-2 rounded-full bg-[#211E1C] text-[11px] text-[#F4F2EB] cursor-pointer">{isLoading ? 'Uploading...' : 'Upload CSV'}<input type="file" accept=".csv,text/csv" className="hidden" disabled={isLoading} onChange={(e) => e.target.files?.[0] && uploadCsv(e.target.files[0])} /></label></div>
          </div>
        </form>
      </div>
    </div>
  );
};
