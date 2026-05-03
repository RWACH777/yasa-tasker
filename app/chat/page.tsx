"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { setUserOnline, setUserOffline, getUserOnlineStatus } from "@/app/utils/presenceHelpers";
import RatingModal from "@/app/components/RatingModal";

interface Message {
  id: string;
  task_id?: string;
  sender_id: string;
  receiver_id: string;
  content?: string;
  text?: string;
  file_url?: string;
  voice_url?: string;
  reply_to_id?: string;
  created_at: string;
  sender?: {
    id: string;
    username: string;
    freelancer_username?: string;
    avatar_url?: string;
  };
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
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [taskPosterId, setTaskPosterId] = useState<string | null>(null);
  const [task, setTask] = useState<any>(null);
  const [hasRatedThisTask, setHasRatedThisTask] = useState(false);
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
          .select("id, username, freelancer_username, avatar_url, rating, completed_tasks, average_rating")
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

    // Subscribe to presence changes using postgres_changes for real-time updates
    const presenceChannel = supabase
      .channel(`presence:${otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presence",
          filter: `user_id=eq.${otherUserId}`,
        },
        (payload: any) => {
          console.log("Presence update for", otherUserId, ":", payload.new);
          setOtherUserOnline(payload.new?.is_online || false);
        }
      )
      .subscribe();

    // Poll every 10 seconds for online status (optimized)
    const pollInterval = setInterval(async () => {
      const status = await getUserOnlineStatus(otherUserId);
      setOtherUserOnline(status.is_online || false);
    }, 10000);

    return () => {
      presenceChannel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [otherUserId, user?.id]);

  // Load messages
  useEffect(() => {
    if (!user?.id || !otherUserId) return;

    const loadMessages = async () => {
      console.log("🔵 Loading messages for task:", taskId, "between:", { userId: user.id, otherUserId });
      
      // Query messages by task_id with sender profile joined
      let query = supabase
        .from("messages")
        .select(`
          *,
          sender:sender_id (id, username, freelancer_username, avatar_url)
        `)
        .order("created_at", { ascending: true });
      
      // If taskId exists, filter by it. Otherwise filter by sender/recipient
      if (taskId) {
        query = query.eq("task_id", taskId);
      } else {
        query = query.or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
        );
      }
      
      const { data, error } = await query;

      if (error) {
        console.error("❌ Error loading messages:", error);
        setError(`Failed to load messages: ${error.message}`);
        return;
      }

      console.log("✅ Messages loaded:", data?.length || 0, data);
      setMessages(data || []);
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

    // Poll for new messages every 5 seconds (optimized, real-time subscription is primary)
    const pollInterval = setInterval(async () => {
      let pollQuery = supabase
        .from("messages")
        .select(`
          *,
          sender:sender_id (id, username, freelancer_username, avatar_url)
        `)
        .order("created_at", { ascending: true });
      
      if (taskId) {
        pollQuery = pollQuery.eq("task_id", taskId);
      } else {
        pollQuery = pollQuery.or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
        );
      }
      
      const { data } = await pollQuery;

      // Only update if there are new messages
      setMessages((prev) => {
        if (prev.length < (data || []).length) {
          console.log("Polling detected new messages");
          return data || [];
        }
        return prev;
      });
    }, 1000);

    // Subscribe to new messages and updates
    const subscription = supabase
      .channel(`chat:${user.id}:${otherUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: taskId 
            ? `task_id=eq.${taskId}`
            : `or(and(sender_id=eq.${user.id},receiver_id=eq.${otherUserId}),and(sender_id=eq.${otherUserId},receiver_id=eq.${user.id}))`,
        },
        async (payload) => {
          console.log("✅ New message received from subscription:", payload.new);
          
          // Fetch sender info for the new message
          let messageWithSender = payload.new as any;
          if (payload.new.sender_id) {
            const { data: sender } = await supabase
              .from("profiles")
              .select("id, username, freelancer_username, avatar_url")
              .eq("id", payload.new.sender_id)
              .single();
            if (sender) {
              messageWithSender = { ...payload.new, sender };
            }
          }
          
          setMessages((prev) => {
            // Check if this exact message already exists by ID
            const messageExists = prev.some((m) => m.id === payload.new.id);
            if (messageExists) {
              console.log("Message already in list, skipping");
              return prev;
            }
            
            // Check if there's a temp message that matches this one
            const tempMessageIndex = prev.findIndex((m) => 
              m.id.startsWith("temp-") && 
              m.sender_id === payload.new.sender_id && 
              m.receiver_id === payload.new.receiver_id && 
              (m.content === payload.new.content || m.text === payload.new.text)
            );
            
            if (tempMessageIndex !== -1) {
              console.log("Replacing temp message with real one");
              // Replace temp message with real one
              const updated = [...prev];
              updated[tempMessageIndex] = messageWithSender;
              return updated;
            }
            
            console.log("Adding new message from subscription");
            return [...prev, messageWithSender];
          });
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }, 0);
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
          // Update the message (e.g., read status)
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? (payload.new as Message) : m))
          );
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
      clearInterval(pollInterval);
    };
  }, [user?.id, otherUserId, taskId]);

  // Load task status
  useEffect(() => {
    if (!taskId || !user?.id) return;

    const loadTaskStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("tasks")
          .select("id, title, status, poster_id, assignee_id, budget, payment_status, payment_completed_at")
          .eq("id", taskId)
          .single();

        if (error) {
          console.error("Error loading task status:", error);
          return;
        }

        if (data) {
          console.log("Task loaded:", { status: data.status, poster_id: data.poster_id, current_user: user?.id, payment_status: data.payment_status });
          setTask(data);
          setTaskStatus(data.status);
          setTaskPosterId(data.poster_id);
          
          // Check if current user already rated this task
          if (user?.id && otherUser?.id && taskId) {
            try {
              const { data: existingRatings, error } = await supabase
                .from("ratings")
                .select("id")
                .eq("rater_id", user.id)
                .eq("rated_user_id", otherUser.id)
                .eq("task_id", taskId);

              if (error) {
                console.error("Error checking existing ratings:", error);
              } else {
                const hasRatedTask = existingRatings && existingRatings.length > 0;
                setHasRatedThisTask(hasRatedTask);
                console.log("User has rated this task:", hasRatedTask);
              }
            } catch (err) {
              console.error("Exception checking ratings:", err);
            }
          }
          
          // Auto-show rating modal if task is completed
          if (data.status === "completed") {
            console.log("Task is completed, showing rating modal");
            setTimeout(() => setShowRatingModal(true), 800);
          }
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
        async (payload) => {
          console.log("✅ Real-time task update received:", payload.new);
          console.log("Current state - user:", user?.id, "otherUser:", otherUser?.id, "taskId:", taskId);
          setTask(payload.new);
          setTaskStatus(payload.new.status);
          setTaskPosterId(payload.new.poster_id);
          
          // Auto-show rating modal when task becomes completed
          if (payload.new.status === "completed") {
            console.log("🎯 Task just completed! Showing rating modal for both users");
            
            // Check if current user already rated (if otherUser is loaded)
            if (user?.id && otherUser?.id && taskId) {
              try {
                const { data: existingRatings, error } = await supabase
                  .from("ratings")
                  .select("id")
                  .eq("rater_id", user.id)
                  .eq("rated_user_id", otherUser.id)
                  .eq("task_id", taskId);

                if (error) {
                  console.error("❌ Error checking existing ratings:", error);
                } else {
                  const hasRated = existingRatings && existingRatings.length > 0;
                  console.log("✅ User has already rated:", hasRated);
                  setHasRatedThisTask(hasRated);
                }
              } catch (err) {
                console.error("❌ Exception checking ratings:", err);
              }
            } else {
              console.warn("⚠️ otherUser not loaded yet, will check ratings when modal opens");
            }
            
            // Always show modal when task is completed (for both tasker and freelancer)
            console.log("📢 Showing rating modal now");
            setShowRatingModal(true);
          }
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    // Polling fallback - check task status every 8 seconds (optimized)
    const pollInterval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("tasks")
          .select("id, title, status, poster_id, assignee_id, budget, payment_status, payment_completed_at")
          .eq("id", taskId)
          .single();

        if (data) {
          setTask(data);
          if (data.status === "completed" && taskStatus !== "completed") {
            console.log("📊 Polling detected task completion!");
            setTaskStatus(data.status);
            setTaskPosterId(data.poster_id);
            setTimeout(() => setShowRatingModal(true), 500);
          }
        }
      } catch (err) {
        // Silent fail for polling
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [taskId, user?.id, otherUser?.id, taskStatus]);

  const sendMessage = async (fileUrl?: string, voiceUrl?: string) => {
    if ((!newMessage.trim() && !fileUrl && !voiceUrl) || !user?.id || !otherUserId) {
      return;
    }

    const messageData: any = {
      task_id: taskId,
      sender_id: user.id,
      recipient_id: otherUserId,
      receiver_id: otherUserId,
      content: newMessage || null,
      text: newMessage || null,
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
      alert("Failed to save message: " + error.message);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
    } else if (data && data[0]) {
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMessage.id ? data[0] : m))
      );
    }
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !user?.id || !otherUserId) return;

    const file = files[0];
    if (!file) return;

    // Check file size before upload
    if (file.size > MAX_FILE_SIZE) {
      setError("❌ File too large. Maximum 5MB allowed.");
      return;
    }

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
    setError("⏳ Uploading file...");
    
    try {
      // Convert data URL back to file blob
      const response = await fetch(filePreview.url);
      const blob = await response.blob();
      const file = new File([blob], filePreview.name, { type: filePreview.type });

      // Prepare form data for API
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);
      formData.append("chatId", `${user.id}_${otherUserId}`);

      // Upload via API to Cloudflare R2
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error || uploadResult.details || "Upload failed");
      }

      // Send message with file URL
      await sendMessage(uploadResult.url);
      setFilePreview(null);
      setError(null);
    } catch (err: any) {
      console.error("File upload error:", err);
      setError(`❌ File upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
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
    if (!user?.id || !otherUser?.id || !taskId) {
      console.error("Missing required data:", { userId: user?.id, otherUserId: otherUser?.id, taskId });
      return;
    }

    setRatingLoading(true);
    try {
      // Determine rating_type: if current user is the task poster, they're rating a freelancer
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .select("poster_id")
        .eq("id", taskId)
        .single();

      if (taskError) {
        console.error("❌ Error fetching task:", taskError);
        setError("Failed to fetch task");
        setRatingLoading(false);
        return;
      }

      const ratingType = task?.poster_id === user.id ? "freelancer" : "tasker";
      console.log("📝 Submitting rating:", {
        rater: user.id,
        rated: otherUser.id,
        task: taskId,
        type: ratingType,
        stars,
        comment,
      });

      // Check if user already rated this task
      const { data: existingRatings } = await supabase
        .from("ratings")
        .select("id")
        .eq("rater_id", user.id)
        .eq("rated_user_id", otherUser.id)
        .eq("task_id", taskId);

      const existingRating = existingRatings && existingRatings.length > 0 ? existingRatings[0] : null;

      let ratingError;
      if (existingRating) {
        // Update existing rating
        const { error: updateError } = await supabase
          .from("ratings")
          .update({
            rating: stars,
            comment: comment || null,
          })
          .eq("id", existingRating.id);
        ratingError = updateError;
        console.log("✅ Rating updated successfully as", ratingType);
      } else {
        // Insert new rating
        const { error: insertError } = await supabase.from("ratings").insert([
          {
            rater_id: user.id,
            rated_user_id: otherUser.id,
            rating: stars,
            comment: comment || null,
            rating_type: ratingType,
            task_id: taskId,
            created_at: new Date().toISOString(),
          },
        ]);
        ratingError = insertError;
        console.log("✅ Rating submitted successfully as", ratingType, "Error:", insertError);
      }

      if (ratingError) {
        console.error("❌ Rating error:", ratingError);
        setError("Failed to submit rating: " + ratingError.message);
        setRatingLoading(false);
        return;
      }

      // Get all ratings for the rated user to calculate averages by type
      const { data: allRatings, error: ratingsError } = await supabase
        .from("ratings")
        .select("rating, rating_type")
        .eq("rated_user_id", otherUser.id);

      if (!ratingsError && allRatings && allRatings.length > 0) {
        try {
          // Calculate average for tasker ratings
          const taskerRatings = allRatings.filter((r) => r.rating_type === "tasker");
          const taskerAvg = taskerRatings.length > 0
            ? (taskerRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / taskerRatings.length).toFixed(2)
            : 0;

          // Calculate average for freelancer ratings
          const freelancerRatings = allRatings.filter((r) => r.rating_type === "freelancer");
          const freelancerAvg = freelancerRatings.length > 0
            ? (freelancerRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / freelancerRatings.length).toFixed(2)
            : 0;

          // Calculate overall average
          const overallAvg = ((parseFloat(taskerAvg as any) + parseFloat(freelancerAvg as any)) / 2).toFixed(2);

          await supabase
            .from("profiles")
            .update({
              average_rating: parseFloat(overallAvg),
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

      setShowRatingModal(false);
      setHasRatedThisTask(true);
      console.log("✅ Rating submitted and modal closed");
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
      <div className="app-background min-h-screen text-white flex items-center justify-center">
        <p className="glass-text">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="app-background h-screen text-white flex flex-col">
      {/* Error Banner */}
      {error && (
        <div className="glass-button-danger border-b border-red-500/50 p-3 text-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <span className="text-red-200">{error}</span>
          <button
            onClick={() => setError(null)}
            className="glass-button glass-close w-8 h-8 text-red-300 hover:text-red-100"
          >
            ✕
          </button>
            <button
              onClick={() => setError(null)}
              className="glass-close w-8 h-8 text-red-300 hover:text-red-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header - FIXED */}
      <div className="sticky top-0 z-10 glass-nav border-b border-white/20 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            {otherUser ? (
              <>
                <img
                  src={
                    otherUser.avatar_url ||
                    `https://api.dicebear.com/8.x/thumbs/svg?seed=${otherUser.username}`
                  }
                  alt={otherUser.freelancer_username || otherUser.username}
                  className="w-10 h-10 glass-avatar"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold glass-text">
                      {otherUser.freelancer_username || otherUser.username}
                    </h1>
                    {otherUser.freelancer_username && (
                      <span className="text-xs glass-text-muted">(@{otherUser.username})</span>
                    )}
                    <span
                      className={`w-3 h-3 rounded-full ${
                        otherUserOnline ? "glass-status-online" : "glass-status-offline"
                      }`}
                      title={otherUserOnline ? "Online" : "Offline"}
                    />
                  </div>
                  <p className="text-xs glass-text-muted">
                    {otherUserOnline ? "Online" : "Offline"}
                  </p>
                </div>
              </>
            ) : (
              <div className="glass-text-muted">Loading user...</div>
            )}
          </div>
          <div className="flex gap-1 md:gap-2 items-center">
            {/* Show loading while task status is loading */}
            {taskId && !taskStatus && (
              <span className="text-xs glass-text-accent animate-pulse">
                Loading...
              </span>
            )}
            {taskId && taskStatus === "active" && String(user?.id) === String(taskPosterId) && (
              <button
                onClick={() => {
                  // Redirect to payments page with pre-filled data
                  const amount = task?.price || 0;
                  const otherUsername = otherUser?.username || "tasker";
                  router.push(`/payments?task=${taskId}&amount=${amount}&to=${otherUsername}&to_uid=${otherUserId}&memo=Payment for task: ${task?.title || "Task"}`);
                }}
                className="glass-button glass-button-primary px-2 md:px-4 py-1 md:py-2 text-xs md:text-sm animate-pulse"
                title="Pay freelancer and complete task"
              >
                Pay & Complete
              </button>
            )}
            {taskId && taskStatus === "active" && task?.payment_status === "completed" && (
              <span className="text-xs glass-text-accent flex items-center gap-1">
                Payment Completed
              </span>
            )}
            {taskId && taskStatus === "completed" && (
              <button
                onClick={() => setShowRatingModal(true)}
                disabled={hasRatedThisTask}
                className={`px-2 md:px-4 py-1 md:py-2 rounded-lg transition text-xs md:text-sm ${
                  hasRatedThisTask
                    ? "glass-button opacity-50 cursor-not-allowed"
                    : "glass-button glass-button-success animate-pulse"
                }`}
                title={hasRatedThisTask ? "You have already rated this task" : "Rate this task and comment"}
              >
                {hasRatedThisTask ? "Rated" : "Rate & Comment"}
              </button>
            )}
            <Link
              href="/messages"
              className="glass-button glass-button-primary px-3 md:px-5 py-2 md:py-2.5 text-sm md:text-base"
              title="Back to messages list"
            >
              Back
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
            <div className="flex items-center justify-center h-full">
              <p className="glass-text-muted" style={{ wordBreak: 'break-word' }}>No messages yet. Start the conversation!</p>
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
                  className={`relative max-w-xs lg:max-w-md px-4 py-2 transition ${
                    msg.sender_id === user.id
                      ? "glass-message-sent"
                      : "glass-message-received"
                  } ${selectedMessageId === msg.id ? "ring-2 ring-yellow-400" : ""}`}
                >
                  {selectedMessageId === msg.id && (
                    <div className="absolute -left-20 top-0 flex gap-2 glass-overlay rounded-lg p-2 z-50">
                      {msg.sender_id === user.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMessage(msg.id);
                          }}
                          className="glass-button glass-button-danger px-3 py-1 text-xs font-semibold whitespace-nowrap"
                          title="Delete message"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                  {msg.reply_to_id && messages.find(m => m.id === msg.reply_to_id) && (
                    <div className="text-xs glass-panel rounded p-2 mb-2 border-l-2 border-blue-400">
                      <p className="font-semibold glass-text-accent">Replying to:</p>
                      <p className="glass-text-muted truncate">{(messages.find(m => m.id === msg.reply_to_id)?.content || messages.find(m => m.id === msg.reply_to_id)?.text)}</p>
                    </div>
                  )}
                  {replyingTo?.id === msg.id && (
                    <div className="text-xs glass-panel rounded p-1 mb-2 border-l-2 border-yellow-400">
                      <p className="font-semibold text-yellow-300">Replying to:</p>
                      <p className="glass-text-muted truncate">{replyingTo.content || replyingTo.text}</p>
                    </div>
                  )}
                  {/* Sender name for received messages */}
                  {msg.sender_id !== user.id && msg.sender && (
                    <p className="text-xs font-semibold glass-text-accent mb-1">
                      {msg.sender.freelancer_username || msg.sender.username || "Unknown"}
                    </p>
                  )}
                  {/* Text content - only show if exists */}
                  {(msg.content || msg.text) && (
                    <p className="text-sm break-words glass-text">{msg.content || msg.text}</p>
                  )}
                  {/* File attachment */}
                  {msg.file_url && (
                    <div className="mt-2">
                      {msg.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                        <div className="relative group">
                          <img 
                            src={msg.file_url} 
                            alt="Shared image"
                            className="max-w-[200px] max-h-[200px] rounded-lg cursor-pointer hover:opacity-90"
                            onClick={() => setMediaView({ url: msg.file_url!, type: 'image' })}
                          />
                          {/* Download button for images */}
                          <a
                            href={msg.file_url}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-2 right-2 p-2 rounded-lg bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                            title="Download image"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span className="text-xs">Download</span>
                          </a>
                        </div>
                      ) : msg.file_url?.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|mp3|mp4|mov|avi)$/i) ? (
                        // Downloadable files - open in new tab
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="text-xs block break-all text-left glass-text-accent hover:underline flex items-center gap-1"
                        >
                          📎 {msg.file_url.includes('.pdf') ? 'View PDF' : 'Download File'}
                        </a>
                      ) : (
                        // Other files - open in new tab
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs block break-all text-left glass-text-accent hover:underline flex items-center gap-1"
                        >
                          📎 Open File
                        </a>
                      )}
                    </div>
                  )}
                  {/* Voice message */}
                  {msg.voice_url && (
                    <audio
                      controls
                      className="w-full mt-2 h-6 opacity-80"
                      src={msg.voice_url}
                    />
                  )}
                  <p className={`text-xs mt-1 glass-text-muted ${
                    msg.sender_id === user.id ? "text-right" : ""
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
        <div className="glass-nav border-t border-white/20 p-4 w-full">
          <div className="w-full px-4 flex items-center gap-3">
            {filePreview.type.startsWith("image/") ? (
              <img src={filePreview.url} alt="preview" className="w-16 h-16 object-cover rounded-lg glass-avatar" />
            ) : (
              <div className="w-16 h-16 glass-panel rounded-lg flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold glass-text truncate">{filePreview.name}</p>
              <p className="text-xs glass-text-muted">{filePreview.type}</p>
            </div>
            <button
              onClick={() => setFilePreview(null)}
              className="glass-button px-3 py-1 text-sm"
              title="Back to chat"
            >
              ← Back
            </button>
            <button
              onClick={uploadAndSendFile}
              disabled={uploading}
              className="glass-button glass-button-success px-3 py-1 text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Uploading...
                </>
              ) : (
                "Send"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Input Area - FIXED */}
      <div className="sticky bottom-0 z-10 glass-nav border-t border-white/20 p-3 w-full">
        {/* Reply Context */}
        {replyingTo && (
          <div className="mb-2 glass-message-sent border-l-4 border-blue-400 rounded p-2 flex justify-between items-center">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold glass-text-accent">Replying to:</p>
              <p className="text-sm glass-text truncate">{replyingTo.content || replyingTo.text}</p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="ml-2 glass-close text-xs font-semibold"
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
              className="w-full glass-input px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {/* Attach button below textbox */}
            <label className="glass-button px-3 py-2 text-sm flex items-center gap-2 w-fit cursor-pointer" title="Upload files">
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
            className="glass-button glass-button-primary h-10 w-10 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
          <div className="w-full h-full flex flex-col items-center justify-center">
            <button
              onClick={() => setMediaView(null)}
              className="absolute top-4 left-4 glass-button glass-button-primary px-4 py-2 text-sm"
              title="Back to chat"
            >
              ← Back
            </button>
            {mediaView.type === 'application/pdf' ? (
              <iframe
                src={mediaView.url}
                className="w-full h-full glass-modal"
                title="PDF Viewer"
              />
            ) : (
              <img
                src={mediaView.url}
                alt="Media"
                className="max-w-full max-h-full object-contain glass-modal"
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
