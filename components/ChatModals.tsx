"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

interface ChatModalProps {
  currentUserId: string;
  receiverId: string;
  receiverName: string;
}

export default function ChatModal({ currentUserId, receiverId, receiverName }: ChatModalProps) {
  const supabase = createClientComponentClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [open, setOpen] = useState(false);

  // Fetch chat messages
  useEffect(() => {
    if (!currentUserId || !receiverId) return;

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

    // Real-time updates
    const channel = supabase
      .channel("chat-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new as Message;
          if (
            (newMsg.sender_id === currentUserId && newMsg.receiver_id === receiverId) ||
            (newMsg.sender_id === receiverId && newMsg.receiver_id === currentUserId)
          ) {
            setMessages((prev) => [...prev, newMsg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId, receiverId]);

  // Send message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const { error } = await supabase.from("messages").insert([
      {
        sender_id: currentUserId,
        receiver_id: receiverId,
        content: newMessage.trim(),
      },
    ]);

    if (error) console.error("Error sending message:", error);
    else setNewMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Chat with {receiverName}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chat with {receiverName}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto p-2 bg-gray-800 rounded-lg">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`p-2 rounded-lg text-sm max-w-[80%] ${
                m.sender_id === currentUserId
                  ? "bg-blue-600 ml-auto text-white"
                  : "bg-gray-700 text-gray-100"
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-3">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <Button onClick={sendMessage}>Send</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}