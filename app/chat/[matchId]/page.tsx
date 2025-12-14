"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft, Loader2, Image as ImageIcon, Phone, Video, Bell, ShieldX, Mic, MicOff, VideoIcon, VideoOff, X } from "lucide-react";
import Link from "next/link";
import { useWebRTC } from "@/lib/hooks/useWebRTC";
import { CallModal } from "@/components/call/CallModal";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read: boolean;
  message_type?: "text" | "image" | "video";
  media_url?: string | null;
  media_meta?: any;
}

type CallType = "voice" | "video";
interface CallRequest {
  id: string;
  match_id: string;
  requester_id: string;
  type: CallType;
  status: "pending" | "accepted" | "rejected" | "expired";
  created_at: string;
}

interface MatchUser {
  id: string;
  username: string;
  avatar_url: string | null;
  riot_id: string | null;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [matchUser, setMatchUser] = useState<MatchUser | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [iAmBlocker, setIAmBlocker] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState<CallRequest | null>(null);
  const [pendingOutgoingRequest, setPendingOutgoingRequest] = useState<CallRequest | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [requestingType, setRequestingType] = useState<CallType | null>(null);
  const [activeCallType, setActiveCallType] = useState<CallType | null>(null);
  const [isInitiator, setIsInitiator] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseClient();
  const { user, loading: authLoading } = useAuthStore();

  // WebRTC hook
  const otherUserId = matchUser?.id || "";
  const webrtc = useWebRTC({
    matchId,
    userId: user?.id || "",
    otherUserId,
    callType: activeCallType || "voice",
    onCallEnd: () => {
      setActiveCallType(null);
      setIsInitiator(false);
    },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadChat();
    
    const unsubscribe = subscribeToMessages();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, user, authLoading]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Gelen çağrıda basit uyarı (titreşim + ses)
  useEffect(() => {
    if (!incomingRequest) return;
    try {
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
      const audio = new Audio("/call-notify.mp3");
      audio.play().catch(() => {});
    } catch {
      // sessiz geç
    }
  }, [incomingRequest]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const refreshCalls = async () => {
    if (!matchId || !user) return;
    const { data: calls } = await supabase
      .from("call_requests")
      .select("*")
      .eq("match_id", matchId)
      .in("status", ["pending", "accepted"]);
    const pendingIncoming = calls?.find((c) => c.status === "pending" && c.requester_id !== user.id) || null;
    const pendingOutgoing = calls?.find((c) => c.status === "pending" && c.requester_id === user.id) || null;
    setIncomingRequest(pendingIncoming);
    setPendingOutgoingRequest(pendingOutgoing || null);
    console.log("refreshCalls", { pendingIncoming, pendingOutgoing });
  };

  const fetchCalls = async () => {
    if (!matchId) return;
    try {
      const res = await fetch("/api/matches/call-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", matchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Çağrı istekleri alınamadı");
      const calls = data.calls || [];
      const pendingIncoming = calls.find((c: CallRequest) => c.status === "pending" && c.requester_id !== user?.id) || null;
      const pendingOutgoing = calls.find((c: CallRequest) => c.status === "pending" && c.requester_id === user?.id) || null;
      setIncomingRequest(pendingIncoming);
      setPendingOutgoingRequest(pendingOutgoing);
      console.log("refreshCalls", { pendingIncoming, pendingOutgoing });
    } catch (error) {
      console.error("fetchCalls error:", error);
    }
  };

  const loadChat = async () => {
    if (!user || !matchId) return;

    setLoading(true);
    try {
      // Get match info
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (matchError) throw matchError;

      // Get other user profile
      const otherUserId = matchData.user_id_1 === user.id ? matchData.user_id_2 : matchData.user_id_1;
      
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, riot_id")
        .eq("id", otherUserId)
        .single();

      if (profileError) throw profileError;
      setMatchUser(profile);

      // Load messages (cleanup old messages in background, don't block UI)
      // Note: Consider moving cleanup to a scheduled job instead of doing it on every page load
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;
      setMessages(messagesData || []);

      // Load call blocks
      const { data: blocks } = await supabase
        .from("call_blocks")
        .select("*")
        .eq("match_id", matchId);
      setBlockedByOther(!!blocks?.find((b) => b.blocked_user_id === user.id && b.blocked));
      setIAmBlocker(!!blocks?.find((b) => b.blocker_id === user.id && b.blocked));

      await refreshCalls();

      // Mark messages as read
      await supabase
        .from("messages")
        .update({ read: true })
        .eq("match_id", matchId)
        .neq("sender_id", user.id)
        .eq("read", false);

      await fetchCalls();
    } catch (error) {
      console.error("Error loading chat:", error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!matchId || !user) return () => {};

    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages((prev) => {
            // Check if message already exists to prevent duplicates
            if (prev.some((m) => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
          
              // Mark as read if it's not from current user
              if (newMessage.sender_id !== user.id) {
                supabase
                  .from("messages")
                  .update({ read: true })
                  .eq("id", newMessage.id)
                  .then(({ error }) => {
                    if (error) console.error("Error marking message as read:", error);
                  });
              }
        }
      )
      .subscribe();

    // Call request subscription
    const callChannel = supabase
      .channel(`call:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_requests",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const newReq = payload.new as CallRequest;
          console.log("realtime call_request event", payload.eventType, newReq);
          if (newReq.status === "pending" && newReq.requester_id !== user.id) {
            setIncomingRequest(newReq);
          }
          if (newReq.status === "pending" && newReq.requester_id === user.id) {
            setPendingOutgoingRequest(newReq);
          }
          if (newReq.status === "accepted" && newReq.requester_id === user.id) {
            // Arama kabul edildi, WebRTC başlat
            setActiveCallType(newReq.type);
            setIsInitiator(true);
            setRequestingType(null);
            setPendingOutgoingRequest(null);
            setTimeout(() => {
              webrtc.startCall();
            }, 100);
          }
          if (newReq.status === "rejected" && newReq.requester_id === user.id) {
            alert("Arama isteğin reddedildi.");
            setRequestingType(null);
            setPendingOutgoingRequest(null);
          }
          if (newReq.status !== "pending" && newReq.requester_id !== user.id) {
            setIncomingRequest(null);
          }
          fetchCalls(); // sync after any change
        }
      )
      .subscribe();

    // Block subscription
    const blockChannel = supabase
      .channel(`call-blocks:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_blocks",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const b: any = payload.new;
          console.log("realtime call_block event", payload.eventType, b);
          if (!b) return;
          if (b.blocked_user_id === user.id) {
            setBlockedByOther(!!b.blocked);
          }
          if (b.blocker_id === user.id) {
            setIAmBlocker(!!b.blocked);
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
        supabase.removeChannel(callChannel);
        supabase.removeChannel(blockChannel);
      } catch (error) {
        // Channel already removed or doesn't exist
        console.error("Error removing channel:", error);
      }
    };
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !user || !matchId || sending || uploading) return;

    setSending(true);
    try {
      const bucket = process.env.NEXT_PUBLIC_CHAT_BUCKET || "chat-media";
      let mediaUrl: string | null = null;
      let messageType: "text" | "image" | "video" = "text";

      if (selectedFile) {
        setUploading(true);
        const path = `${matchId}/${Date.now()}_${selectedFile.name}`;
        const uploadRes = await supabase.storage.from(bucket).upload(path, selectedFile, {
          upsert: true,
        });
        if (uploadRes.error) {
          alert(
            uploadRes.error.message.includes("bucket")
              ? `${bucket} bucket'ı oluşturulmalı ve public olmalı. (NEXT_PUBLIC_CHAT_BUCKET ile isim verebilirsin.)`
              : `Medya yüklenemedi: ${uploadRes.error.message}`
          );
          throw uploadRes.error;
        }
        const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(path);
        mediaUrl = publicUrl.publicUrl;
        if (selectedFile.type.startsWith("image")) messageType = "image";
        else if (selectedFile.type.startsWith("video")) messageType = "video";
      }

      const payload = {
        match_id: matchId,
        sender_id: user.id,
        content: newMessage.trim() || (mediaUrl ? "" : ""),
        message_type: messageType,
        media_url: mediaUrl,
      };

      const { data, error } = await supabase.from("messages").insert(payload).select().single();

      if (error) throw error;

      setNewMessage("");
      setSelectedFile(null);
      setMessages((prev) => [...prev, data]);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image") && !file.type.startsWith("video")) {
      alert("Sadece fotoğraf veya video yükleyebilirsin.");
      return;
    }
    if (file.type.startsWith("video") && file.size > 100 * 1024 * 1024) {
      alert("Video 100MB'den küçük olmalı.");
      return;
    }
    // Foto için limit yok (yine de büyük dosyalar yüklenebilir)
    setSelectedFile(file);
  };

  const canCallVoice = !blockedByOther && !pendingOutgoingRequest;
  const canCallVideo = !blockedByOther && !pendingOutgoingRequest;

  const requestCall = async (type: CallType) => {
    if (!matchId) return;
    setRequestingType(type);
    try {
      const res = await fetch("/api/matches/call-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, type, action: "create" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBlockedMessage(data.error || "İstek gönderilemedi");
        throw new Error(data.error || "İstek gönderilemedi");
      }
      // Optimistic pending set; realtime gelmezse bile butonlar güncellensin
      if (data?.request) {
        setPendingOutgoingRequest(data.request);
      }
      await fetchCalls(); // realtime gelmezse anlık güncelle
      console.log("call-request create ok", data);
      alert("Arama isteği gönderildi. Karşı taraf kabul ederse arama başlayacak (WebRTC kurulacak).");
    } catch (error) {
      console.error("Call request error:", error);
      alert(error instanceof Error ? error.message : "İstek gönderilemedi");
      setRequestingType(null);
    }
  };

  const unblockCalls = async () => {
    if (!matchId) return;
    try {
      const res = await fetch("/api/matches/call-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unblock", matchId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Engel kaldırılamadı");
      }
      setIAmBlocker(false);
      setBlockedByOther(false);
      setBlockedMessage(null);
    } catch (error) {
      console.error("Unblock error:", error);
      alert(error instanceof Error ? error.message : "Engel kaldırılamadı");
    }
  };

  const respondCall = async (req: CallRequest, accept: boolean) => {
    try {
      const res = await fetch("/api/matches/call-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "respond",
          requestId: req?.id,
          matchId,
          status: accept ? "accepted" : "rejected",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Yanıt gönderilemedi");
      }
      if (accept) {
        // Arama kabul edildi, WebRTC başlat (receiver olarak)
        setActiveCallType(req.type);
        setIsInitiator(false);
        setPendingOutgoingRequest(null);
        setTimeout(() => {
          webrtc.answerCall();
        }, 100);
      }
      setIncomingRequest(null);
    } catch (error) {
      console.error("Call respond error:", error);
      alert(error instanceof Error ? error.message : "Yanıt gönderilemedi");
    }
  };

  const renderMessageContent = (message: Message) => {
    const type = message.message_type || "text";
    if ((type === "image" || type === "video") && message.media_url) {
      if (type === "image") {
        return (
          <div className="space-y-1">
            <Image
              src={message.media_url}
              alt="media"
              width={320}
              height={240}
              className="rounded-lg max-h-64 w-auto object-cover"
            />
            {message.content && <p className="text-sm">{message.content}</p>}
          </div>
        );
      }
      return (
        <div className="space-y-1">
          <video
            className="rounded-lg max-h-64 w-full"
            src={message.media_url}
            controls
          />
          {message.content && <p className="text-sm">{message.content}</p>}
        </div>
      );
    }
    return <p className="text-sm break-words">{message.content}</p>;
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-neon-purple" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Oturum bulunamadı. Lütfen tekrar giriş yap.</p>
          <Button asChild variant="outline">
            <Link href="/auth/login">Giriş Yap</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (!matchUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Eşleşme bulunamadı</p>
          <Button asChild variant="outline">
            <Link href="/matches">Eşleşmelere Dön</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/matches">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-purple to-neon-green flex items-center justify-center text-sm font-bold border-2 border-neon-purple overflow-hidden">
              {matchUser.avatar_url ? (
                <Image
                  src={matchUser.avatar_url}
                  alt={matchUser.username}
                  width={40}
                  height={40}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span>{matchUser.username.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h1 className="font-bold font-gaming text-neon-purple">{matchUser.username}</h1>
              {matchUser.riot_id && (
                <p className="text-xs text-muted-foreground">#{matchUser.riot_id}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={canCallVoice ? "neon" : "outline"}
              size="sm"
              disabled={!canCallVoice || requestingType === "voice"}
              onClick={() => requestCall("voice")}
            >
              <Phone className="w-4 h-4 mr-1" />
              Sesli
            </Button>
            <Button
              variant={canCallVideo ? "neon" : "outline"}
              size="sm"
              disabled={!canCallVideo || requestingType === "video"}
              onClick={() => requestCall("video")}
            >
              <Video className="w-4 h-4 mr-1" />
              Video
            </Button>
          </div>
          {blockedByOther && (
            <div className="flex items-center gap-2 text-xs text-destructive">
              <ShieldX className="w-4 h-4" />
              <span>Karşı taraf aramaları engelledi.</span>
            </div>
          )}
          {pendingOutgoingRequest && (
            <div className="text-xs text-muted-foreground">
              Beklemede: {pendingOutgoingRequest.type === "voice" ? "Sesli" : "Video"} istek gönderildi.
            </div>
          )}
          {iAmBlocker && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={unblockCalls}>
                Engeli Kaldır
              </Button>
            </div>
          )}
        </div>
        {blockedMessage && (
          <div className="max-w-4xl mx-auto mt-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {blockedMessage}
          </div>
        )}
        {incomingRequest && (
          <div className="max-w-4xl mx-auto mt-3 p-3 rounded-lg border border-neon-green/30 bg-neon-green/5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Bell className="w-4 h-4 text-neon-green" />
              <span>
                {incomingRequest.type === "voice" ? "Sesli" : "Görüntülü"} arama isteği aldı{" "}
                (karşı taraf: {matchUser.username})
              </span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="neon" onClick={() => respondCall(incomingRequest, true)}>
                Kabul
              </Button>
              <Button size="sm" variant="outline" onClick={() => respondCall(incomingRequest, false)}>
                Reddet
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <p>Henüz mesaj yok. İlk mesajı sen gönder! 🎮</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOwn = message.sender_id === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      isOwn
                        ? "bg-neon-purple text-white"
                        : "bg-muted text-foreground"
                    } space-y-1`}
                  >
                    {renderMessageContent(message)}
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(message.created_at).toLocaleTimeString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-sm border-t border-border p-4">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-input cursor-pointer hover:border-neon-purple/60">
              <ImageIcon className="w-4 h-4" />
              <span className="text-sm">Foto/Video</span>
              <input type="file" className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
            </label>
            {selectedFile && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                {selectedFile.name}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Mesaj yaz..."
              className="flex-1 px-4 py-2 rounded-lg bg-input border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-neon-purple"
              disabled={sending || uploading}
            />
            <Button type="submit" variant="neon" disabled={sending || uploading || (!newMessage.trim() && !selectedFile)}>
              {sending || uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* WebRTC Call Modal (Teams/Discord style popup) */}
      <CallModal
        isOpen={(webrtc.isCallActive || webrtc.isConnecting) && !!activeCallType && !!matchUser}
        onClose={() => {
          webrtc.endCall();
          setActiveCallType(null);
        }}
        callType={activeCallType || "voice"}
        isConnecting={webrtc.isConnecting}
        isCallActive={webrtc.isCallActive}
        isMuted={webrtc.isMuted}
        isVideoOff={webrtc.isVideoOff}
        localStream={webrtc.localStream}
        remoteStream={webrtc.remoteStream}
        localVideoRef={webrtc.localVideoRef}
        remoteVideoRef={webrtc.remoteVideoRef}
        onToggleMute={webrtc.toggleMute}
        onToggleVideo={webrtc.toggleVideo}
        onEndCall={() => {
          webrtc.endCall();
          setActiveCallType(null);
        }}
        otherUserName={matchUser?.username || "Kullanıcı"}
        otherUserAvatar={matchUser?.avatar_url || null}
        error={webrtc.error}
      />
    </div>
  );
}

