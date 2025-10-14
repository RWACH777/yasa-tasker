"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  receiverId: string;
  receiverName: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

export default function ChatModal({
  isOpen,
  onClose,
  taskTitle,
  receiverId,
  receiverName,
}: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const currentUserId =
    typeof window !== "undefined" ? localStorage.getItem("pi_username") : null;

  // Load messages from Supabase
  useEffect(() => {
    if (!isOpen || !currentUserId) return;

    const loadMessages = async () => {
      const { data, error } = await supabase
  .from("messages")
  .select("*")
  .or(
    `and(sender_id.eq.${currentUserId},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${currentUserId})`
  )
  .order("created_at", { ascending: true });

      if (error) console.error("Error loading messages:", error);
      else setMessages(data || []);
    };

    loadMessages();

    // Subscribe for realtime updates
    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          if (
            (msg.sender_id === currentUserId && msg.receiver_id === receiverId) ||
            (msg.sender_id === receiverId && msg.receiver_id === currentUserId)
          ) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, receiverId, currentUserId]);

  const handleSend = async () => {
    if (!newMsg.trim() || !currentUserId) return;

    const { error } = await supabase.from("messages").insert([
      {
        sender_id: currentUserId,
        receiver_id: receiverId,
        content: newMsg.trim(),
      },
    ]);

    if (error) console.error("Error sending message:", error);
    else setNewMsg("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
      <div className="bg-[#0a0a2a] w-full max-w-md rounded-2xl p-4 border border-white/10">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">
            Chat with {receiverName} ({taskTitle})
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-400"
          >
            ✕
          </button>
        </div>

        <div className="h-80 overflow-y-auto bg-white/5 rounded-lg p-3 space-y-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={p-2 rounded-lg text-sm max-w-[80%] ${
                m.sender_id === currentUserId
                  ? "bg-blue-600 ml-auto"
                  : "bg-gray-700"
              }}
            >
              {m.content}
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2 rounded-lg bg-white/10 border border-white/20"
          />
          <button
            onClick={handleSend}
            className="bg-blue-600 hover:bg-blue-700 px-4 rounded-lg"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}