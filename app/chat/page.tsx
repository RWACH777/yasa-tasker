"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { setUserOnline, setUserOffline, getUserOnlineStatus } from "@/app/utils/presenceHelpers";
import RatingModal from "@/app/components/RatingModal";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  file_url?: string;
  voice_url?: string;
  reply_to_id?: string;
  created_at: string;
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const otherUserId = searchParams.get("user");
  const taskId = searchParams.get("task");

  const [user, setUser] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filePreview, setFilePreview] = useState<{ name: string; type: string; url: string } | null>(null);
  const [mediaView, setMediaView] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [longPressedMessageId, setLongPressedMessageId] = useState<string | null>(null);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageStartXRef = useRef<number>(0);

  // Debug logging
  useEffect(() => {
    console.log("🔍 Chat page loaded");
    console.log("👥 otherUserId from URL:", otherUserId);
  }, [otherUserId]);

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.session.user.id)
          .single();
        setUser(profile);
        // Set user as online
        await setUserOnline(data.session.user.id);
      } else {
        router.push("/dashboard");
      }
      setLoading(false);
    };
    loadUser();
  }, [router]);

  // Set user offline on unmount
  useEffect(() => {
    return () => {
      if (user?.id) {
        setUserOffline(user.id);
      }
    };
  }, [user?.id]);

  // Load other user info and check online status
  useEffect(() => {
    if (!otherUserId) {
      router.push("/messages");
      return;
    }

    const loadOtherUser = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", otherUserId)
        .single();
      setOtherUser(data);
      
      // Load other user's online status
      const status = await getUserOnlineStatus(otherUserId);
      setOtherUserOnline(status.is_online || false);
    };

    loadOtherUser();
  }, [otherUserId, router]);

  // Load messages
  useEffect(() => {
    if (!user?.id || !otherUserId) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });

      setMessages(data || []);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    };

    loadMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`chat:${user.id}:${otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `or(and(sender_id=eq.${user.id},receiver_id=eq.${otherUserId}),and(sender_id=eq.${otherUserId},receiver_id=eq.${user.id}))`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, otherUserId]);

  const sendMessage = async (fileUrl?: string, voiceUrl?: string) => {
    console.log("🚀 sendMessage called");
    console.log("📝 newMessage:", newMessage);
    console.log("📎 fileUrl:", fileUrl);
    console.log("🎙️ voiceUrl:", voiceUrl);
    console.log("👤 user?.id:", user?.id);
    console.log("👥 otherUserId:", otherUserId);
    
    if ((!newMessage.trim() && !fileUrl && !voiceUrl) || !user?.id || !otherUserId) {
      console.warn("⚠️ Cannot send: empty message and no file/voice, or missing user/otherUserId");
      console.warn("  - newMessage.trim():", newMessage.trim());
      console.warn("  - user?.id:", user?.id);
      console.warn("  - otherUserId:", otherUserId);
      return;
    }

    const messageData: any = {
      sender_id: user.id,
      receiver_id: otherUserId,
      text: newMessage || (fileUrl ? "[File shared]" : "[Voice message]"),
      created_at: new Date().toISOString(),
    };

    if (fileUrl) messageData.file_url = fileUrl;
    if (voiceUrl) messageData.voice_url = voiceUrl;
    if (replyingTo) messageData.reply_to_id = replyingTo.id;

    console.log("📤 Sending message:", messageData);
    console.log("👤 User ID:", user.id);
    console.log("👥 Other User ID:", otherUserId);
    
    const { error, data } = await supabase.from("messages").insert([messageData]).select();

    if (error) {
      console.error("❌ Error sending message:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Full error:", JSON.stringify(error));
      const errorMsg = `❌ Failed to send message: ${error.message} (Code: ${error.code})`;
      setError(errorMsg);
      alert(errorMsg);
    } else {
      console.log("✅ Message sent successfully:", data);
      setNewMessage("");
      setReplyingTo(null);
      // Manually add to state to ensure it appears
      if (data && data[0]) {
        console.log("📥 Adding message to state:", data[0]);
        setMessages((prev) => [...prev, data[0]]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !user?.id || !otherUserId) return;

    const file = files[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setFilePreview({
        name: file.name,
        type: file.type,
        url: e.target?.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const uploadAndSendFile = async () => {
    if (!filePreview || !user?.id || !otherUserId) return;

    setUploading(true);
    try {
      const file = new File([filePreview.url], filePreview.name, { type: filePreview.type });
      const fileName = `${user.id}/${otherUserId}/${Date.now()}_${filePreview.name}`;
      
      // Convert data URL to blob
      const response = await fetch(filePreview.url);
      const blob = await response.blob();
      
      const { error: uploadError } = await supabase.storage
        .from("message-files")
        .upload(fileName, blob);

      if (!uploadError) {
        const { data } = supabase.storage
          .from("message-files")
          .getPublicUrl(fileName);
        await sendMessage(data.publicUrl);
        setFilePreview(null);
      }
    } catch (err) {
      console.error("File upload error:", err);
    }
    setUploading(false);
  };

  const handleVoiceRecord = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
      return;
    }

    try {
      setIsRecording(true);
      setError(null);
      
      // Request microphone permission with better error handling
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });
      } catch (permErr: any) {
        console.error("Permission error:", permErr);
        setIsRecording(false);
        
        // Check if it's a permission denied error
        if (permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError") {
          setError("🎙️ Microphone permission denied.\n\n📱 Pi Browser:\n1. Try recording again - browser will ask for permission\n2. Click 'Allow' when prompted\n3. If no prompt appears, check if microphone is enabled on your device\n\n💻 Desktop: Check browser settings and refresh");
        } else if (permErr.name === "NotFoundError") {
          setError("🎙️ No microphone found. Please connect a microphone and refresh the page.");
        } else {
          setError(`🎙️ Microphone error: ${permErr.message}\n\nTry refreshing the page and recording again.`);
        }
        return;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const fileName = `${user.id}/${otherUserId}/voice_${Date.now()}.webm`;

          console.log("📤 Uploading voice message:", fileName);
          const { error: uploadError } = await supabase.storage
            .from("message-files")
            .upload(fileName, blob);

          if (uploadError) {
            console.error("Voice upload error:", uploadError);
            setError(`❌ Failed to upload voice message: ${uploadError.message}`);
          } else {
            const { data } = supabase.storage
              .from("message-files")
              .getPublicUrl(fileName);
            console.log("✅ Voice message uploaded:", data.publicUrl);
            await sendMessage(undefined, data.publicUrl);
            setError(null);
          }
        } catch (err) {
          console.error("Voice processing error:", err);
          setError(`❌ Error processing voice message: ${(err as any).message}`);
        } finally {
          stream.getTracks().forEach((track) => track.stop());
          setIsRecording(false);
        }
      };

      mediaRecorder.start();
      setError("🎙️ Recording... Click again to stop");
      
      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
          setError("✅ Recording stopped (60 second limit reached)");
        }
      }, 60000);
    } catch (err) {
      console.error("Voice recording error:", err);
      setError(`❌ Microphone error: ${(err as any).message}`);
      setIsRecording(false);
    }
  };

  const handleMessageMouseDown = (messageId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedMessageId(messageId);
    }, 500);
  };

  const handleMessageMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const deleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (!error) {
      setMessages(messages.filter((m) => m.id !== messageId));
      setSelectedMessageId(null);
    }
  };

  const submitRating = async (stars: number, comment: string) => {
    if (!user?.id || !otherUser?.id || !taskId) return;

    setRatingLoading(true);
    try {
      const { error } = await supabase.from("ratings").insert([
        {
          rater_id: user.id,
          ratee_id: otherUser.id,
          task_id: taskId,
          stars,
          comment: comment || null,
          created_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("Rating error:", error);
        setError("Failed to submit rating");
      } else {
        setHasRated(true);
        setShowRatingModal(false);
      }
    } catch (err) {
      console.error("Rating submission error:", err);
      setError("Error submitting rating");
    } finally {
      setRatingLoading(false);
    }
  };

  const handleMessageTouchStart = (e: React.TouchEvent, messageId: string, senderIsCurrentUser: boolean) => {
    messageStartXRef.current = e.touches[0].clientX;
  };

  const handleMessageTouchEnd = (e: React.TouchEvent, messageId: string, senderIsCurrentUser: boolean) => {
    const endX = e.changedTouches[0].clientX;
    const diff = messageStartXRef.current - endX;

    // Swipe left (diff > 50px) for own messages = reply
    // Swipe right (diff < -50px) for other messages = reply
    if (senderIsCurrentUser && diff > 50) {
      // Own message: swipe left to reply
      const msg = messages.find(m => m.id === messageId);
      if (msg) setReplyingTo(msg);
    } else if (!senderIsCurrentUser && diff < -50) {
      // Other's message: swipe right to reply
      const msg = messages.find(m => m.id === messageId);
      if (msg) setReplyingTo(msg);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000222] text-white flex items-center justify-center">
        <p>Loading chat...</p>
      </div>
    );
  }

  if (!user || !otherUser) {
    return (
      <div className="min-h-screen bg-[#000222] text-white flex items-center justify-center">
        <p>Chat not found. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#000222] text-white flex flex-col">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-600 p-3 text-sm text-red-200">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-100 font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header - FIXED */}
      <div className="sticky top-0 z-10 bg-white/10 backdrop-blur-lg border-b border-white/20 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img
              src={
                otherUser.avatar_url ||
                `https://api.dicebear.com/8.x/thumbs/svg?seed=${otherUser.username}`
              }
              alt={otherUser.username}
              className="w-10 h-10 rounded-full border border-white/30"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{otherUser.username}</h1>
                <span
                  className={`w-3 h-3 rounded-full ${
                    otherUserOnline ? "bg-blue-500" : "bg-gray-400"
                  }`}
                  title={otherUserOnline ? "Online" : "Offline"}
                />
              </div>
              <p className="text-xs text-gray-400">
                {otherUserOnline ? "Online" : "Offline"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {taskId && (
              <button
                onClick={() => setShowRatingModal(true)}
                disabled={hasRated}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={hasRated ? "You've already rated this task" : "Rate this task"}
              >
                {hasRated ? "✓ Rated" : "⭐ Rate"}
              </button>
            )}
            <button
              onClick={() => {
                if (confirm("Clear all messages in this chat?")) {
                  setMessages([]);
                }
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm"
              title="Clear chat history"
            >
              🗑️ Clear
            </button>
            <Link
              href="/messages"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
              title="Back to messages list"
            >
              ← Back
            </Link>
          </div>
        </div>
      </div>

      {/* Messages Area - SCROLLABLE */}
      <div className="flex-1 overflow-y-auto p-4 pointer-events-auto">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p style={{ wordBreak: 'break-word' }}>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender_id === user.id ? "justify-end" : "justify-start"
                }`}
                onTouchStart={(e) => handleMessageTouchStart(e, msg.id, msg.sender_id === user.id)}
                onTouchEnd={(e) => handleMessageTouchEnd(e, msg.id, msg.sender_id === user.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSelectedMessageId(msg.id);
                }}
              >
                <div
                  className={`relative max-w-xs lg:max-w-md px-4 py-2 rounded-lg transition ${
                    msg.sender_id === user.id
                      ? "bg-blue-600 text-white"
                      : "bg-white/10 border border-white/20 text-gray-100"
                  } ${selectedMessageId === msg.id ? "ring-2 ring-yellow-400" : ""}`}
                >
                  {selectedMessageId === msg.id && (
                    <div className="absolute -left-20 top-0 flex gap-2 bg-black/80 rounded-lg p-2 z-50">
                      {msg.sender_id === user.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMessage(msg.id);
                          }}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold whitespace-nowrap"
                          title="Delete message"
                        >
                          🗑️ Delete
                        </button>
                      )}
                    </div>
                  )}
                  {msg.reply_to_id && messages.find(m => m.id === msg.reply_to_id) && (
                    <div className="text-xs bg-white/20 rounded p-2 mb-2 border-l-2 border-blue-400 mb-2">
                      <p className="font-semibold text-blue-300">Replying to:</p>
                      <p className="text-gray-300 truncate">{messages.find(m => m.id === msg.reply_to_id)?.text}</p>
                    </div>
                  )}
                  {replyingTo?.id === msg.id && (
                    <div className="text-xs bg-white/10 rounded p-1 mb-2 border-l-2 border-yellow-400">
                      <p className="font-semibold text-yellow-300">Replying to:</p>
                      <p className="text-gray-300 truncate">{replyingTo.text}</p>
                    </div>
                  )}
                  <p className="text-sm break-words">{msg.text}</p>
                  {msg.file_url && (
                    <button
                      onClick={() => setMediaView({ url: msg.file_url!, type: msg.file_url!.includes('.pdf') ? 'application/pdf' : 'file' })}
                      className={`text-xs mt-2 block break-all text-left ${
                        msg.sender_id === user.id ? "text-blue-100 hover:text-white" : "text-blue-300 hover:text-blue-200"
                      }`}
                    >
                      📎 View File
                    </button>
                  )}
                  {msg.voice_url && (
                    <audio
                      controls
                      className="w-full mt-2 h-6"
                      src={msg.voice_url}
                    />
                  )}
                  <p className={`text-xs mt-1 ${
                    msg.sender_id === user.id ? "text-blue-100" : "text-gray-400"
                  }`}>
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* File Preview */}
      {filePreview && (
        <div className="bg-white/5 border-t border-white/20 p-4 w-full">
          <div className="w-full px-4 flex items-center gap-3">
            {filePreview.type.startsWith("image/") ? (
              <img src={filePreview.url} alt="preview" className="w-16 h-16 object-cover rounded" />
            ) : (
              <div className="w-16 h-16 bg-white/10 rounded flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{filePreview.name}</p>
              <p className="text-xs text-gray-400">{filePreview.type}</p>
            </div>
            <button
              onClick={() => setFilePreview(null)}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
              title="Back to chat"
            >
              ← Back
            </button>
            <button
              onClick={uploadAndSendFile}
              disabled={uploading}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
            >
              ✓ Send
            </button>
          </div>
        </div>
      )}

      {/* Input Area - FIXED */}
      <div className="sticky bottom-0 z-10 bg-white/10 backdrop-blur-lg border-t border-white/20 p-3 w-full">
        {/* Reply Context */}
        {replyingTo && (
          <div className="mb-2 bg-blue-600/30 border-l-4 border-blue-500 rounded p-2 flex justify-between items-center">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-300">Replying to:</p>
              <p className="text-sm text-gray-200 truncate">{replyingTo.text}</p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="ml-2 px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-semibold"
              title="Cancel reply"
            >
              ✕
            </button>
          </div>
        )}
        <div className="w-full px-4 flex gap-2 items-flex-end">
          {/* Left: Textbox */}
          <div className="flex-1 flex flex-col gap-2">
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              autoFocus
              autoComplete="off"
              disabled={false}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 caret-white pointer-events-auto"
            />
            {/* Attach button below textbox */}
            <label className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition cursor-pointer text-sm flex items-center gap-2 w-fit" title="Upload files">
              📎
              <input
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                className="hidden"
                disabled={uploading}
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              Attach
            </label>
          </div>

          {/* Right: Send button (Telegram icon only) */}
          <button
            onClick={() => sendMessage()}
            disabled={uploading || !newMessage.trim()}
            className="px-3 py-2 rounded-lg transition flex items-center justify-center h-10 w-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Send message"
          >
            {/* Telegram send icon */}
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.9429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16346272 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99701575 L3.03521743,10.4380088 C3.03521743,10.5951061 3.34915502,10.7522035 3.50612381,10.7522035 L16.6915026,11.5376905 C16.6915026,11.5376905 17.1624089,11.5376905 17.1624089,12.0089827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Fullscreen Media View */}
      {mediaView && (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4">
          <div className="w-full h-full flex flex-col items-center justify-center">
            <button
              onClick={() => setMediaView(null)}
              className="absolute top-4 left-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
              title="Back to chat"
            >
              ← Back
            </button>
            {mediaView.type === 'application/pdf' ? (
              <iframe
                src={mediaView.url}
                className="w-full h-full"
                title="PDF Viewer"
              />
            ) : (
              <img
                src={mediaView.url}
                alt="Media"
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </div>
      )}

      {/* Rating Modal */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onSubmit={submitRating}
        otherUserName={otherUser?.username || "User"}
        loading={ratingLoading}
      />
    </div>
  );
}
