import React from 'react';
import { ProctoringEvent } from '../../types';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, MonitorX, EyeOff, Radio } from 'lucide-react';

interface ProctoringMonitorProps {
  events: ProctoringEvent[];
  isScreenSharingActive?: boolean;
}

export const ProctoringMonitor: React.FC<ProctoringMonitorProps> = ({ events, isScreenSharingActive = true }) => {
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-950 text-rose-400 border border-rose-800">Critical</span>;
      case 'high':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#DB7A57]/20 text-[#DB7A57] border border-[#DB7A57]/40">High</span>;
      case 'medium':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-950 text-amber-400 border border-amber-800">Medium</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#211E1C] text-[#ABA7A2] border border-[#32302D]">Notice</span>;
    }
  };

  const getEventIcon = (eventType: string) => {
    const type = eventType.toUpperCase();
    if (type.includes('TAB') || type.includes('WINDOW')) {
      return <EyeOff className="w-4 h-4 text-[#DB7A57]" />;
    }
    if (type.includes('SCREEN')) {
      return <MonitorX className="w-4 h-4 text-rose-400" />;
    }
    if (type.includes('UNAUTHORIZED') || type.includes('PERMISSION')) {
      return <ShieldAlert className="w-4 h-4 text-rose-500" />;
    }
    return <Info className="w-4 h-4 text-[#CBC3B9]" />;
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#191715] border border-[#32302D] rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-[#32302D] flex items-center justify-between bg-[#110F0E]">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#DB7A57] animate-pulse" />
          <h3 className="text-sm font-semibold text-[#F4F2EB]">Live Proctoring Guardian</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#ABA7A2]">Total Incidents:</span>
          <span className="font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#211E1C] text-[#DB7A57] border border-[#32302D]">
            {events.length}
          </span>
        </div>
      </div>

      {/* Proctoring Vitals Checklist */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-[#110F0E]/50 border-b border-[#32302D] text-xs">
        <div className="flex items-center gap-2 p-2 rounded-xl bg-[#211E1C] border border-[#32302D]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[#CBC3B9]">Webcam Stream</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-xl bg-[#211E1C] border border-[#32302D]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[#CBC3B9]">Microphone Input</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-xl bg-[#211E1C] border border-[#32302D]">
          {isScreenSharingActive ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span className="text-[#CBC3B9]">Screen Capture</span>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-xl bg-[#211E1C] border border-[#32302D]">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[#CBC3B9]">Guardian V3</span>
        </div>
      </div>

      {/* Real-time Event Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#ABA7A2] text-xs py-10">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mb-2" />
            <p className="font-medium text-[#F4F2EB]">Session is compliant.</p>
            <p className="text-[11px] text-[#ABA7A2] mt-1 text-center max-w-[200px]">
              No abnormal tab switches or unauthorized resource navigations detected.
            </p>
          </div>
        ) : (
          events.map((ev) => (
            <div
              key={ev.id}
              className="p-3 rounded-xl bg-[#211E1C] border border-[#32302D] hover:border-[#DB7A57]/40 transition-all flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getEventIcon(ev.event_type)}
                  <span className="text-xs font-semibold text-[#F4F2EB] capitalize">
                    {ev.event_type.replace(/_/g, ' ').toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getSeverityBadge(ev.severity)}
                  <span className="text-[10px] font-mono text-[#ABA7A2]">
                    {formatTimestamp(ev.detected_at)}
                  </span>
                </div>
              </div>

              {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                <div className="text-[11px] font-mono bg-[#110F0E] p-2 rounded-lg text-[#ABA7A2] border border-[#32302D] break-all">
                  {JSON.stringify(ev.metadata)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
