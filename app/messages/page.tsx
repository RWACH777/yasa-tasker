"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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

interface Conversation {
  userId: string;
  username: string;
  lastMessage: string;
  lastMessageTime: string;
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const userParam = searchParams.get("user");
  
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(userParam);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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
      }
      setLoading(false);
    };
    loadUser();
  }, []);

  // Load conversations
  useEffect(() => {
    if (!user?.id) return;

    const loadConversations = async () => {
      const { data: sent } = await supabase
        .from("messages")
        .select("*")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false });

      const { data: received } = await supabase
        .from("messages")
        .select("*")
        .eq("receiver_id", user.id)
        .order("created_at", { ascending: false });

      const allMessages = [...(sent || []), ...(received || [])];
      const uniqueUsers = new Map();

      for (const msg of allMessages) {
        const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
        if (!uniqueUsers.has(otherUserId)) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username")
            .eq("id", otherUserId)
            .single();

          uniqueUsers.set(otherUserId, {
            userId: otherUserId,
            username: profile?.username || "Unknown",
            lastMessage: msg.content,
            lastMessageTime: msg.created_at,
          });
        }
      }

      setConversations(Array.from(uniqueUsers.values()));
    };

    loadConversations();
  }, [user?.id]);

  // Load messages for selected user
  useEffect(() => {
    if (!user?.id || !selectedUserId) return;

    const loadMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });

      setMessages(data || []);
    };

    loadMessages();

    // Subscribe to new messages
    const subscription = supabase
      .channel(`messages:${user.id}:${selectedUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `or(and(sender_id=eq.${user.id},receiver_id=eq.${selectedUserId}),and(sender_id=eq.${selectedUserId},receiver_id=eq.${user.id}))`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, selectedUserId]);

  const sendMessage = async (fileUrl?: string, voiceUrl?: string) => {
    if ((!newMessage.trim() && !fileUrl && !voiceUrl) || !user?.id || !selectedUserId) return;

    const messageData: any = {
      sender_id: user.id,
      receiver_id: selectedUserId,
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
    if (!files || !user?.id || !selectedUserId) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const fileName = `${user.id}/${selectedUserId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("message-files")
          .upload(fileName, file);

        if (!uploadError) {
          const { data } = supabase.storage
            .from("message-files")
            .getPublicUrl(fileName);
          await sendMessage(data.publicUrl);
        }
      } catch (err) {
        console.error("File upload error:", err);
      }
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
        const fileName = `${user.id}/${selectedUserId}/voice_${Date.now()}.webm`;

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
      setTimeout(() => mediaRecorder.stop(), 5000); // 5 second recording limit
    } catch (err) {
      console.error("Voice recording error:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#000222] text-white flex items-center justify-center">
        <p>Loading messages...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#000222] text-white flex items-center justify-center">
        <p>Please log in to view messages.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000222] text-white flex flex-col">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20 p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Messages</h1>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full gap-4 p-4">
        {/* Conversations List - Horizontal */}
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4">
          <h2 className="text-lg font-semibold mb-3">Conversations</h2>
          {conversations.length === 0 ? (
            <p className="text-gray-400 text-sm">No conversations yet</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {conversations.map((conv) => (
                <button
                  key={conv.userId}
                  onClick={() => setSelectedUserId(conv.userId)}
                  className={`flex-shrink-0 px-4 py-3 rounded-lg transition whitespace-nowrap ${
                    selectedUserId === conv.userId
                      ? "bg-blue-600/50 border border-blue-400"
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  <p className="font-semibold text-sm">{conv.username}</p>
                  <p className="text-xs text-gray-400 truncate max-w-[150px]">{conv.lastMessage}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="flex-1 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 flex flex-col">
          {selectedUserId ? (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center mt-4">
                    No messages yet. Start the conversation!
                  </p>
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
              </div>

              {/* Input with File Upload & Voice */}
              <div className="flex gap-2">
                <label className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition cursor-pointer text-sm flex items-center gap-2 disabled:opacity-50" title="Upload files">
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
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm disabled:opacity-50"
                  title="Record voice message (5 sec max)"
                >
                  🎤
                </button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") sendMessage();
                  }}
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400">Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
