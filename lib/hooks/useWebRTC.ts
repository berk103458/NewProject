import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";

interface UseWebRTCOptions {
  matchId: string;
  userId: string;
  otherUserId: string;
  callType: "voice" | "video";
  enabled?: boolean; // Only enable WebRTC when both users are ready
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
  enabled = true,
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

  // STUN servers (free, public) - memoized to avoid recreating on every render
  const iceServers: RTCConfiguration = useMemo(
    () => ({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // TURN server eklenebilir (opsiyonel, ücretli servisler gerekebilir)
      ],
    }),
    []
  );

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
        console.log("Sending ICE candidate");
        sendSignalingMessage({
          type: "ice-candidate",
          data: event.candidate,
          from: userId,
          to: otherUserId,
        });
      } else {
        console.log("ICE gathering complete");
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        setError("Bağlantı kesildi. Lütfen tekrar deneyin.");
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log("Received remote track", event.track.kind);
      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch((err) => {
            console.warn("Remote video play failed:", err);
          });
        }
        setIsCallActive(true);
        setIsConnecting(false);
        console.log("Remote stream set, call active");
      } else if (event.track) {
        // Fallback: create stream from track
        const stream = new MediaStream([event.track]);
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch((err) => {
            console.warn("Remote video play failed:", err);
          });
        }
        setIsCallActive(true);
        setIsConnecting(false);
        console.log("Remote track set, call active");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, otherUserId, sendSignalingMessage, iceServers]);

  // Setup signaling channel
  const setupSignaling = useCallback(() => {
    // Cleanup existing channel if any
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
    }

    const channel = supabase.channel(`webrtc:${matchId}:${userId}`, {
      config: {
        broadcast: { self: false },
      },
    });
    
    channel
      .on("broadcast", { event: "webrtc-signal" }, (payload) => {
        const message = payload.payload as SignalingMessage;
        // Only process messages for this user
        if (message.to !== userId) return;

        if (handleSignalingMessageRef.current) {
          handleSignalingMessageRef.current(message);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("WebRTC signaling channel subscribed");
        } else if (status === "CHANNEL_ERROR") {
          console.error("WebRTC signaling channel error");
          setError("Bağlantı hatası: Signaling channel açılamadı");
        }
      });

    signalingChannelRef.current = channel;
    return channel;
  }, [matchId, userId, supabase]);

  // Handle incoming signaling messages
  const handleSignalingMessage = useCallback(
    async (message: SignalingMessage) => {
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.warn("Peer connection not ready, ignoring signaling message");
        return;
      }

      try {
        switch (message.type) {
          case "offer":
            console.log("Received offer, creating answer");
            await pc.setRemoteDescription(new RTCSessionDescription(message.data));
            const answer = await pc.createAnswer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: callType === "video",
            });
            await pc.setLocalDescription(answer);
            sendSignalingMessage({
              type: "answer",
              data: answer,
              from: userId,
              to: otherUserId,
            });
            console.log("Answer sent");
            break;

          case "answer":
            console.log("Received answer");
            await pc.setRemoteDescription(new RTCSessionDescription(message.data));
            break;

          case "ice-candidate":
            if (message.data && pc.remoteDescription) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(message.data));
                console.log("ICE candidate added");
              } catch (err) {
                console.warn("Failed to add ICE candidate:", err);
              }
            }
            break;

          case "call-end":
            console.log("Call ended by remote");
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
    [userId, otherUserId, sendSignalingMessage, callType]
  );

  // Start call (initiator)
  const startCall = useCallback(async () => {
    if (!enabled || !userId || !otherUserId) {
      setError("Kullanıcı bilgileri eksik");
      return;
    }
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

      // Setup signaling first
      const channel = setupSignaling();
      
      // Wait a bit for channel to be ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Create peer connection
      const pc = createPeerConnection();

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === "video",
      });
      await pc.setLocalDescription(offer);

      // Send offer via signaling
      sendSignalingMessage({
        type: "offer",
        data: offer,
        from: userId,
        to: otherUserId,
      });

      console.log("Call started, offer sent");
      // Note: isCallActive will be set to true when we receive the answer and remote stream
    } catch (error) {
      console.error("Error starting call:", error);
      setError("Arama başlatılamadı: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
      setIsConnecting(false);
      if (endCallRef.current) {
        endCallRef.current();
      }
    }
  }, [enabled, callType, userId, otherUserId, createPeerConnection, setupSignaling, sendSignalingMessage]);

  // Answer call (receiver)
  const answerCall = useCallback(async () => {
    if (!enabled || !userId || !otherUserId) {
      setError("Kullanıcı bilgileri eksik");
      return;
    }
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
        const channel = setupSignaling();
        // Wait a bit for channel to be ready
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Create peer connection
      const pc = createPeerConnection();

      // Add local tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      console.log("Call answered, waiting for offer");
      // Answer will be sent when offer is received via handleSignalingMessage
    } catch (error) {
      console.error("Error answering call:", error);
      setError("Arama cevaplanamadı: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
      setIsConnecting(false);
      if (endCallRef.current) {
        endCallRef.current();
      }
    }
  }, [enabled, callType, userId, otherUserId, createPeerConnection, setupSignaling]);

  // End call
  const endCall = useCallback(() => {
    console.log("Ending call, cleaning up...");
    
    // Send call-end signal to other user
    if (userId && otherUserId && signalingChannelRef.current) {
      try {
        sendSignalingMessage({
          type: "call-end",
          data: {},
          from: userId,
          to: otherUserId,
        });
      } catch (err) {
        console.warn("Failed to send call-end signal:", err);
      }
    }

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      setLocalStream(null);
    }

    // Stop remote stream
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      setRemoteStream(null);
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (err) {
        console.warn("Error closing peer connection:", err);
      }
      peerConnectionRef.current = null;
    }

    // Cleanup signaling channel
    if (signalingChannelRef.current) {
      try {
        supabase.removeChannel(signalingChannelRef.current);
      } catch (err) {
        console.warn("Error removing signaling channel:", err);
      }
      signalingChannelRef.current = null;
    }

    // Reset state
    setIsCallActive(false);
    setIsConnecting(false);
    setRemoteStream(null);
    setError(null);
    setIsMuted(false);
    setIsVideoOff(false);

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    onCallEnd?.();
    console.log("Call ended, cleanup complete");
  }, [localStream, remoteStream, userId, otherUserId, sendSignalingMessage, onCallEnd, supabase]);

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

  // Cleanup on unmount or when disabled
  useEffect(() => {
    if (!enabled || !userId || !otherUserId) {
      // Cleanup if disabled
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach((track) => track.stop());
        setRemoteStream(null);
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (signalingChannelRef.current) {
        supabase.removeChannel(signalingChannelRef.current);
        signalingChannelRef.current = null;
      }
      setIsCallActive(false);
      setIsConnecting(false);
      setError(null);
    }

    return () => {
      // Cleanup on unmount
      endCall();
    };
  }, [enabled, userId, otherUserId, endCall, localStream, remoteStream, supabase]);

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

