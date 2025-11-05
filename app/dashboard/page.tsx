"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { supabase } from "@/lib/supabaseClient"

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from("Profiles")
        .select("*")
        .eq("id", user.id)
        .single()
      setProfile(data)
    }
    fetchProfile()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-950 flex flex-col items-center text-white px-4 py-10">
      {/* Header */}
      <div className="w-full max-w-3xl flex justify-between items-center mb-10 bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4">
        <div className="flex items-center gap-3">
          {profile?.avatar_url && (
            <Image
              src={profile.avatar_url}
              alt="Avatar"
              width={40}
              height={40}
              className="rounded-full border border-white/20"
            />
          )}
          <div>
            <h2 className="text-lg font-semibold">
              {profile?.pi_username || "Loading..."}
            </h2>
            <p className="text-sm text-gray-400">Welcome to Yasa Tasker 👋</p>
          </div>
        </div>
      </div>

      {/* Task Input Card */}
      <div className="w-full max-w-3xl bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Add a New Task</h3>
        <form className="space-y-3">
          <input
            type="text"
            placeholder="Task title"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-white/30"
          />
          <textarea
            placeholder="Describe your task..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-white/30"
            rows={3}
          />
          <button
            type="submit"
            className="w-full bg-blue-600/90 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition"
          >
            Post Task
          </button>
        </form>
      </div>

      {/* Task Feed Placeholder */}
      <div className="w-full max-w-3xl bg-gray-900/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-semibold mb-4">Available Tasks</h3>
        <p className="text-gray-400 text-sm">
          Tasks posted by other users will appear here.
        </p>
      </div>
    </div>
  )
}