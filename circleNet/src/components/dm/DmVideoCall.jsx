'use client';

import { useRef, useEffect } from 'react';
import { useDmCall } from '@/contexts/DmCallContext';

export default function DmVideoCall({ onClose }) {
  const { callState, toggleMic, toggleCam, endCall } = useDmCall();
  const { localStream, remoteStream, micMuted, camOff, status, peerName, peerAvatar } = callState;

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const handleEnd = () => {
    endCall();
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 z-[1500] bg-black flex flex-col">
      {/* Video area */}
      <div className="relative flex-1 flex items-center justify-center bg-black/90">
        {/* Remote video – may be black/empty while ringing */}
        <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />
        {/* Local video preview */}
        <video
          ref={localVideoRef}
          className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg border-2 border-white shadow-lg"
          autoPlay
          playsInline
          muted
        />

        {/* ─── Ringing Overlay ─── */}
        {status === 'ringing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative w-32 h-32">
              {/* Pulsing rings */}
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-accent)] animate-ping opacity-75" />
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-accent)] animate-pulse" />
              {/* Phone icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[var(--color-accent)]"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
            </div>
            <p className="mt-6 text-white text-xl font-head">Calling {peerName || '...'}</p>
            <p className="text-[var(--color-txt2)] text-sm">Waiting for the other person to answer</p>
          </div>
        )}
      </div>

      {/* Controls – always visible */}
      <div className="flex justify-center gap-4 p-4 bg-black/80">
        {/* Mic Button */}
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full ${micMuted ? 'bg-rose-500' : 'bg-white/20'} text-white hover:bg-white/30 transition relative`}
          aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
          disabled={status === 'ringing'} // optional
          title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          {micMuted && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="absolute inset-0 m-auto text-rose-500"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
            >
              <line x1="2" y1="22" x2="22" y2="2" />
            </svg>
          )}
        </button>

        {/* Camera Button */}
        <button
          onClick={toggleCam}
          className={`p-3 rounded-full ${camOff ? 'bg-rose-500' : 'bg-white/20'} text-white hover:bg-white/30 transition relative`}
          aria-label={camOff ? 'Turn camera on' : 'Turn camera off'}
          disabled={status === 'ringing'}
          title={camOff ? 'Turn camera on' : 'Turn camera off'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 7l-7 5.72V7a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5.72L23 17V7z" />
          </svg>
          {camOff && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              className="absolute inset-0 m-auto text-rose-500"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
            >
              <line x1="2" y1="22" x2="22" y2="2" />
            </svg>
          )}
        </button>

        {/* End / Cancel Call */}
        <button
          onClick={handleEnd}
          className={`p-3 rounded-full ${status === 'ringing' ? 'bg-gray-600' : 'bg-rose-600'} text-white hover:${status === 'ringing' ? 'bg-gray-700' : 'bg-rose-700'} transition`}
          title={status === 'ringing' ? 'Cancel call' : 'End call'}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          {status === 'ringing' && <span className="ml-1 text-sm">Cancel</span>}
        </button>
      </div>
    </div>
  );
}