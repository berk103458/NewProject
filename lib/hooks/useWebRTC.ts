import { useState, useRef, useCallback, useEffect } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";

interface UseWebRTCOptions {
  matchId: string;
  userId: string;
  otherUserId: string;
  callType: "voice" | "video";
  onCallEnd?: () => void;
}

interface SignalingMessage {
  type: "offer" | "answer" | "ice-candidate" | "call-end";
  data: any;
  from: string;
  to: string;
}

export function useWebRTC({
  matchId,
  userId,
  otherUserId,
  callType,
  onCallEnd,
}: UseWebRTCOptions) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalingChannelRef = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const endCallRef = useRef<(() => void) | null>(null);
  const handleSignalingMessageRef = useRef<((message: SignalingMessage) => Promise<void>) | null>(null);
  const supabase = createSupabaseClient();

  // STUN servers (free, public)
  const iceServers: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      // TURN server eklenebilir (opsiyonel, ücretli servisler gerekebilir)
    ],
  };

  // Send signaling message via Supabase Realtime
  const sendSignalingMessage = useCallback(
    (message: SignalingMessage) => {
      if (!signalingChannelRef.current) return;
      signalingChannelRef.current.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload: message,
      });
    },
    []
  );

  // Initialize peer connection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(iceServers);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignalingMessage({
          type: "ice-candidate",
          data: event.candidate,
          from: userId,
          to: otherUserId,
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log("Received remote track", event);
      if (event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        if (endCallRef.current) {
          endCallRef.current();
        }
      } else if (pc.connectionState === "connected") {
        setIsConnecting(false);
        setIsCallActive(true);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [userId, otherUserId, sendSignalingMessage]);

  // Setup signaling channel
  const setupSignaling = useCallback(() => {
    const channel = supabase.channel(`webrtc:${matchId}:${userId}`);
    
    channel
      .on("broadcast", { event: "webrtc-signal" }, (payload) => {
        const message = payload.payload as SignalingMessage;
        // Only process messages for this user
        if (message.to !== userId) return;

        if (handleSignalingMessageRef.current) {
          handleSignalingMessageRef.current(message);
        }
      })
      .subscribe();

    signalingChannelRef.current = channel;
    return channel;
  }, [matchId, userId, supabase]);

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;

      try {
        switch (message.type) {
          case "offer":
            await pc.setRemoteDescription(new RTCSessionDescription(message.data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignalingMessage({
              type: "answer",
              data: answer,
              from: userId,
              to: otherUserId,
            });
            break;

          case "answer":
            await pc.setRemoteDescription(new RTCSessionDescription(message.data));
            break;

          case "ice-candidate":
            await pc.addIceCandidate(new RTCIceCandidate(message.data));
            break;

          case "call-end":
            if (endCallRef.current) {
              endCallRef.current();
            }
            break;
        }
      } catch (error) {
        console.error("Error handling signaling message:", error);
        setError("Signaling hatası: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
      }
    },
    [userId, otherUserId, sendSignalingMessage]
  );

  // Start call (initiator)
  const startCall = useCallback(async () => {
    try {
      setError(null);
      setIsConnecting(true);

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Setup signaling
      setupSignaling();

      // Create peer connection
      const pc = createPeerConnection();

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendSignalingMessage({
        type: "offer",
        data: offer,
        from: userId,
        to: otherUserId,
      });

      setIsCallActive(true);
    } catch (error) {
      console.error("Error starting call:", error);
      setError("Arama başlatılamadı: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
      setIsConnecting(false);
      if (endCallRef.current) {
        endCallRef.current();
      }
    }
  }, [callType, userId, otherUserId, createPeerConnection, setupSignaling, sendSignalingMessage]);

  // Answer call (receiver)
  const answerCall = useCallback(async () => {
    try {
      setError(null);
      setIsConnecting(true);

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video",
      });

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Setup signaling (if not already done)
      if (!signalingChannelRef.current) {
        setupSignaling();
      }

      // Create peer connection
      const pc = createPeerConnection();

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Answer will be sent when offer is received via handleSignalingMessage
    } catch (error) {
      console.error("Error answering call:", error);
      setError("Arama cevaplanamadı: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
      setIsConnecting(false);
      if (endCallRef.current) {
        endCallRef.current();
      }
    }
  }, [callType, createPeerConnection, setupSignaling]);

  // End call
  const endCall = useCallback(() => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Send call-end signal
    sendSignalingMessage({
      type: "call-end",
      data: {},
      from: userId,
      to: otherUserId,
    });

    // Cleanup signaling channel
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }

    // Reset state
    setIsCallActive(false);
    setIsConnecting(false);
    setRemoteStream(null);
    setError(null);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    onCallEnd?.();
  }, [localStream, userId, otherUserId, sendSignalingMessage, onCallEnd, supabase]);

  // Update refs
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  useEffect(() => {
    handleSignalingMessageRef.current = handleSignalingMessage;
  }, [handleSignalingMessage]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  }, [localStream, isMuted]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  }, [localStream, isVideoOff]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    isCallActive,
    isConnecting,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    error,
    startCall,
    answerCall,
    endCall,
    toggleMute,
    toggleVideo,
    localVideoRef,
    remoteVideoRef,
  };
}

