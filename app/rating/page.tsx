"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface TaskDetails {
  id: string;
  title: string;
  budget: number;
  poster_id: string;
  assignee_id?: string;
  status: string;
  payment_status?: string;
}

interface UserProfile {
  id: string;
  username?: string;
  freelancer_username?: string;
}

interface ExistingRating {
  id: string;
  rating: number;
  comment?: string | null;
}

const getErrorMessage = (err: unknown) => {
  return err instanceof Error ? err.message : String(err);
};

export default function RatingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const taskId = searchParams.get("task");
  const role = searchParams.get("role") || "tasker"; // 'tasker' or 'freelancer'

  const [task, setTask] = useState<TaskDetails | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Rating form state
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState("");

  // Check if user already rated
  const [hasRated, setHasRated] = useState(false);
  const [existingRating, setExistingRating] = useState<ExistingRating | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user && taskId) {
      loadTaskAndUsers();
    }
  }, [user, taskId]);

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      setUser(profile || { id: session.user.id });
    } else {
      setError("Please login first");
      setLoading(false);
    }
  };

  const loadTaskAndUsers = async () => {
    try {
      // Load task details
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (taskError || !taskData) {
        setError("Task not found");
        setLoading(false);
        return;
      }

      setTask(taskData);

      let assigneeId = taskData.assignee_id;
      if (!assigneeId) {
        const { data: approvedApplication } = await supabase
          .from("applications")
          .select("applicant_id")
          .eq("task_id", taskId)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        assigneeId = approvedApplication?.applicant_id;
        if (assigneeId) {
          taskData.assignee_id = assigneeId;
        }
      }

      const isTasker = user.id === taskData.poster_id;
      const isFreelancer = user.id === assigneeId;

      if (!isTasker && !isFreelancer) {
        setError("You are not authorized to rate this task");
        setLoading(false);
        return;
      }

      // Determine who to rate (the other party)
      let otherUserId: string;
      if (isTasker) {
        otherUserId = assigneeId;
      } else {
        otherUserId = taskData.poster_id;
      }

      if (!otherUserId) {
        setError("Cannot rate - other party not assigned");
        setLoading(false);
        return;
      }

      // Load other user's profile
      const { data: otherUserData } = await supabase
        .from("profiles")
        .select("id, username, freelancer_username")
        .eq("id", otherUserId)
        .single();

      if (otherUserData) {
        setOtherUser(otherUserData);
      }

      // Check if user already rated
      const { data: existingRatingData } = await supabase
        .from("ratings")
        .select("*")
        .eq("task_id", taskId)
        .eq("rater_id", user.id)
        .single();

      if (existingRatingData) {
        setHasRated(true);
        setExistingRating(existingRatingData);
        setRating(existingRatingData.rating);
        setComment(existingRatingData.comment || "");
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("Failed to load rating data");
      setLoading(false);
    }
  };

  const handleSubmitRating = async () => {
    if (!task || !user || !otherUser) {
      setError("Missing required information");
      return;
    }

    if (!comment.trim()) {
      setError("Please provide a comment");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const ratingData = {
        task_id: taskId,
        rater_id: user.id,
        rated_user_id: otherUser.id,
        rating: rating,
        rating_type: task.poster_id === user.id ? "freelancer" : "tasker",
        comment: comment.trim(),
        created_at: new Date().toISOString(),
      };

      if (hasRated && existingRating) {
        // Update existing rating
        const { error: updateError } = await supabase
          .from("ratings")
          .update({
            rating: rating,
            comment: comment.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRating.id);

        if (updateError) throw updateError;
      } else {
        // Insert new rating
        const { error: insertError } = await supabase
          .from("ratings")
          .insert([ratingData]);

        if (insertError) throw insertError;
      }

      // Check if both parties have rated
      const { data: allRatings } = await supabase
        .from("ratings")
        .select("rater_id")
        .eq("task_id", taskId);

      const hasTaskerRated = allRatings?.some(r => r.rater_id === task?.poster_id);
      const hasFreelancerRated = allRatings?.some(r => r.rater_id === task?.assignee_id);

      // If both have rated and task is not completed, mark as completed
      if (hasTaskerRated && hasFreelancerRated && task.status !== "completed") {
        await supabase
          .from("tasks")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", taskId);

        // Send completion notification to both parties
        await Promise.all([
          supabase.from("notifications").insert({
            user_id: task.poster_id,
            type: "task_completed",
            message: `Task "${task.title}" has been completed. Both ratings have been submitted.`,
            related_task_id: taskId,
            read: false,
          }),
          supabase.from("notifications").insert({
            user_id: task.assignee_id,
            type: "task_completed",
            message: `Task "${task.title}" has been completed. Both ratings have been submitted.`,
            related_task_id: taskId,
            read: false,
          }),
        ]);
      }

      setSuccess(true);
      
      // Redirect after a short delay
      setTimeout(() => {
        if (role === "tasker") {
          router.push(`/dashboard`);
        } else {
          router.push(`/dashboard`);
        }
      }, 2000);

    } catch (err: unknown) {
      console.error("Rating submission error:", err);
      setError(getErrorMessage(err) || "Failed to submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  const getStarRating = () => {
    return (
      <div className="flex gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => !hasRated && setRating(star)}
            className={`text-3xl transition ${star <= rating ? "text-yellow-400" : "text-white/20"} ${
              hasRated ? "cursor-default" : "hover:scale-110"
            }`}
            disabled={hasRated}
          >
            ★
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen glass-dark flex items-center justify-center">
        <div className="glass-card p-8">
          <div className="glass-loading mx-auto mb-4"></div>
          <p className="glass-text-accent">Loading rating details...</p>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="min-h-screen glass-dark flex items-center justify-center">
        <div className="glass-card p-8 max-w-md">
          <div className="text-4xl mb-4 text-center">⚠️</div>
          <h2 className="text-xl font-bold text-red-400 mb-4 text-center">Error</h2>
          <p className="glass-text mb-6">{error}</p>
          <Link href="/dashboard" className="glass-button glass-button-primary w-full block text-center">
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen glass-dark app-background">
      {/* Header */}
      <div className="glass-nav sticky top-0 z-50 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/dashboard" className="text-xl">← Dashboard</Link>
          <h1 className="text-lg font-bold">Rate {role === "tasker" ? "Freelancer" : "Tasker"}</h1>
          <div className="w-8"></div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 pt-8">
        {/* Task Summary */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-sm glass-text-accent mb-2">Task</h2>
          <p className="text-lg font-semibold glass-text mb-4">{task?.title}</p>
          <div className="flex justify-between text-sm">
            <span className="glass-text-muted">Budget:</span>
            <span className="glass-text">{task?.budget} π</span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="glass-text-muted">{role === "tasker" ? "Freelancer:" : "Tasker:"}</span>
            <span className="glass-text">
              {otherUser?.freelancer_username || otherUser?.username || "Unknown"}
            </span>
          </div>
        </div>

        {/* Rating Form */}
        <div className="glass-card p-6 mb-6">
          <h2 className="text-lg font-semibold glass-text-accent mb-6 text-center">
            {hasRated ? "Your Rating" : `Rate ${role === "tasker" ? "Freelancer" : "Tasker"}`}
          </h2>

          {/* Star Rating */}
          <div className="mb-6">
            {getStarRating()}
            <p className="text-center glass-text-muted text-sm mt-2">
              {rating === 5 && "Excellent!"}
              {rating === 4 && "Very Good"}
              {rating === 3 && "Good"}
              {rating === 2 && "Fair"}
              {rating === 1 && "Poor"}
            </p>
          </div>

          {/* Comment Field */}
          <div className="mb-6">
            <label className="block glass-text-accent text-sm mb-2">
              {hasRated ? "Your Comment" : "Write a comment"}
            </label>
            <textarea
              value={comment}
              onChange={(e) => !hasRated && setComment(e.target.value)}
              disabled={hasRated}
              placeholder={hasRated ? "" : "Share your experience working together..."}
              className="glass-input w-full h-32 resize-none"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <p className="text-red-400 text-sm">⚠️ {error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
              <p className="text-green-400 text-sm font-semibold">✅ Rating submitted successfully!</p>
              <p className="text-green-400/70 text-xs mt-1">Redirecting to dashboard...</p>
            </div>
          )}

          {/* Submit Button */}
          {!hasRated && !success && (
            <button
              onClick={handleSubmitRating}
              disabled={submitting || !comment.trim()}
              className="glass-button glass-button-primary w-full py-3 disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="glass-loading w-5 h-5"></span>
                  Submitting...
                </span>
              ) : (
                "Submit Rating"
              )}
            </button>
          )}

          {/* Already Rated Message */}
          {hasRated && !success && (
            <div className="text-center">
              <p className="glass-text-accent text-sm mb-4">
                You have already rated this {role === "tasker" ? "freelancer" : "tasker"}
              </p>
              <Link
                href="/dashboard"
                className="glass-button glass-button-primary w-full block"
              >
                Go to Dashboard
              </Link>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="glass-card p-4 border-white/5">
          <p className="text-xs glass-text-muted text-center">
            Ratings help build trust in the Yasa Tasker community.
            <br />
            Both parties must rate before the task is fully completed.
          </p>
        </div>
      </div>
    </div>
  );
}
