"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  file_url?: string;
  voice_url?: string;
  created_at: string;
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const otherUserId = searchParams.get("user");

  const [user, setUser] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filePreview, setFilePreview] = useState<{ name: string; type: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

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
      } else {
        router.push("/dashboard");
      }
      setLoading(false);
    };
    loadUser();
  }, [router]);

  // Load other user info
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
            console.error("Voice upload error:", uploadError);
            setError(`Failed to upload voice message: ${uploadError.message}`);
          } else {
            const { data } = supabase.storage
              .from("message-files")
              .getPublicUrl(fileName);
            await sendMessage(undefined, data.publicUrl);
          }
        } catch (err) {
          console.error("Voice processing error:", err);
          setError(`Error processing voice message: ${(err as any).message}`);
        } finally {
          stream.getTracks().forEach((track) => track.stop());
          setIsRecording(false);
        }
      };

      mediaRecorder.start();
      // Auto-stop after 60 seconds
      setTimeout(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop();
        }
      }, 60000);
    } catch (err) {
      console.error("Voice recording error:", err);
      setError(`Microphone access denied: ${(err as any).message}`);
      setIsRecording(false);
    }
  };

  const deleteChat = async () => {
    if (!confirm("Delete this conversation? This cannot be undone.")) return;

    const { error } = await supabase
      .from("messages")
      .delete()
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      );

    if (!error) {
      router.push("/messages");
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
    <div className="min-h-screen bg-[#000222] text-white flex flex-col">
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

      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 p-4">
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
              <h1 className="text-xl font-bold">{otherUser.username}</h1>
              <p className="text-xs text-gray-400">
                {otherUser.freelancer_username || "No freelancer name set"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={deleteChat}
              className="px-3 py-2 bg-red-600/80 hover:bg-red-700 rounded-lg transition text-sm"
              title="Delete this conversation"
            >
              🗑️ Delete Chat
            </button>
            <Link
              href="/messages"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
            >
              Back
            </Link>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.sender_id === user.id ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.sender_id === user.id
                      ? "bg-blue-600/50 border border-blue-400"
                      : "bg-white/10 border border-white/20"
                  }`}
                >
                  <p className="text-sm">{msg.text}</p>
                  {msg.file_url && (
                    <a
                      href={msg.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-300 hover:text-blue-200 text-xs mt-2 block break-all"
                    >
                      📎 Download File
                    </a>
                  )}
                  {msg.voice_url && (
                    <audio
                      controls
                      className="w-full mt-2 h-6"
                      src={msg.voice_url}
                    />
                  )}
                  <p className="text-xs text-gray-400 mt-1">
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
              className="px-2 py-1 text-red-400 hover:text-red-300 text-sm"
            >
              ✕
            </button>
            <button
              onClick={uploadAndSendFile}
              disabled={uploading}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white/10 backdrop-blur-lg border-t border-white/20 p-3 w-full">
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
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
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

          {/* Right: Send/Voice button */}
          <button
            onClick={() => {
              if (newMessage.trim()) {
                sendMessage();
              } else {
                handleVoiceRecord();
              }
            }}
            disabled={uploading}
            className={`px-3 py-2 rounded-lg transition flex items-center justify-center h-10 w-10 ${
              isRecording
                ? "bg-red-600 hover:bg-red-700 animate-pulse"
                : "bg-blue-600 hover:bg-blue-700"
            } disabled:opacity-50`}
            title={newMessage.trim() ? "Send message" : isRecording ? "Stop recording" : "Record voice message"}
          >
            {newMessage.trim() ? (
              // Telegram send icon
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.6915026,12.4744748 L3.50612381,13.2599618 C3.19218622,13.2599618 3.03521743,13.4170592 3.03521743,13.5741566 L1.15159189,20.0151496 C0.8376543,20.8006365 0.99,21.89 1.77946707,22.52 C2.41,22.99 3.50612381,23.1 4.13399899,22.9429026 L21.714504,14.0454487 C22.6563168,13.5741566 23.1272231,12.6315722 22.9702544,11.6889879 L4.13399899,1.16346272 C3.34915502,0.9 2.40734225,1.00636533 1.77946707,1.4776575 C0.994623095,2.10604706 0.837654326,3.0486314 1.15159189,3.99701575 L3.03521743,10.4380088 C3.03521743,10.5951061 3.34915502,10.7522035 3.50612381,10.7522035 L16.6915026,11.5376905 C16.6915026,11.5376905 17.1624089,11.5376905 17.1624089,12.0089827 C17.1624089,12.4744748 16.6915026,12.4744748 16.6915026,12.4744748 Z"/>
              </svg>
            ) : isRecording ? (
              // Stop icon (square) when recording
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" />
              </svg>
            ) : (
              // Microphone icon
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-2c0 .5-.4.9-.9.9s-.9-.4-.9-.9c0-1.97-1.37-3.29-3.5-3.58v2.58c0 .46.3.88.77 1.02C15.38 10.77 17.3 11.87 17.3 12z"/>
                <path d="M17 16.95c-1.48 1.46-3.51 2.36-5.77 2.36s-4.29-.9-5.77-2.36l-1.1 1.1c1.86 1.86 4.41 3 7.07 3s5.21-1.14 7.07-3l-1.1-1.1zM12 20c2.21 0 4-1.79 4-4h-8c0 2.21 1.79 4 4 4z"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
