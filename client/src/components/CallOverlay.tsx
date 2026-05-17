import React, { useEffect, useRef } from 'react';
import type { UseWebRTCReturn } from '../hooks/useWebRTC';

interface CallOverlayProps extends UseWebRTCReturn { remoteName: string; }

export const CallOverlay: React.FC<CallOverlayProps> = ({
    callStatus, callType, localStream, remoteStream, remoteName,
    acceptCall, rejectCall, endCall, toggleMute, toggleCamera, isMuted, isCameraOff,
}) => {
    const localVideoRef  = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => { if (localVideoRef.current  && localStream)  localVideoRef.current.srcObject  = localStream;  }, [localStream]);
    useEffect(() => { if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream; }, [remoteStream]);

    if (callStatus === 'idle') return null;

    const isVoice   = callType === 'voice';
    const callLabel = isVoice ? 'Voice call' : 'Video call';

    const avatar = (size: string, pulse = false) => (
        <div className={`relative ${size} rounded-full bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center font-bold text-white shadow-glow-violet ${pulse ? 'pulse-ring' : ''}`}>
            {remoteName.charAt(0).toUpperCase()}
        </div>
    );

    return (
        <div role="dialog" aria-modal="true"
            aria-label={callStatus === 'incoming' ? `Incoming ${callLabel} from ${remoteName}` : `${callLabel} with ${remoteName}`}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 sm:gap-6 p-4 sm:p-6 bg-zinc-950/97 backdrop-blur-xl safe-top safe-bottom overflow-hidden">

            {/* Incoming */}
            {callStatus === 'incoming' && (
                <div className="flex flex-col items-center gap-5 sm:gap-6 animate-slide-up w-full max-w-xs">
                    {avatar('h-20 w-20 sm:h-24 sm:w-24 text-2xl sm:text-3xl', true)}
                    <div className="text-center">
                        <p className="text-zinc-400 text-xs sm:text-sm tracking-wide uppercase">Incoming {callLabel}</p>
                        <p className="text-white text-xl sm:text-2xl font-semibold mt-1">{remoteName}</p>
                    </div>
                    <div className="flex gap-10 sm:gap-12 mt-2">
                        <div className="flex flex-col items-center gap-2">
                            <button type="button" onClick={rejectCall} aria-label="Decline call"
                                className="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-400 shadow-lg">
                                <PhoneOffIcon />
                            </button>
                            <span className="text-xs text-zinc-500">Decline</span>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <button type="button" onClick={acceptCall} aria-label="Accept call"
                                className="h-16 w-16 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 shadow-lg">
                                <PhoneIcon />
                            </button>
                            <span className="text-xs text-zinc-500">Accept</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Calling */}
            {callStatus === 'calling' && (
                <div className="flex flex-col items-center gap-4 sm:gap-5 animate-slide-up">
                    {avatar('h-20 w-20 sm:h-24 sm:w-24 text-2xl sm:text-3xl', true)}
                    <div className="text-center">
                        <p className="text-white text-xl sm:text-2xl font-semibold">{remoteName}</p>
                        <p className="text-zinc-400 text-sm mt-1 animate-pulse-slow">{isVoice ? 'Calling…' : 'Video calling…'}</p>
                    </div>
                    <button type="button" onClick={endCall} aria-label="Cancel call"
                        className="mt-2 h-14 w-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95">
                        <PhoneOffIcon />
                    </button>
                </div>
            )}

            {/* Connected — Video */}
            {callStatus === 'connected' && !isVoice && (
                <div className="w-full h-full flex flex-col gap-3 sm:gap-4 animate-fade-in sm:max-w-3xl sm:mx-auto">
                    <div className="relative w-full flex-1 sm:flex-none sm:aspect-video bg-zinc-900 rounded-none sm:rounded-xl overflow-hidden border-0 sm:border sm:border-zinc-800 shadow-2xl">
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" aria-label={`${remoteName}'s video`} />
                        {!remoteStream && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                {avatar('h-16 w-16 sm:h-20 sm:w-20 text-xl sm:text-2xl')}
                                <p className="text-zinc-400 text-sm">Connecting…</p>
                            </div>
                        )}
                        <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg bg-black/50 backdrop-blur-sm text-xs text-white font-medium">
                            {remoteName}
                        </div>
                        {/* Local PiP */}
                        <div className="absolute bottom-3 right-3 w-28 sm:w-36 aspect-video bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700 shadow-xl">
                            <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" aria-label="Your video" />
                            {isCameraOff && (
                                <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
                                    <span className="text-zinc-500 text-[10px]">Camera off</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-3 sm:gap-4 py-2 sm:py-0 shrink-0">
                        <ControlBtn onClick={toggleMute} label={isMuted ? 'Unmute' : 'Mute'} active={isMuted}>
                            {isMuted ? <MicOffIcon /> : <MicIcon />}
                        </ControlBtn>
                        <button type="button" onClick={endCall} aria-label="End call"
                            className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg">
                            <PhoneOffIcon />
                        </button>
                        <ControlBtn onClick={toggleCamera} label={isCameraOff ? 'Camera on' : 'Camera off'} active={isCameraOff}>
                            {isCameraOff ? <VideoOffIcon /> : <VideoIcon />}
                        </ControlBtn>
                    </div>
                </div>
            )}

            {/* Connected — Voice */}
            {callStatus === 'connected' && isVoice && (
                <div className="flex flex-col items-center gap-5 sm:gap-6 animate-fade-in">
                    <audio ref={(el) => { if (el && remoteStream) el.srcObject = remoteStream; }} autoPlay aria-hidden="true" />
                    {avatar('h-24 w-24 sm:h-28 sm:w-28 text-3xl sm:text-4xl')}
                    <div className="text-center">
                        <p className="text-white text-xl sm:text-2xl font-semibold">{remoteName}</p>
                        <p className="text-zinc-400 text-sm mt-1">Voice call in progress</p>
                    </div>
                    <div className="flex items-end gap-1 h-8" aria-hidden="true">
                        {[0,1,2,3,4].map((i) => <div key={i} className="voice-wave-bar w-1.5 rounded-full bg-violet-500 h-full" />)}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                        <ControlBtn onClick={toggleMute} label={isMuted ? 'Unmute' : 'Mute'} active={isMuted}>
                            {isMuted ? <MicOffIcon /> : <MicIcon />}
                        </ControlBtn>
                        <button type="button" onClick={endCall} aria-label="End call"
                            className="h-14 w-14 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg">
                            <PhoneOffIcon />
                        </button>
                    </div>
                </div>
            )}

            {/* Ended */}
            {callStatus === 'ended' && (
                <div className="flex flex-col items-center gap-3 animate-fade-in">
                    {avatar('h-14 w-14 sm:h-16 sm:w-16 text-lg sm:text-xl')}
                    <p className="text-white text-lg font-semibold">{remoteName}</p>
                    <p className="text-zinc-400 text-sm">Call ended</p>
                </div>
            )}
        </div>
    );
};

const ControlBtn: React.FC<{ onClick: () => void; label: string; active: boolean; children: React.ReactNode; }> = ({ onClick, label, active, children }) => (
    <div className="flex flex-col items-center gap-1.5">
        <button type="button" onClick={onClick} aria-label={label}
            className={['h-12 w-12 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500',
                active ? 'bg-red-700 hover:bg-red-600' : 'bg-zinc-700/80 hover:bg-zinc-600'].join(' ')}>
            {children}
        </button>
        <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
);

const PhoneIcon    = () => <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white"><path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" /></svg>;
const PhoneOffIcon = () => <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white"><path fillRule="evenodd" d="M15.22 3.22a.75.75 0 011.06 0L18 4.94l1.72-1.72a.75.75 0 111.06 1.06L19.06 6l1.72 1.72a.75.75 0 11-1.06 1.06L18 7.06l-1.72 1.72a.75.75 0 11-1.06-1.06L16.94 6l-1.72-1.72a.75.75 0 010-1.06zM1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" /></svg>;
const MicIcon      = () => <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white"><path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" /><path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" /></svg>;
const MicOffIcon   = () => <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white"><path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-2.572-2.573a6.745 6.745 0 001.042-3.457v-1.5a.75.75 0 00-1.5 0v1.5c0 .93-.196 1.813-.543 2.612L15.53 16.47A3.75 3.75 0 0112 12.75a3.72 3.72 0 01-.177-1.133L8.53 8.324A3.75 3.75 0 008.25 9.75v3a3.75 3.75 0 005.85 3.096l1.178 1.178A5.25 5.25 0 016.75 12.75v-1.5a.75.75 0 00-1.5 0v1.5a6.751 6.751 0 006 6.709v2.291h-3a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-3v-2.291a6.712 6.712 0 001.687-.517l-1.116-1.116A5.25 5.25 0 016.75 12.75v-1.5a.75.75 0 00-1.5 0v1.5zM12 3a3.75 3.75 0 00-3.75 3.75v.443l7.107 7.107A3.75 3.75 0 0015.75 12V6.75A3.75 3.75 0 0012 3z" /></svg>;
const VideoIcon    = () => <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white"><path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06z" /></svg>;
const VideoOffIcon = () => <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white"><path d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.5 17.69c0 .471-.202.86-.504 1.124l-4.746-4.746V7.939l2.69-2.689c.944-.945 2.56-.276 2.56 1.06v11.38zM15.75 7.5v5.068L7.682 4.5h5.068a3 3 0 013 3zM1.5 7.5c0-.782.299-1.494.785-2.028L12 15.787V16.5a3 3 0 01-3 3H4.5a3 3 0 01-3-3v-9z" /></svg>;

export default CallOverlay;
