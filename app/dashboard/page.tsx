"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("Profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (!error && data) setProfile(data);
      setLoading(false);
    };

    fetchProfile();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#000222] via-[#01012A] to-[#000222] flex flex-col items-center text-white px-4 py-10">
      {/* Header */}
      <div className="w-full max-w-3xl flex justify-between items-center mb-10 bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4">
        <div className="flex items-center gap-3">
          {profile?.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt="Avatar"
              width={40}
              height={40}
              className="rounded-full border border-white/20"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 border border-white/20" />
          )}
          <div>
            <h2 className="text-lg font-semibold">
              {loading
                ? "Loading..."
                : profile?.pi_username || "Anonymous User"}
            </h2>
            <p className="text-sm text-gray-300">Welcome to Yasa Tasker 👋</p>
          </div>
        </div>
      </div>

      {/* Task Posting Card */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Post a New Task</h3>
        <form className="space-y-3">
          <input
            type="text"
            placeholder="Task title"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <textarea
            placeholder="Describe your task..."
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            className="w-full bg-blue-600/80 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition"
          >
            Post Task
          </button>
        </form>
      </div>

      {/* Tasks Feed */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4">Available Tasks</h3>
        <p className="text-gray-300 text-sm">
          Tasks posted by other users will appear here.
        </p>
      </div>
    </div>
  );
}