"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/context/UserContext";
import { supabase } from "@/lib/SupabaseClient";

export default function DashboardPage() {
  const { user, loaded } = useUser();
  const [username, setUsername] = useState("");
  const [piUid, setPiUid] = useState("");
  const [notifications, setNotifications] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user profile info from Supabase
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("username, pi_uid")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error);
        } else if (data) {
          setUsername(data.username || "Anonymous");
          setPiUid(data.pi_uid || "N/A");
        }
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    if (loaded) fetchProfile();
  }, [user, loaded]);

  // Simulated notifications (you can connect real Supabase data later)
  useEffect(() => {
    setNotifications([
      "Welcome to Yasa Tasker!",
      "Remember to complete your profile details.",
      "Stay tuned for upcoming Pi integration!",
    ]);
  }, []);

  if (!loaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-300">
        Loading your dashboard...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-300">
        You are not logged in.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 flex flex-col items-center p-6">
      <div className="max-w-3xl w-full bg-gray-900 bg-opacity-40 backdrop-blur-md border border-gray-800 rounded-2xl shadow-lg p-6 mt-10">
        <h1 className="text-2xl font-bold mb-4 text-white">Dashboard</h1>

        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-2 text-white">User Profile</h2>
          <p>
            <strong>Username:</strong> {username}
          </p>
          <p>
            <strong>Pi UID:</strong> {piUid}
          </p>
          <p>
            <strong>Email:</strong> {user.email || "No email available"}
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2 text-white">Notifications</h2>
          {notifications.length > 0 ? (
            <ul className="list-disc list-inside">
              {notifications.map((note, index) => (
                <li key={index} className="text-gray-300">
                  {note}
                </li>
              ))}
            </ul>
          ) : (
            <p>No new notifications.</p>
          )}
        </div>
      </div>
    </div>
  );
}