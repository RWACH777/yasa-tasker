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
  isCleared?: boolean;
  taskId?: string;
}

export default function MessagesPage() {
  const router = useRouter();
  
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [longPressedConvId, setLongPressedConvId] = useState<string | null>(null);
  const [menuOpenConvId, setMenuOpenConvId] = useState<string | null>(null);
  const [confirmDeleteConvId, setConfirmDeleteConvId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [clearedCount, setClearedCount] = useState(0);

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

  // Load conversations function
  const loadConversations = async () => {
    if (!user?.id) return;
    
    // First, get list of cleared conversations for this user
    const { data: clearedConvs } = await supabase
      .from("cleared_conversations")
      .select("other_user_id")
      .eq("user_id", user.id);

    const clearedUserIds = new Set(clearedConvs?.map(c => c.other_user_id) || []);
    setClearedCount(clearedUserIds.size);

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

      // Skip if this conversation was cleared/deleted by user (unless showing deleted)
      if (!showDeleted && clearedUserIds.has(otherUserId)) continue;

      if (!uniqueUsers.has(otherUserId)) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", otherUserId)
          .single();

        // Count only unread messages from this user (messages received from them with read=false)
        const unreadMessages = (received || []).filter(
          (m) => m.sender_id === otherUserId && m.read === false
        );

        uniqueUsers.set(otherUserId, {
          userId: otherUserId,
          username: profile?.username || "Unknown",
          avatar_url: profile?.avatar_url,
          lastMessage: msg.text || (msg.file_url ? "[File shared]" : "[Voice message]"),
          lastMessageTime: msg.created_at,
          isOnline: false,
          unreadCount: unreadMessages.length,
          isCleared: clearedUserIds.has(otherUserId),
          taskId: msg.task_id,
        });
      }
    }

    setConversations(Array.from(uniqueUsers.values()));
  };

  // Load conversations effect
  useEffect(() => {
    loadConversations();

    // Refresh when page becomes visible (coming back from chat)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Page visible - refreshing conversations");
        loadConversations();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Subscribe to message updates to refresh unread counts
    const subscription = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("New message inserted:", payload.new);
          loadConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("Message updated:", payload.new);
          loadConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("Message deleted:", payload.old);
          loadConversations();
        }
      )
      .subscribe();

    // Poll every 10 seconds as backup (reduced from 3s to save bandwidth)
    const pollInterval = setInterval(() => {
      loadConversations();
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearInterval(pollInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user?.id, showDeleted]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setMenuOpenConvId(null);
    if (menuOpenConvId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [menuOpenConvId]);

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
    try {
      // Add to cleared_conversations table for soft-delete
      const { error: clearError } = await supabase
        .from("cleared_conversations")
        .insert({
          user_id: user.id,
          other_user_id: otherUserId,
        });

      if (clearError) {
        console.error("Error clearing conversation:", clearError);
        alert(`❌ Failed to delete conversation: ${clearError.message}`);
        return;
      }

      // Reload conversations to reflect the change
      await loadConversations();
      console.log("✅ Conversation cleared for current user");
    } catch (err) {
      console.error("Exception deleting conversation:", err);
      alert(`❌ Error deleting conversation: ${err}`);
    }
  };

  const restoreConversation = async (otherUserId: string) => {
    try {
      // Remove from cleared_conversations table
      const { error: deleteError } = await supabase
        .from("cleared_conversations")
        .delete()
        .eq("user_id", user.id)
        .eq("other_user_id", otherUserId);

      if (deleteError) {
        console.error("Error restoring conversation:", deleteError);
        alert(`❌ Failed to restore conversation: ${deleteError.message}`);
        return;
      }

      // Reload conversations to reflect the change
      await loadConversations();
      console.log("✅ Conversation restored");
    } catch (err) {
      console.error("Exception restoring conversation:", err);
      alert(`❌ Error restoring conversation: ${err}`);
    }
  };


  if (loading) {
    return (
      <div className="app-background min-h-screen text-white flex items-center justify-center">
        <p className="glass-text">Loading messages...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-background min-h-screen text-white flex items-center justify-center">
        <p className="glass-text">Please log in to view messages.</p>
      </div>
    );
  }

  return (
    <div className="app-background min-h-screen text-white flex flex-col">
      {/* Header */}
      <div className="glass-nav border-b border-white/20 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold glass-text">Messages</h1>
          <Link
            href="/dashboard"
            className="glass-button glass-button-primary px-4 py-2 text-sm"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 max-w-4xl mx-auto w-full p-4">
        <div className="glass-panel p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold glass-text">Your Conversations</h2>
            {clearedCount > 0 && (
              <button
                onClick={() => setShowDeleted(!showDeleted)}
                className="text-xs glass-button px-3 py-1"
              >
                {showDeleted ? "Hide Deleted" : `Show Deleted (${clearedCount})`}
              </button>
            )}
          </div>
          {conversations.length === 0 ? (
            <p className="glass-text-muted text-sm">No conversations yet. Click "Contact Tasker" on a task to start!</p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.userId}
                  className={`flex items-center justify-between glass-list-item p-3 relative group ${
                    longPressedConvId === conv.userId ? "ring-2 ring-red-400" : ""
                  } ${conv.isCleared ? "opacity-60" : ""}`}
                  onMouseDown={() => handleConvMouseDown(conv.userId)}
                  onMouseUp={handleConvMouseUp}
                  onMouseLeave={handleConvMouseUp}
                >
                  <button
                    onClick={() => router.push(`/chat?user=${conv.userId}${conv.taskId ? `&task=${conv.taskId}` : ""}`)}
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
                        className="w-12 h-12 glass-avatar object-cover"
                      />
                      {/* Online Status Indicator */}
                      <div
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#000222] ${
                          conv.isOnline ? "glass-status-online" : "glass-status-offline"
                        }`}
                        title={conv.isOnline ? "Online" : "Offline"}
                      />
                    </div>
                    
                    {/* Message Info */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm glass-text truncate">{conv.username}</p>
                        {conv.unreadCount > 0 && (
                          <span className="glass-badge text-white text-xs font-bold w-5 h-5 flex items-center justify-center flex-shrink-0">
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs glass-text-muted break-words line-clamp-2">{conv.lastMessage}</p>
                      <p className="text-xs glass-text-muted opacity-60 truncate">
                        {new Date(conv.lastMessageTime).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                  {/* 3-dot menu for conversation options */}
                  <div className="relative ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenConvId(menuOpenConvId === conv.userId ? null : conv.userId);
                      }}
                      className="p-2 rounded-lg hover:bg-white/10 transition"
                      title="More options"
                    >
                      <svg className="w-5 h-5 glass-text-muted" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    
                    {/* Dropdown menu */}
                    {menuOpenConvId === conv.userId && (
                      <div className="absolute right-0 top-full mt-1 w-40 glass-card border border-white/20 rounded-lg shadow-xl z-50">
                        {conv.isCleared ? (
                          <button
                            onClick={() => {
                              setMenuOpenConvId(null);
                              restoreConversation(conv.userId);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-green-500/10 rounded-lg transition flex items-center gap-2"
                          >
                            <span>Restore Chat</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setMenuOpenConvId(null);
                              setConfirmDeleteConvId(conv.userId);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition flex items-center gap-2"
                          >
                            <span>Delete Chat</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {confirmDeleteConvId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="glass-card p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-2">Delete Conversation?</h3>
            <p className="glass-text-muted text-sm mb-6">
              This will remove the conversation from your list. The messages will still be saved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteConvId(null)}
                className="flex-1 glass-button py-2"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteConversation(confirmDeleteConvId);
                  setConfirmDeleteConvId(null);
                }}
                className="flex-1 glass-button glass-button-danger py-2"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
