"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import RatingModal from "@/app/components/RatingModal";

interface UserProfile {
  id: string;
  username?: string;
  freelancer_username?: string;
  avatar_url?: string | null;
}

const getErrorMessage = (err: unknown) => {
  return err instanceof Error ? err.message : String(err);
};

export default function RatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");
  const userId = searchParams.get("user");
  const role = searchParams.get("role"); // 'tasker' or 'freelancer'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData.session?.user;
        if (!sessionUser) {
          router.push("/");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", sessionUser.id)
          .single();

        const currentUser = profile || { id: sessionUser.id };
        setUser(currentUser);

        if (!taskId || !userId) {
          setError("Missing task or user information");
          setLoading(false);
          return;
        }

        // Load the user being rated
        const { data: otherUserData, error: otherError } = await supabase
          .from("profiles")
          .select("id, username, freelancer_username, avatar_url")
          .eq("id", userId)
          .single();

        if (otherError || !otherUserData) {
          setError("Could not find user to rate");
          setLoading(false);
          return;
        }

        setOtherUser(otherUserData);

        // Check if already rated
        const { data: existingRating } = await supabase
          .from("ratings")
          .select("id")
          .eq("rater_id", currentUser.id)
          .eq("rated_user_id", userId)
          .eq("task_id", taskId)
          .maybeSingle();

        if (existingRating) {
          // Already rated, redirect to chat or dashboard
          if (role === "tasker") {
            router.push("/dashboard");
          } else {
            router.push(`/chat?task=${taskId}&user=${userId}`);
          }
          return;
        }

        setShowModal(true);
        setLoading(false);
      } catch (err: unknown) {
        setError("Error loading page: " + getErrorMessage(err));
        setLoading(false);
      }
    };

    loadData();
  }, [taskId, userId, role, router]);

  const handleSubmitRating = async (stars: number, comment: string) => {
    if (!user || !otherUser || !taskId) return;

    setSubmitting(true);
    try {
      // Save rating
      const { error: ratingError } = await supabase.from("ratings").insert({
        rater_id: user.id,
        rated_user_id: otherUser.id,
        task_id: taskId,
        rating: stars,
        rating_type: role === "tasker" ? "freelancer" : "tasker",
        comment: comment,
        created_at: new Date().toISOString(),
      });

      if (ratingError) throw ratingError;

      // Update rated user's average rating
      const { data: userRatings } = await supabase
        .from("ratings")
        .select("rating")
        .eq("rated_user_id", otherUser.id);

      if (userRatings && userRatings.length > 0) {
        const avgRating =
          userRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / userRatings.length;

        await supabase
          .from("profiles")
          .update({
            average_rating: parseFloat(avgRating.toFixed(2)),
            total_ratings: userRatings.length,
          })
          .eq("id", otherUser.id);
      }

      setSubmitting(false);
      setShowModal(false);

      // Redirect based on role
      if (role === "tasker") {
        // Tasker rated freelancer, go back to dashboard
        alert("Thank you for rating! Your feedback helps the community.");
        router.push("/dashboard");
      } else {
        // Freelancer rated tasker, go back to chat
        alert("Thank you for rating! Your feedback helps the community.");
        router.push(`/chat?task=${taskId}&user=${otherUser.id}`);
      }
    } catch (err: unknown) {
      setSubmitting(false);
      alert("Failed to submit rating: " + getErrorMessage(err));
    }
  };

  const handleSkip = () => {
    if (role === "tasker") {
      router.push("/dashboard");
    } else {
      router.push(`/chat?task=${taskId}&user=${userId}`);
    }
  };

  if (loading) {
    return (
      <div className="app-background min-h-screen text-white flex items-center justify-center">
        <div className="glass-card p-8">
          <p className="glass-text text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-background min-h-screen text-white flex items-center justify-center">
        <div className="glass-card p-8 max-w-md">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Error</h1>
          <p className="glass-text mb-6">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="glass-button glass-button-primary w-full"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-background min-h-screen text-white flex items-center justify-center">
      <RatingModal
        isOpen={showModal}
        onClose={handleSkip}
        onSubmit={handleSubmitRating}
        otherUserName={otherUser?.freelancer_username || otherUser?.username || "User"}
        loading={submitting}
      />
    </div>
  );
}
