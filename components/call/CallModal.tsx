"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, VideoIcon, VideoOff, PhoneOff, X } from "lucide-react";
import Image from "next/image";

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callType: "voice" | "video";
  isConnecting: boolean;
  isCallActive: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  localVideoRef: React.RefObject<HTMLVideoElement>;
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
  otherUserName: string;
  otherUserAvatar: string | null;
  error: string | null;
}

export function CallModal({
  isOpen,
  onClose,
  callType,
  isConnecting,
  isCallActive,
  isMuted,
  isVideoOff,
  localStream,
  remoteStream,
  localVideoRef,
  remoteVideoRef,
  onToggleMute,
  onToggleVideo,
  onEndCall,
  otherUserName,
  otherUserAvatar,
  error,
}: CallModalProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  // Auto-play remote audio (for voice calls or video calls with audio)
  useEffect(() => {
    if (remoteStream && audioRef.current) {
      // Get audio tracks from remote stream
      const audioTracks = remoteStream.getAudioTracks();
      if (audioTracks.length > 0) {
        // Create new stream with only audio
        const audioStream = new MediaStream(audioTracks);
        audioRef.current.srcObject = audioStream;
        audioRef.current.play().catch((err) => {
          console.warn("Audio play failed:", err);
        });
      }
    }
  }, [remoteStream]);

  if (!isOpen) return null;

  const handleEndCall = () => {
    onEndCall();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center">
      {/* Close button (top right) */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full"
        onClick={handleEndCall}
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Remote Video/Audio */}
      <div className="w-full h-full flex flex-col items-center justify-center relative">
        {callType === "video" ? (
          <>
            {/* Remote Video (fullscreen) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
              muted={false}
            />

            {/* Local Video (picture-in-picture - bottom right) */}
            {localStream && (
              <div className="absolute bottom-24 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-neon-green shadow-2xl">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Fallback avatar if no video */}
            {!remoteStream && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full bg-gradient-to-br from-neon-purple to-neon-green flex items-center justify-center border-4 border-white">
                  {otherUserAvatar ? (
                    <Image
                      src={otherUserAvatar}
                      alt={otherUserName}
                      width={192}
                      height={192}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-6xl font-bold text-white">
                      {otherUserName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Voice call - show avatar */
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-neon-purple to-neon-green flex items-center justify-center border-4 border-white shadow-2xl">
              {otherUserAvatar ? (
                <Image
                  src={otherUserAvatar}
                  alt={otherUserName}
                  width={192}
                  height={192}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-6xl font-bold text-white">
                  {otherUserName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">{otherUserName}</h2>
              <p className="text-white/70">
                {isConnecting ? "Bağlanıyor..." : isCallActive ? "Arama aktif" : "Bekleniyor..."}
              </p>
            </div>
          </div>
        )}

        {/* Hidden audio element for remote audio */}
        <audio ref={audioRef} autoPlay playsInline />

        {/* Call Controls (bottom center) */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex items-center gap-4">
          {/* Mute Toggle */}
          <Button
            size="lg"
            variant={isMuted ? "destructive" : "outline"}
            className="rounded-full w-14 h-14 border-2 border-white/30 bg-black/50 hover:bg-black/70 text-white"
            onClick={onToggleMute}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </Button>

          {/* Video Toggle (only for video calls) */}
          {callType === "video" && (
            <Button
              size="lg"
              variant={isVideoOff ? "destructive" : "outline"}
              className="rounded-full w-14 h-14 border-2 border-white/30 bg-black/50 hover:bg-black/70 text-white"
              onClick={onToggleVideo}
            >
              {isVideoOff ? <VideoOff className="w-6 h-6" /> : <VideoIcon className="w-6 h-6" />}
            </Button>
          )}

          {/* End Call */}
          <Button
            size="lg"
            variant="destructive"
            className="rounded-full w-16 h-16 bg-red-600 hover:bg-red-700 border-2 border-white/30"
            onClick={handleEndCall}
          >
            <PhoneOff className="w-7 h-7" />
          </Button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-4 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Connecting Indicator */}
        {isConnecting && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-blue-500/90 text-white px-4 py-2 rounded-lg text-sm">
            Bağlanıyor...
          </div>
        )}
      </div>
    </div>
  );
}

