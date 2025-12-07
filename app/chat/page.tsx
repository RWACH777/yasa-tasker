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
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [taskPosterId, setTaskPosterId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageStartXRef = useRef<number>(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);


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
    if (!otherUserId || !user?.id) {
      return;
    }

    const loadOtherUser = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", otherUserId)
          .single();
        
        if (error) {
          console.error("Error loading other user profile:", error);
          return;
        }
        
        setOtherUser(data);
        
        // Load other user's online status
        const status = await getUserOnlineStatus(otherUserId);
        setOtherUserOnline(status.is_online || false);
      } catch (err) {
        console.error("Error loading other user:", err);
      }
    };

    loadOtherUser();

    // Poll for online status changes every 1 second for real-time feel
    const pollInterval = setInterval(async () => {
      const status = await getUserOnlineStatus(otherUserId);
      setOtherUserOnline(status.is_online || false);
    }, 1000);

    // Also subscribe to presence changes
    const presenceChannel = supabase
      .channel(`presence:${otherUserId}`)
      .on('presence', { event: 'sync' }, () => {
        getUserOnlineStatus(otherUserId).then((status) => {
          setOtherUserOnline(status.is_online || false);
        });
      })
      .on('presence', { event: 'join' }, () => {
        setOtherUserOnline(true);
      })
      .on('presence', { event: 'leave' }, () => {
        setOtherUserOnline(false);
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      presenceChannel.unsubscribe();
    };
  }, [otherUserId, user?.id]);

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

      // Filter out messages that were cleared by current user
      const filteredMessages = (data || []).filter(
        (msg) => msg.cleared_by_user_id !== user.id
      );

      setMessages(filteredMessages);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 0);
    };

    loadMessages();

    // Mark all unread messages from other user as read
    const markMessagesAsRead = async () => {
      try {
        // Update messages where read is false OR null/undefined (unread)
        const { error } = await supabase
          .from("messages")
          .update({ read: true })
          .eq("sender_id", otherUserId)
          .eq("receiver_id", user.id)
          .or("read.eq.false,read.is.null");

        if (error) {
          console.error("Error marking messages as read:", error.message || error);
        } else {
          console.log("✅ Messages marked as read");
        }
      } catch (err) {
        console.error("Exception marking messages as read:", err);
      }
    };

    markMessagesAsRead();

    // Subscribe to new messages and updates
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
          console.log("New message received:", payload.new);
          // Only add if not cleared by current user
          if (payload.new.cleared_by_user_id !== user.id) {
            setMessages((prev) => [...prev, payload.new as Message]);
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 0);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `or(and(sender_id=eq.${user.id},receiver_id=eq.${otherUserId}),and(sender_id=eq.${otherUserId},receiver_id=eq.${user.id}))`,
        },
        (payload) => {
          console.log("Message updated:", payload.new);
          // If message was cleared by current user, remove it
          if (payload.new.cleared_by_user_id === user.id) {
            setMessages((prev) => prev.filter((m) => m.id !== payload.new.id));
          } else {
            // Otherwise update the message (e.g., read status)
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? (payload.new as Message) : m))
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `or(and(sender_id=eq.${user.id},receiver_id=eq.${otherUserId}),and(sender_id=eq.${otherUserId},receiver_id=eq.${user.id}))`,
        },
        (payload) => {
          console.log("Message deleted:", payload.old);
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, otherUserId]);

  // Load task status
  useEffect(() => {
    if (!taskId || !user?.id) return;

    const loadTaskStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("status, poster_id")
          .eq("id", taskId)
          .single();

        if (error) {
          console.error("Error loading task status:", error);
          return;
        }

        if (data) {
          console.log("Task loaded:", { status: data.status, poster_id: data.poster_id, current_user: user?.id });
          setTaskStatus(data.status);
          setTaskPosterId(data.poster_id);
        }
      } catch (err) {
        console.error("Exception loading task status:", err);
      }
    };

    console.log("Loading task status for taskId:", taskId);
    loadTaskStatus();

    // Subscribe to task status changes
    const subscription = supabase
      .channel(`task:${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `id=eq.${taskId}`,
        },
        (payload) => {
          console.log("Task updated:", payload.new);
          setTaskStatus(payload.new.status);
          setTaskPosterId(payload.new.poster_id);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [taskId, user?.id]);

  const sendMessage = async (fileUrl?: string, voiceUrl?: string) => {
    if ((!newMessage.trim() && !fileUrl && !voiceUrl) || !user?.id || !otherUserId) {
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

    // Optimistic update - add message to UI immediately
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      ...messageData,
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");
    setReplyingTo(null);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    // Send to database
    const { error, data } = await supabase.from("messages").insert([messageData]).select();

    if (error) {
      const errorMsg = `❌ Failed to send message: ${error.message}`;
      setError(errorMsg);
      alert(errorMsg);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
    } else if (data && data[0]) {
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMessage.id ? data[0] : m))
      );
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
      } else {
        setError(`❌ File upload failed: ${uploadError.message}`);
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

          const { error: uploadError } = await supabase.storage
            .from("message-files")
            .upload(fileName, blob);

          if (uploadError) {
            setError(`❌ Failed to upload voice message: ${uploadError.message}`);
          } else {
            const { data } = supabase.storage
              .from("message-files")
              .getPublicUrl(fileName);
            await sendMessage(undefined, data.publicUrl);
            setError(null);
          }
        } catch (err) {
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
    } else {
      setError(`❌ Failed to delete message: ${error.message}`);
    }
  };

  const submitRating = async (stars: number, comment: string) => {
    if (!user?.id || !otherUser?.id || !taskId) return;

    setRatingLoading(true);
    try {
      // Insert rating
      const { error: ratingError } = await supabase.from("ratings").insert([
        {
          rater_id: user.id,
          rated_user_id: otherUser.id,
          rating: stars,
          comment: comment || null,
          created_at: new Date().toISOString(),
        },
      ]);

      if (ratingError) {
        console.error("❌ Rating error:", ratingError);
        setError("Failed to submit rating");
        setRatingLoading(false);
        return;
      }

      console.log("✅ Rating submitted successfully");

      // Get all ratings for the rated user to calculate average
      const { data: allRatings, error: ratingsError } = await supabase
        .from("ratings")
        .select("rating")
        .eq("rated_user_id", otherUser.id);

      if (!ratingsError && allRatings && allRatings.length > 0) {
        try {
          const average = (
            allRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / allRatings.length
          ).toFixed(2);

          await supabase
            .from("profiles")
            .update({
              average_rating: parseFloat(average),
              total_ratings: allRatings.length,
            })
            .eq("id", otherUser.id);
        } catch (updateErr) {
          // Silently fail - rating was submitted successfully
        }
      }

      if (taskId) {
        try {
          const { data: taskData } = await supabase
            .from("tasks")
            .select("poster_id")
            .eq("id", taskId)
            .single();

          if (taskData) {
            const isCurrentUserTasker = user.id === taskData.poster_id;
            await supabase
              .from("tasks")
              .update(
                isCurrentUserTasker
                  ? { tasker_rated: true }
                  : { freelancer_rated: true }
              )
              .eq("id", taskId);
          }
        } catch (taskErr) {
          // Silently fail - rating was submitted successfully
        }
      }

      setHasRated(true);
      setShowRatingModal(false);
    } catch (err) {
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

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#000222] text-white flex items-center justify-center">
        <p>Loading chat...</p>
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
            {otherUser ? (
              <>
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
              </>
            ) : (
              <div className="text-gray-400">Loading user...</div>
            )}
          </div>
          <div className="flex gap-1 md:gap-2">
            {/* Debug: Show button if taskId exists (for testing) */}
            {taskId && !taskStatus && (
              <button
                onClick={async () => {
                  const { data } = await supabase
                    .from("tasks")
                    .select("status, poster_id")
                    .eq("id", taskId)
                    .single();
                  if (data) {
                    setTaskStatus(data.status);
                    setTaskPosterId(data.poster_id);
                  }
                }}
                className="px-2 md:px-4 py-1 md:py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition text-xs md:text-sm"
                title="Reload task status"
              >
                🔄 Reload
              </button>
            )}
            {taskId && taskStatus === "active" && user?.id === taskPosterId && (
              <button
                onClick={async () => {
                  const { error } = await supabase
                    .from("tasks")
                    .update({ status: "completed" })
                    .eq("id", taskId);
                  if (!error) {
                    setTaskStatus("completed");
                    alert("✅ Task marked as completed! Rating is now available.");
                  } else {
                    alert(`❌ Failed to complete task: ${error.message}`);
                  }
                }}
                className="px-2 md:px-4 py-1 md:py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition text-xs md:text-sm"
                title="Mark this task as completed"
              >
                ✓ Complete
              </button>
            )}
            {taskId && taskStatus === "completed" && (
              <button
                onClick={() => setShowRatingModal(true)}
                disabled={hasRated}
                className="px-2 md:px-4 py-1 md:py-2 bg-green-600 hover:bg-green-700 rounded-lg transition text-xs md:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title={hasRated ? "You've already rated this task" : "Rate this task"}
              >
                {hasRated ? "✓" : "⭐"}
              </button>
            )}
            <button
              onClick={async () => {
                if (confirm("Clear all messages in this chat? (Only clears for you)")) {
                  try {
                    // Mark all messages in this chat as cleared by current user
                    const { error } = await supabase
                      .from("messages")
                      .update({ cleared_by_user_id: user.id })
                      .or(
                        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
                      );
                    
                    if (error) {
                      console.error("Error clearing chat:", error);
                      alert("❌ Failed to clear chat");
                      return;
                    }
                    
                    setMessages([]);
                    alert("✅ Chat cleared successfully (only for you)");
                  } catch (err) {
                    console.error("Exception clearing chat:", err);
                    alert("❌ Error clearing chat");
                  }
                }
              }}
              className="px-3 md:px-5 py-2 md:py-2.5 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm md:text-base"
              title="Clear chat history"
            >
              🗑️
            </button>
            <Link
              href="/messages"
              className="px-3 md:px-5 py-2 md:py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm md:text-base"
              title="Back to messages list"
            >
              ←
            </Link>
          </div>
        </div>
      </div>

      {/* Messages Area - SCROLLABLE */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 pointer-events-auto"
        onScroll={() => {
          // Track if user is scrolling up (not at bottom)
          if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            isUserScrollingRef.current = scrollHeight - scrollTop - clientHeight > 50;
          }
        }}
      >
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
          <div className="flex-1 flex flex-col gap-2 relative z-20">
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
              disabled={!otherUser}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 caret-white pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed"
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
