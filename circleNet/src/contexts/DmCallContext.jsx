// src/contexts/DmCallContext.jsx
'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useWs } from '@/contexts/WsContext';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add TURN server for production
  ],
};

const DmCallContext = createContext();

export function DmCallProvider({ children }) {
  const { user } = useAuth();
  const { sendMessage, registerHandler } = useWs();

  const [callState, setCallState] = useState({
    isActive: false,
    isIncoming: false,
    status: 'idle', // 'idle' | 'ringing' | 'connected'
    callerId: null,
    callerName: '',
    callerAvatar: '',
    peerId: null,
    peerName: '',
    peerAvatar: '',
    localStream: null,
    remoteStream: null,
    micMuted: false,
    camOff: false,
    callStartTime: null, // Track when call started
  });

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const MISSED_CALL_TIMEOUT = 30000; // 30 seconds

  const log = (msg, data) => console.log(`[DmCall] ${msg}`, data || '');

  // ── Create peer connection ──
  const createPeerConnection = useCallback((onTrack, onIceCandidate) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pc.ontrack = (event) => {
      log('Received remote track', event.streams[0]);
      if (event.streams.length) {
        setCallState(prev => ({ ...prev, remoteStream: event.streams[0] }));
      }
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };
    pc.oniceconnectionstatechange = () => {
      log('ICE state:', pc.iceConnectionState);
    };
    return pc;
  }, []);

  // ── Send missed call notification ──
  const sendMissedCall = useCallback(async (peerId, callerName, callerAvatar) => {
    log('Sending missed call notification to', peerId);
    sendMessage({
      type: 'call:missed',
      to: peerId,
      fromName: callerName || user?.name || user?.username || 'Unknown',
      fromAvatar: callerAvatar || user?.picture || '',
      timestamp: new Date().toISOString(),
    });
  }, [sendMessage, user]);

  // ── Start a call (caller) ──
  const startCall = useCallback(async (peerId, peerName = '', peerAvatar = '') => {
    if (!user) {
      log('No user');
      return;
    }
    if (callState.isActive) {
      log('Call already active');
      return;
    }
    log('Starting call to', peerId);

    // Clear any existing timeout
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setCallState(prev => ({
        ...prev,
        localStream: stream,
        peerId,
        peerName,
        peerAvatar,
        isActive: true,
        isIncoming: false,
        status: 'ringing',
        callStartTime: Date.now(),
      }));

      const pc = createPeerConnection(
        (event) => setCallState(prev => ({ ...prev, remoteStream: event.streams[0] })),
        (candidate) => {
          log('Sending ICE candidate to', peerId);
          sendMessage({ type: 'call:ice', to: peerId, candidate });
        }
      );
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendMessage({
        type: 'call:start',
        to: peerId,
        offer,
        fromName: user.name || user.username,
        fromAvatar: user.picture || '',
      });
      log('Offer sent to', peerId);

      // Set timeout for missed call
      callTimeoutRef.current = setTimeout(() => {
        log('Call timed out - missed by', peerId);
        // Send missed call notification
        sendMissedCall(peerId, user.name || user.username, user.picture || '');
        // End the call
        endCall();
      }, MISSED_CALL_TIMEOUT);

    } catch (err) {
      console.error('Failed to start call:', err);
      // Reset state
      setCallState(prev => ({ ...prev, isActive: false, status: 'idle' }));
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    }
  }, [user, sendMessage, createPeerConnection, callState.isActive, sendMissedCall]);

  // ── Accept an incoming call ──
  const acceptCall = useCallback(async (callerId, offer) => {
    log('Accepting call from', callerId);

    // Clear any incoming timeout
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setCallState(prev => ({
        ...prev,
        localStream: stream,
        peerId: callerId,
        peerName: prev.callerName,
        peerAvatar: prev.callerAvatar,
        isActive: true,
        isIncoming: false,
        status: 'connected',
        callStartTime: Date.now(),
      }));

      const pc = createPeerConnection(
        (event) => setCallState(prev => ({ ...prev, remoteStream: event.streams[0] })),
        (candidate) => {
          log('Sending ICE candidate to', callerId);
          sendMessage({ type: 'call:ice', to: callerId, candidate });
        }
      );
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendMessage({ type: 'call:accept', to: callerId, answer });
      log('Answer sent to', callerId);
    } catch (err) {
      console.error('Failed to accept call:', err);
      // Reset state
      setCallState(prev => ({ ...prev, isActive: false, isIncoming: false, status: 'idle' }));
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
    }
  }, [sendMessage, createPeerConnection]);

  // ── End call ──
  const endCall = useCallback(() => {
    log('Ending call');
    
    // Clear timeout
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    // Check if this is a missed call (still in ringing state)
    const wasRinging = callState.status === 'ringing';
    const isIncoming = callState.isIncoming;

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    // Send missed call notification if this was an outgoing call that wasn't answered
    if (wasRinging && !isIncoming && callState.peerId) {
      log('Call ended while ringing - sending missed call notification');
      sendMissedCall(
        callState.peerId,
        user?.name || user?.username || 'Unknown',
        user?.picture || ''
      );
    }

    if (callState.peerId) {
      sendMessage({ type: 'call:end', to: callState.peerId });
    }

    setCallState({
      isActive: false,
      isIncoming: false,
      status: 'idle',
      callerId: null,
      callerName: '',
      callerAvatar: '',
      peerId: null,
      peerName: '',
      peerAvatar: '',
      localStream: null,
      remoteStream: null,
      micMuted: false,
      camOff: false,
      callStartTime: null,
    });
  }, [callState.peerId, callState.status, callState.isIncoming, sendMessage, user, sendMissedCall]);

  // ── Toggles ──
  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const audio = localStreamRef.current.getAudioTracks()[0];
      if (audio) {
        audio.enabled = !audio.enabled;
        setCallState(prev => ({ ...prev, micMuted: !audio.enabled }));
      }
    }
  }, []);

  const toggleCam = useCallback(() => {
    if (localStreamRef.current) {
      const video = localStreamRef.current.getVideoTracks()[0];
      if (video) {
        video.enabled = !video.enabled;
        setCallState(prev => ({ ...prev, camOff: !video.enabled }));
      }
    }
  }, []);

  // ── WebSocket message handler ──
  useEffect(() => {
    const unsubStart = registerHandler('call:start', (msg) => {
      log('📞 Incoming call from', msg.from);
      
      // Clear any existing timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      setCallState(prev => ({
        ...prev,
        isIncoming: true,
        callerId: msg.from,
        callerName: msg.fromName || 'Unknown',
        callerAvatar: msg.fromAvatar || '',
        offer: msg.offer,
        status: 'ringing',
        callStartTime: Date.now(),
      }));

      // Set timeout for missed incoming call (if user doesn't answer)
      callTimeoutRef.current = setTimeout(() => {
        log('Incoming call timed out - missed from', msg.from);
        // Send missed call notification back to caller
        sendMessage({
          type: 'call:missed',
          to: msg.from,
          fromName: user?.name || user?.username || 'Unknown',
          fromAvatar: user?.picture || '',
          timestamp: new Date().toISOString(),
        });
        // Reset state
        setCallState(prev => ({
          ...prev,
          isIncoming: false,
          status: 'idle',
          callerId: null,
          callerName: '',
          callerAvatar: '',
          offer: null,
        }));
        callTimeoutRef.current = null;
      }, MISSED_CALL_TIMEOUT);
    });

    const unsubAccept = registerHandler('call:accept', ({ from, answer }) => {
      log('Call accepted by', from);
      // Clear timeout on accept
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      if (pcRef.current && !pcRef.current.currentRemoteDescription) {
        pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
          .catch(err => console.error('Set remote desc error:', err));
      }
      setCallState(prev => ({ ...prev, status: 'connected' }));
    });

    const unsubIce = registerHandler('call:ice', ({ from, candidate }) => {
      if (pcRef.current) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(err => console.warn('ICE error:', err));
      }
    });

    const unsubEnd = registerHandler('call:end', (msg) => {
      log('Call ended by peer');
      endCall();
    });

    // Handle missed call notifications
    const unsubMissed = registerHandler('call:missed', (msg) => {
      log('📱 Missed call from', msg.from);
      // This will be handled by DmContext to insert a system message
    });

    return () => {
      unsubStart();
      unsubAccept();
      unsubIce();
      unsubEnd();
      unsubMissed();
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
    };
  }, [registerHandler, sendMessage, endCall, user]);

  // ── Incoming call actions ──
  const acceptIncoming = useCallback(() => {
    if (callState.callerId && callState.offer) {
      acceptCall(callState.callerId, callState.offer);
    }
  }, [callState.callerId, callState.offer, acceptCall]);

  const rejectIncoming = useCallback(() => {
    // Send missed call notification when rejecting
    if (callState.callerId) {
      sendMessage({
        type: 'call:missed',
        to: callState.callerId,
        fromName: user?.name || user?.username || 'Unknown',
        fromAvatar: user?.picture || '',
        timestamp: new Date().toISOString(),
      });
      sendMessage({ type: 'call:end', to: callState.callerId });
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    setCallState(prev => ({ ...prev, isIncoming: false, callerId: null, callerName: '', callerAvatar: '', offer: null, status: 'idle' }));
  }, [callState.callerId, sendMessage, user]);

  const value = {
    callState,
    startCall,
    acceptCall,
    endCall,
    toggleMic,
    toggleCam,
    acceptIncoming,
    rejectIncoming,
  };

  return <DmCallContext.Provider value={value}>{children}</DmCallContext.Provider>;
}

export function useDmCall() {
  const ctx = useContext(DmCallContext);
  if (!ctx) throw new Error('useDmCall must be used within DmCallProvider');
  return ctx;
}