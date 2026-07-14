'use client';

import { useRef, useEffect } from 'react';
import { useDmCall } from '@/contexts/DmCallContext';

export default function DmVideoCall({ onClose }) {
  const { callState, toggleMic, toggleCam, endCall } = useDmCall();
  const { localStream, remoteStream, micMuted, camOff } = callState;

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
      <div className="relative flex-1 flex items-center justify-center bg-black/90">
        <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />
        <video
          ref={localVideoRef}
          className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg border-2 border-white shadow-lg"
          autoPlay
          playsInline
          muted
        />
      </div>

      <div className="flex justify-center gap-4 p-4 bg-black/80">
        <button onClick={toggleMic} className={`p-3 rounded-full ${micMuted ? 'bg-rose-500' : 'bg-white/20'} text-white hover:bg-white/30 transition`}>
          {micMuted ? '🔇' : '🎤'}
        </button>
        <button onClick={toggleCam} className={`p-3 rounded-full ${camOff ? 'bg-rose-500' : 'bg-white/20'} text-white hover:bg-white/30 transition`}>
          {camOff ? '📷' : '📹'}
        </button>
        <button onClick={handleEnd} className="p-3 rounded-full bg-rose-600 text-white hover:bg-rose-700 transition">
          📞 End Call
        </button>
      </div>
    </div>
  );
}