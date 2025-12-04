"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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

interface Conversation {
  userId: string;
  username: string;
  avatar_url?: string;
  lastMessage: string;
  lastMessageTime: string;
  isOnline: boolean;
  unreadCount: number;
}

export default function MessagesPage() {
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [longPressedConvId, setLongPressedConvId] = useState<string | null>(null);

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
            .select("username, avatar_url")
            .eq("id", otherUserId)
            .single();

          // Count unread messages from this user (messages received from them that haven't been read)
          const unreadMessages = (received || []).filter(
            (m) => m.sender_id === otherUserId && !m.read
          );

          uniqueUsers.set(otherUserId, {
            userId: otherUserId,
            username: profile?.username || "Unknown",
            avatar_url: profile?.avatar_url,
            lastMessage: msg.text || (msg.file_url ? "[File shared]" : "[Voice message]"),
            lastMessageTime: msg.created_at,
            isOnline: false,
            unreadCount: unreadMessages.length,
          });
        }
      }

      setConversations(Array.from(uniqueUsers.values()));
    };

    loadConversations();
  }, [user?.id]);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleConvMouseDown = (convId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setLongPressedConvId(convId);
    }, 500);
  };

  const handleConvMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const deleteConversation = async (otherUserId: string) => {
    const { error } = await supabase
      .from("messages")
      .delete()
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      );

    if (!error) {
      setConversations(conversations.filter((c) => c.userId !== otherUserId));
      setLongPressedConvId(null);
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
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Messages</h1>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 max-w-4xl mx-auto w-full p-4">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Your Conversations</h2>
          {conversations.length === 0 ? (
            <p className="text-gray-400 text-sm">No conversations yet. Click "Contact Tasker" on a task to start!</p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.userId}
                  className={`flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition relative group ${
                    longPressedConvId === conv.userId ? "ring-2 ring-red-500" : ""
                  }`}
                  onMouseDown={() => handleConvMouseDown(conv.userId)}
                  onMouseUp={handleConvMouseUp}
                  onMouseLeave={handleConvMouseUp}
                >
                  <button
                    onClick={() => router.push(`/chat?user=${conv.userId}`)}
                    className="flex-1 text-left flex items-center gap-3"
                  >
                    {/* Profile Picture with Online Status */}
                    <div className="relative">
                      <img
                        src={
                          conv.avatar_url ||
                          `https://api.dicebear.com/8.x/thumbs/svg?seed=${conv.username}`
                        }
                        alt={conv.username}
                        className="w-12 h-12 rounded-full border border-white/30 object-cover"
                      />
                      {/* Online Status Indicator */}
                      <div
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#000222] ${
                          conv.isOnline ? "bg-blue-500" : "bg-gray-500"
                        }`}
                        title={conv.isOnline ? "Online" : "Offline"}
                      />
                    </div>
                    
                    {/* Message Info */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{conv.username}</p>
                        {conv.unreadCount > 0 && (
                          <span className="bg-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 break-words line-clamp-2">{conv.lastMessage}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {new Date(conv.lastMessageTime).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => deleteConversation(conv.userId)}
                    className="ml-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-semibold opacity-0 group-hover:opacity-100 transition"
                    title="Delete conversation"
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
