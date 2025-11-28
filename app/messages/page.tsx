"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
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

  const deleteConversation = async (otherUserId: string) => {
    if (!confirm("Delete this conversation? This cannot be undone.")) return;

    const { error } = await supabase
      .from("messages")
      .delete()
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
      );

    if (!error) {
      setConversations(conversations.filter((c) => c.userId !== otherUserId));
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
                  className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition"
                >
                  <button
                    onClick={() => router.push("/chat?user=" + conv.userId)}
                    className="flex-1 text-left"
                  >
                    <p className="font-semibold text-sm">{conv.username}</p>
                    <p className="text-xs text-gray-400 truncate">{conv.lastMessage}</p>
                  </button>
                  <button
                    onClick={() => deleteConversation(conv.userId)}
                    className="px-3 py-2 bg-red-600/80 hover:bg-red-700 rounded-lg transition text-sm ml-2"
                    title="Delete this conversation"
                  >
                    🗑️
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
