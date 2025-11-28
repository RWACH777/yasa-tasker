"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    if ((!newMessage.trim() && !fileUrl && !voiceUrl) || !user?.id || !otherUserId) return;

    const messageData: any = {
      sender_id: user.id,
      receiver_id: otherUserId,
      content: newMessage || (fileUrl ? "[File shared]" : "[Voice message]"),
      created_at: new Date().toISOString(),
    };

    if (fileUrl) messageData.file_url = fileUrl;
    if (voiceUrl) messageData.voice_url = voiceUrl;

    const { error } = await supabase.from("messages").insert([messageData]);

    if (!error) {
      setNewMessage("");
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const fileName = `${user.id}/${otherUserId}/voice_${Date.now()}.webm`;

        const { error: uploadError } = await supabase.storage
          .from("message-files")
          .upload(fileName, blob);

        if (!uploadError) {
          const { data } = supabase.storage
            .from("message-files")
            .getPublicUrl(fileName);
          await sendMessage(undefined, data.publicUrl);
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setTimeout(() => mediaRecorder.stop(), 5000);
    } catch (err) {
      console.error("Voice recording error:", err);
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
                  <p className="text-sm">{msg.content}</p>
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
        <div className="w-full px-4 flex flex-col gap-2">
          <div className="flex gap-2 items-center flex-wrap">
            <label className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition cursor-pointer text-sm flex items-center gap-2" title="Upload files">
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
            <button
              onClick={handleVoiceRecord}
              disabled={uploading}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm disabled:opacity-50 flex items-center justify-center"
              title="Record voice message (5 sec max)"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1C6.48 1 2 5.48 2 11v8c0 1.1.9 2 2 2h2v-9H4v-1c0-4.42 3.58-8 8-8s8 3.58 8 8v1h-2v9h2c1.1 0 2-.9 2-2v-8c0-5.52-4.48-10-10-10zm0 18c-2.21 0-4-1.79-4-4h8c0 2.21-1.79 4-4 4z"/>
              </svg>
            </button>
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              className="flex-1 min-w-[120px] bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
            />
            <button
              onClick={() => sendMessage()}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 font-semibold whitespace-nowrap"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
