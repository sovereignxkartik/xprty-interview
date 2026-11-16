import React, { useCallback, useEffect, useRef, useState } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import type IJitsiMeetExternalApi from '@jitsi/react-sdk/lib/types/IJitsiMeetExternalApi';
import { AlertCircle, Users, Wifi, WifiOff, X } from 'lucide-react';

interface VideoRoomProps { roomName: string; domain: string; userName: string; onLeave?: () => void; onScreenShareToggle?: (isSharing: boolean) => void; }

/** Embedded Jitsi meeting with its native, accessible call controls. */
export const VideoRoom: React.FC<VideoRoomProps> = ({ roomName, domain, userName, onLeave, onScreenShareToggle }) => {
  const apiRef = useRef<IJitsiMeetExternalApi | null>(null);
  const [state, setState] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(1);
  const updateParticipants = useCallback(() => setParticipantCount(apiRef.current?.getNumberOfParticipants() || 1), []);
  const handleApiReady = useCallback((api: IJitsiMeetExternalApi) => {
    apiRef.current = api;
    api.addEventListener('videoConferenceJoined', () => { setState('connected'); updateParticipants(); });
    api.addEventListener('participantJoined', updateParticipants);
    api.addEventListener('participantLeft', updateParticipants);
    api.addEventListener('screenSharingStatusChanged', (() => onScreenShareToggle?.(true)) as () => void);
    api.addEventListener('videoConferenceLeft', () => onLeave?.());
    api.addEventListener('errorOccurred', () => { setError('Jitsi could not connect to the meeting. Check your network and try again.'); setState('error'); });
  }, [onLeave, onScreenShareToggle, updateParticipants]);
  useEffect(() => () => { apiRef.current?.dispose(); apiRef.current = null; }, []);
  if (!roomName) return <div className="flex h-full items-center justify-center rounded-2xl border border-[#32302D] bg-[#191715] p-6 text-center text-sm text-[#ABA7A2]">The interview meeting is still being prepared.</div>;
  return <div className="relative h-full min-h-[360px] overflow-hidden rounded-2xl border border-[#32302D] bg-[#110F0E] shadow-xl">
    <JitsiMeeting domain={domain || 'meet.jit.si'} roomName={roomName} userInfo={{ displayName: userName, email: '' }} configOverwrite={{ prejoinPageEnabled: true, disableDeepLinking: true }} interfaceConfigOverwrite={{ TOOLBAR_BUTTONS: ['microphone', 'camera', 'desktop', 'fullscreen', 'fodeviceselection', 'hangup', 'tileview', 'settings'] }} onApiReady={handleApiReady} onReadyToClose={onLeave} getIFrameRef={(node) => { node.style.height = '100%'; node.style.width = '100%'; }} />
    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-[#32302D] bg-[#110F0E]/90 px-3 py-1.5 text-[11px] text-[#CBC3B9] backdrop-blur">{state === 'connected' ? <Wifi size={14} className="text-emerald-400" /> : state === 'error' ? <WifiOff size={14} className="text-rose-400" /> : <Wifi size={14} className="text-[#DB7A57]" />}<span>{state === 'connected' ? 'Connected' : state === 'error' ? 'Connection failed' : 'Connecting…'}</span><span className="flex items-center gap-1"><Users size={13} />{participantCount}</span></div>
    {error && <div role="alert" className="absolute inset-x-4 bottom-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/90 p-3 text-xs text-rose-100"><AlertCircle size={16} />{error}<button onClick={() => setError(null)} className="ml-auto rounded p-0.5 text-rose-100 hover:bg-white/10" aria-label="Dismiss video warning"><X size={15} /></button></div>}
  </div>;
};
