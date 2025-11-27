"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

interface Conversation {
  userId: string;
  username: string;
  lastMessage: string;
  lastMessageTime: string;
}

export default function MessagesPage() {
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);

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

  const sendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !selectedUserId) return;

    const { error } = await supabase.from("messages").insert([
      {
        sender_id: user.id,
        receiver_id: selectedUserId,
        content: newMessage,
        created_at: new Date().toISOString(),
      },
    ]);

    if (!error) {
      setNewMessage("");
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
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input with File Upload */}
              <div className="flex gap-2">
                <label className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition cursor-pointer text-sm flex items-center gap-2">
                  📎
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        const fileNames = Array.from(files).map(f => f.name).join(", ");
                        setNewMessage(prev => prev + (prev ? " " : "") + `[Files: ${fileNames}]`);
                      }
                    }}
                  />
                  Attach
                </label>
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
                  onClick={sendMessage}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
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
