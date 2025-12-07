"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/app/components/Sidebar";
import ApplicationModal, { ApplicationFormData } from "@/app/components/ApplicationModal";
import ApplicationReviewModal from "@/app/components/ApplicationReviewModal";
import { sendApprovalNotification, sendDenialNotification, sendApplicationNotification } from "@/app/utils/notificationHelpers";

interface Task {
  id: string;
  poster_id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  deadline: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  freelancer_username?: string;
  rating?: number;
  completed_tasks?: number;
  average_rating?: number;
  total_ratings?: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState({
    id: "",
    title: "",
    description: "",
    category: "",
    budget: "",
    deadline: "",
  });
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);

  const [freelancerUsername, setFreelancerUsername] = useState("");

  // New state for features
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPictureModal, setShowPictureModal] = useState(false);
  const [showRatingsPage, setShowRatingsPage] = useState(false);
  const [profileTasks, setProfileTasks] = useState({ active: [], pending: [], completed: [] });
  const [userApplications, setUserApplications] = useState<any[]>([]);
  const [userRatings, setUserRatings] = useState<any[]>([]);
  
  // Picture modal state
  const [pictureToEdit, setPictureToEdit] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [cropScale, setCropScale] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const pictureInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Profile view state
  const [profileView, setProfileView] = useState<"tasker" | "freelancer">("tasker");

  // Application modal state
  const [showApplicationModal, setShowApplicationModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [applicationForm, setApplicationForm] = useState<ApplicationFormData>({
    name: "",
    skills: "",
    experience: "",
    description: "",
  });

  // Application review state
  const [showApplicationReview, setShowApplicationReview] = useState(false);
  const [reviewTaskId, setReviewTaskId] = useState<string | null>(null);
  const [taskApplications, setTaskApplications] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Notifications state
  const [notificationCount, setNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  const handleContactTasker = async (task: Task) => {
    if (!user?.id) {
      setMessage("⚠️ You must be logged in to contact a tasker.");
      return;
    }

    if (!task.poster_id) {
      setMessage("⚠️ Unable to contact tasker. Please try again.");
      return;
    }

    router.push("/chat?user=" + task.poster_id);
  };

  // 🔥 FIXED: Load profile
  const loadProfile = async (authUserId: string | null) => {
    if (!authUserId) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUserId)
      .single();

    if (!error) {
      setUser(data);
      setLoading(false);
      // Load notification count
      await loadNotificationCount(authUserId);
      await loadMessageCount(authUserId);
    }
  };

  // Load notification count
  const loadNotificationCount = async (userId: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .eq("read", false);
    
    setNotificationCount(data?.length || 0);
  };

  // Load message count (conversations with unread messages)
  const loadMessageCount = async (userId: string) => {
    const { data: received } = await supabase
      .from("messages")
      .select("sender_id")
      .eq("receiver_id", userId)
      .eq("read", false);
    
    // Count unique senders with unread messages (conversations with new messages)
    const uniqueSenders = new Set(received?.map((msg) => msg.sender_id) || []);
    setMessageCount(uniqueSenders.size);
  };

  // 🔥 FIXED — prevents double login & ensures correct session flow + session persistence on refresh
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // 1️⃣ Check Supabase session first
      const { data } = await supabase.auth.getSession();

      if (data.session?.user) {
        await loadProfile(data.session.user.id);
        return;
      }

      // 2️⃣ Localhost → use fake Pi user but still call API
      const isLocal = window.location.hostname === "localhost";
      let piUser;

      if (isLocal) {
        console.log("🔧 Local mode: Using fake Pi user");
        piUser = {
          uid: "local_user_123",
          username: "LocalUser",
        };
      } else {
        // 3️⃣ PRODUCTION → use real Pi SDK
        const pi = (window as any).Pi;
        if (!pi) {
          setMessage("Pi SDK not found");
          setLoading(false);
          return;
        }

        const authResult = await pi.authenticate(["username"], (p) => p);
        piUser = authResult.user;
      }

      // 4️⃣ Exchange tokens via API (works for both localhost and production)
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: piUser.username,
          pi_uid: piUser.uid,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        setMessage("Login error: " + json.error);
        setLoading(false);
        return;
      }

      // 5️⃣ Save session with proper format
      console.log("🔐 Setting session with tokens:", {
        access_token: json.access_token?.substring(0, 20) + "...",
        refresh_token: json.refresh_token?.substring(0, 20) + "...",
      });

      const { error: setErr } = await supabase.auth.setSession({
        access_token: json.access_token,
        refresh_token: json.refresh_token,
      });

      if (setErr) {
        console.error("❌ Session error:", setErr);
        console.error("Full error details:", JSON.stringify(setErr));
        setMessage("Session error: " + setErr.message);
        setLoading(false);
        return;
      }

      console.log("✅ Session set successfully");

      // 6️⃣ Wait a moment for session to persist, then load profile
      await new Promise((resolve) => setTimeout(resolve, 500));
      await loadProfile(json.user.id);
    };

    init();
  }, []);

  // Fetch tasks
  const fetchTasks = async () => {
    if (!user?.id) return;

    let q = supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (filter !== "all") q = q.eq("category", filter);

    const { data, error } = await q;
    
    if (!error && data) {
      // Show all tasks - user can edit/delete their own, or apply to others
      setTasks(data);
    }
  };

  useEffect(() => {
    if (user) fetchTasks();
  }, [filter, user]);

  // Subscribe to real-time task changes
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel("tasks:all")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          console.log("✅ New task inserted:", payload.new);
          // Add new task to the top of the list immediately
          setTasks((prev) => [payload.new as Task, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          console.log("✅ Task updated:", payload.new);
          // Update the task in the list
          setTasks((prev) =>
            prev.map((t) => (t.id === payload.new.id ? (payload.new as Task) : t))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "tasks",
        },
        (payload) => {
          console.log("✅ Task deleted:", payload.old);
          // Remove the task from the list
          setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    // Polling fallback every 2 seconds as backup (since realtime might not be working)
    const pollInterval = setInterval(() => {
      console.log("Polling tasks for updates...");
      fetchTasks();
    }, 2000);

    return () => {
      subscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [user?.id, filter]);

  // Refresh notification and message count periodically
  useEffect(() => {
    if (!user?.id) return;

    // Refresh notification and message count every 3 seconds
    const interval = setInterval(() => {
      loadNotificationCount(user.id);
      loadMessageCount(user.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    if (user && showProfileModal) {
      // Reload profile tasks when modal opens or view changes
      loadProfileTasks();
      // Also reload after a short delay to catch any pending updates
      const timer = setTimeout(() => {
        loadProfileTasks();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [profileView, showProfileModal, user]);

  // Subscribe to real-time changes in tasks and applications
  useEffect(() => {
    if (!user?.id || !showProfileModal) return;

    const subscriptions: any[] = [];

    if (profileView === "tasker") {
      // Tasker: Subscribe to own tasks
      const tasksSubscription = supabase
        .channel(`tasks:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter: `poster_id=eq.${user.id}`,
          },
          () => {
            loadProfileTasks();
          }
        )
        .subscribe();
      subscriptions.push(tasksSubscription);
    } else {
      // Freelancer: Subscribe to application changes AND all task changes
      const appsSubscription = supabase
        .channel(`applications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "applications",
            filter: `applicant_id=eq.${user.id}`,
          },
          () => {
            loadProfileTasks();
          }
        )
        .subscribe();
      subscriptions.push(appsSubscription);

      // Also subscribe to ALL task changes (to catch status updates)
      const tasksSubscription = supabase
        .channel(`tasks:all`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tasks",
          },
          () => {
            loadProfileTasks();
          }
        )
        .subscribe();
      subscriptions.push(tasksSubscription);
    }

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
  }, [user?.id, showProfileModal, profileView]);

  // Post / update task
  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (!user?.id) {
      setMessage("⚠️ You must be logged in to post a task.");
      return;
    }

    if (
      !form.title ||
      !form.description ||
      !form.category ||
      !form.budget ||
      !form.deadline
    ) {
      setMessage("⚠️ Please fill in all fields.");
      return;
    }

    const deadlineIso = new Date(form.deadline).toISOString();

    // Generate UUID for new tasks
    const generateUUID = () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    const taskData = {
      id: form.id || generateUUID(), // Generate UUID if new task
      poster_id: user.id,
      title: form.title,
      description: form.description,
      category: form.category,
      budget: parseFloat(form.budget),
      deadline: deadlineIso,
      status: "open",
      updated_at: new Date().toISOString(),
    };

    console.log("📝 Submitting task with data:", taskData);
    console.log("👤 Current user ID:", user.id);

    let result;
    if (form.id) {
      result = await supabase
        .from("tasks")
        .update(taskData)
        .eq("id", form.id)
        .select();
    } else {
      result = await supabase.from("tasks").insert([taskData]).select();
    }

    if (result.error) {
      console.error("❌ Task save error:", result.error);
      console.error("Full error details:", JSON.stringify(result.error, null, 2));
      setMessage(
        "❌ Failed to save task: " +
          (result.error.message || result.error.code || JSON.stringify(result.error))
      );
      return;
    }

    console.log("✅ Task saved successfully:", result.data);
    setMessage("✅ Task posted!");
    setForm({
      id: "",
      title: "",
      description: "",
      category: "",
      budget: "",
      deadline: "",
    });
    fetchTasks();
    loadProfileTasks();
  };

  const handleEdit = (task: Task) => {
    setForm({
      id: task.id,
      title: task.title,
      description: task.description,
      category: task.category,
      budget: String(task.budget),
      deadline: task.deadline.split("T")[0],
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("tasks").delete().eq("id", id);
    fetchTasks();
    loadProfileTasks();
  };
  // Load profile tasks and applications
  const loadProfileTasks = async () => {
    if (!user?.id) return;

    if (profileView === "tasker") {
      // Load user's posted tasks grouped by status
      const { data: tasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("poster_id", user.id);

      if (tasks) {
        const active = tasks.filter((t) => t.status === "active");
        const pending = tasks.filter((t) => t.status === "open");
        const completed = tasks.filter((t) => t.status === "completed");
        setProfileTasks({ active, pending, completed });
      }
    } else {
      // FREELANCER VIEW: Load tasks I applied to, grouped by task status (same as tasker)
      const { data: apps } = await supabase
        .from("applications")
        .select("task_id, status")
        .eq("applicant_id", user.id);

      if (apps && apps.length > 0) {
        const taskIds = apps.map((app) => app.task_id);
        const { data: tasks } = await supabase
          .from("tasks")
          .select("*")
          .in("id", taskIds);

        if (tasks) {
          // Filter by task status only (same as tasker view)
          const active = tasks.filter((t) => t.status === "active");
          const pending = tasks.filter((t) => t.status === "open");
          const completed = tasks.filter((t) => t.status === "completed");
          setProfileTasks({ active, pending, completed });
        }
      } else {
        setProfileTasks({ active: [], pending: [], completed: [] });
      }
    }
  };

  // Load user ratings
  const loadUserRatings = async () => {
    if (!user?.id) return;

    const { data: ratings } = await supabase
      .from("ratings")
      .select("*, rater:profiles(username, avatar_url)")
      .eq("rated_user_id", user.id)
      .order("created_at", { ascending: false });

    if (ratings) {
      setUserRatings(ratings);
      console.log("✅ Ratings loaded:", ratings.length);
      
      // Calculate averages by rating type
      const taskerRatings = ratings.filter((r) => r.rating_type === "tasker");
      const freelancerRatings = ratings.filter((r) => r.rating_type === "freelancer");
      
      const taskerAvg = taskerRatings.length > 0
        ? (taskerRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / taskerRatings.length).toFixed(2)
        : 0;
      
      const freelancerAvg = freelancerRatings.length > 0
        ? (freelancerRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / freelancerRatings.length).toFixed(2)
        : 0;
      
      const overallAvg = ((parseFloat(taskerAvg as any) + parseFloat(freelancerAvg as any)) / 2).toFixed(2);
      
      console.log("📊 Rating breakdown:", { taskerAvg, freelancerAvg, overallAvg });
    }
  };

  // Subscribe to rating changes
  useEffect(() => {
    if (!user?.id || !showProfileModal) return;

    const subscription = supabase
      .channel(`ratings:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ratings",
          filter: `rated_user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("New rating received:", payload.new);
          loadUserRatings();
          // Also reload profile to get updated average_rating and total_ratings
          loadProfile(user.id);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, showProfileModal]);

  // Open application modal
  const handleApplyToTask = (taskId: string) => {
    if (!user?.id) {
      setMessage("⚠️ You must be logged in to apply.");
      return;
    }
    setSelectedTaskId(taskId);
    setApplicationForm({ name: "", skills: "", experience: "", description: "" });
    setShowApplicationModal(true);
  };

  // Submit application
  const handleSubmitApplication = async (form: ApplicationFormData) => {
    // Prevent duplicate submissions
    if (isSubmittingApplication) {
      console.warn("⚠️ Application already being submitted");
      return;
    }

    if (!user?.id || !selectedTaskId) {
      setMessage("⚠️ Error: Missing user or task information.");
      return;
    }

    if (
      !form.name ||
      !form.skills ||
      !form.experience ||
      !form.description
    ) {
      setMessage("⚠️ Please fill in all application form fields.");
      return;
    }

    setIsSubmittingApplication(true);

    // Generate UUID for applications
    const generateUUID = () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };

    const appId = generateUUID();
    const { error } = await supabase.from("applications").insert([
      {
        id: appId,
        task_id: selectedTaskId,
        applicant_id: user.id,
        applicant_name: form.name,
        applicant_skills: form.skills,
        applicant_experience: form.experience,
        applicant_description: form.description,
        status: "pending",
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      setMessage("❌ Failed to apply: " + error.message);
    } else {
      // Get task details to send notification to tasker
      const { data: taskData } = await supabase
        .from("tasks")
        .select("poster_id, title")
        .eq("id", selectedTaskId)
        .single();
      
      if (taskData) {
        console.log("📋 Sending notification to tasker:", taskData.poster_id);
        await sendApplicationNotification(supabase, taskData.poster_id, selectedTaskId, appId, taskData.title, form.name);
      } else {
        console.warn("⚠️ Could not find task details for notification");
      }
      
      setMessage("✅ Application submitted!");
      setShowApplicationModal(false);
      setApplicationForm({ name: "", skills: "", experience: "", description: "" });
      setSelectedTaskId(null);
      loadProfileTasks();
    }
    setIsSubmittingApplication(false);
  };

  // Open application review modal
  const handleReviewApplications = async (taskId: string) => {
    setReviewTaskId(taskId);
    setReviewLoading(true);
    const { data } = await supabase
      .from("applications")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    setTaskApplications(data || []);
    setReviewLoading(false);
    setShowApplicationReview(true);
  };

  // Approve application
  const handleApproveApplication = async (applicationId: string, applicantId: string) => {
  setReviewLoading(true);
  
  // Get application data to find task_id
  const { data: appData } = await supabase
    .from("applications")
    .select("task_id")
    .eq("id", applicationId)
    .single();

  const taskId = appData?.task_id || reviewTaskId;

  const { error } = await supabase
    .from("applications")
    .update({ status: "approved" })
    .eq("id", applicationId);

  if (error) {
    setMessage("❌ Failed to approve: " + error.message);
  } else {
    setMessage("✅ Application approved!");
    
    // Get task title for notification
    const { data: taskData } = await supabase
      .from("tasks")
      .select("title")
      .eq("id", taskId)
      .single();

    // Send notification to freelancer
    if (taskData) {
      console.log("📬 Sending approval notification to freelancer:", applicantId);
      await sendApprovalNotification(
        supabase,
        applicantId,
        taskId,
        applicationId,
        taskData.title
      );
    }

    // Send system message to chat
    if (user?.id && taskId) {
      const systemMessage = {
        sender_id: user.id,
        receiver_id: applicantId,
        text: "✅ Application approved - chat started",
        created_at: new Date().toISOString(),
      };
      await supabase.from("messages").insert([systemMessage]);
    }

    // Refresh applications list
    if (taskId) {
      const { data } = await supabase
        .from("applications")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      setTaskApplications(data || []);
      
      // Update task status to active
      await supabase
        .from("tasks")
        .update({ status: "active" })
        .eq("id", reviewTaskId);
    }
    
    loadProfileTasks();
    router.push(`/chat?user=${applicantId}`);
  }
  setReviewLoading(false);
};

// Deny application
const handleDenyApplication = async (applicationId: string) => {
  setReviewLoading(true);
  
  // Get application details for notification
  const { data: appData } = await supabase
    .from("applications")
    .select("applicant_id, task_id")
    .eq("id", applicationId)
    .single();

  const taskId = appData?.task_id || reviewTaskId;

  const { error } = await supabase
    .from("applications")
    .update({ status: "denied" })
    .eq("id", applicationId);

  if (error) {
    setMessage("❌ Failed to deny: " + error.message);
  } else {
    setMessage("✅ Application denied!");
    
    // Get task title for notification
    const { data: taskData } = await supabase
      .from("tasks")
      .select("title")
      .eq("id", taskId)
      .single();

    if (appData && taskData) {
      console.log("📬 Sending denial notification to freelancer:", appData.applicant_id);
      await sendDenialNotification(
        supabase,
        appData.applicant_id,
        taskId,
        applicationId,
        taskData.title
      );
    }

    // Refresh applications list
    if (taskId) {
      const { data } = await supabase
        .from("applications")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      setTaskApplications(data || []);
    }
    
    loadProfileTasks();
  }
  setReviewLoading(false);
};

// Update freelancer username
const handleUpdateFreelancerUsername = async () => {
  if (!user?.id || !freelancerUsername.trim()) {
    setMessage("⚠️ Please enter a valid freelancer username.");
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ freelancer_username: freelancerUsername })
    .eq("id", user.id);

  if (error) {
    setMessage("❌ Failed to update username: " + error.message);
  } else {
    setUser({ ...user, freelancer_username: freelancerUsername });
    setFreelancerUsername("");
    setMessage("✅ Freelancer username updated!");
  }
};

  const categories = [
    "all",
    "design",
    "writing",
    "development",
    "marketing",
    "translation",
    "other",
  ];

  // ⭐️ UI WITH SIDEBAR
  return (
    <div className="min-h-screen bg-[#000222] text-white flex flex-col items-center px-4 py-10">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        notificationCount={notificationCount}
        messageCount={messageCount}
      />
      
      {/* Navigation Bar */}
      <div className="w-full max-w-3xl mb-4 flex justify-between items-center">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="relative px-4 py-2 bg-gray-600/80 hover:bg-gray-700 rounded-lg transition text-sm"
        >
          ☰ Menu
          {notificationCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>
      </div>
      <div
        onClick={() => {
          if (user?.id) {
            loadProfileTasks();
            loadUserRatings();
            setShowProfileModal(true);
          }
        }}
        className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 text-center mb-6 cursor-pointer hover:bg-white/20 transition"
      >
        {loading ? (
          <p>Loading profile...</p>
        ) : user ? (
          <div className="flex flex-col items-center space-y-2">
            <img
              src={
                user.avatar_url ||
                `https://api.dicebear.com/8.x/thumbs/svg?seed=${user.username}`
              }
              alt="Avatar"
              className="w-20 h-20 rounded-full border border-white/30 object-cover"
            />
            <h2 className="text-xl font-semibold">{user.username}</h2>
            <p className="text-sm text-gray-300">
              ⭐️ {user.rating || 0} • {user.completed_tasks || 0} Tasks Completed
            </p>
            <p className="text-xs text-gray-400">Click to view profile details</p>
          </div>
        ) : (
          <p>⚠️ Please log in with Pi to view your profile.</p>
        )}
      </div>

      {/* PROFILE MODAL */}
      {showProfileModal && user && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{user.username}'s Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Avatar Section */}
            <div className="flex flex-col items-center mb-6 pb-6 border-b border-white/10">
              <button
                onClick={() => setShowPictureModal(true)}
                className="cursor-pointer group relative mb-4"
              >
                <img
                  src={
                    user.avatar_url ||
                    `https://api.dicebear.com/8.x/thumbs/svg?seed=${user.username}`
                  }
                  alt="Avatar"
                  className="w-24 h-24 rounded-full border border-white/30 object-cover group-hover:opacity-70 transition"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-full bg-black/50">
                  <span className="text-white text-xs font-semibold">View</span>
                </div>
              </button>
              <div className="flex flex-col gap-3 w-full">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Freelancer Username (what others see)</label>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="text"
                      placeholder="Your freelancer username"
                      value={freelancerUsername || user.freelancer_username || ""}
                      onChange={(e) => setFreelancerUsername(e.target.value)}
                      className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 caret-white pointer-events-auto"
                    />
                    <button
                      onClick={handleUpdateFreelancerUsername}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm flex-shrink-0 whitespace-nowrap"
                    >
                      Update
                    </button>
                  </div>
                  {user.freelancer_username && (
                    <p className="text-xs text-green-400 mt-1">✓ Current: {user.freelancer_username}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                ⭐️ Rating: {user.average_rating && user.average_rating > 0 ? `${user.average_rating}/5 (${user.total_ratings || 0} ratings)` : "No ratings yet"} • Completed: {user.completed_tasks || 0}
              </p>
            </div>

            {/* Profile View Tabs */}
            <div className="flex gap-2 mb-6 border-b border-white/10">
              <button
                onClick={() => setProfileView("tasker")}
                className={`px-4 py-2 font-semibold transition ${
                  profileView === "tasker"
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                👤 Tasker View
              </button>
              <button
                onClick={() => setProfileView("freelancer")}
                className={`px-4 py-2 font-semibold transition ${
                  profileView === "freelancer"
                    ? "text-green-400 border-b-2 border-green-400"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                💼 Freelancer View
              </button>
            </div>

            {/* Tasks Sections */}
            <div className="space-y-6">
              {/* Active Tasks */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-green-400">Active Tasks ({profileTasks.active.length})</h3>
                {profileTasks.active.length === 0 ? (
                  <p className="text-gray-400 text-sm">No active tasks</p>
                ) : (
                  <div className="space-y-2">
                    {profileTasks.active.map((task) => (
                      <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <p className="font-semibold text-sm">{task.title}</p>
                        <p className="text-xs text-gray-400">
                          Budget: {task.budget} π
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Tasks */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-yellow-400">Pending Tasks ({profileTasks.pending.length})</h3>
                {profileTasks.pending.length === 0 ? (
                  <p className="text-gray-400 text-sm">No pending tasks</p>
                ) : (
                  <div className="space-y-2">
                    {profileTasks.pending.map((task) => (
                      <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <p className="font-semibold text-sm">{task.title}</p>
                        <p className="text-xs text-gray-400">
                          Budget: {task.budget} π
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Completed Tasks */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-blue-400">Completed Tasks ({profileTasks.completed.length})</h3>
                {profileTasks.completed.length === 0 ? (
                  <p className="text-gray-400 text-sm">No completed tasks</p>
                ) : (
                  <div className="space-y-2">
                    {profileTasks.completed.map((task) => (
                      <div key={task.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                        <p className="font-semibold text-sm">{task.title}</p>
                        <p className="text-xs text-gray-400">
                          Budget: {task.budget} π
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ratings Section - Show only relevant rating type based on view */}
            <div className="mt-8 pt-6 border-t border-white/10">
              {profileView === "tasker" ? (
                // TASKER VIEW - Show only tasker ratings
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">⭐ Tasker Ratings</h3>
                    {(() => {
                      const taskerRatings = userRatings.filter((r) => r.rating_type === "tasker");
                      return taskerRatings.length > 0 ? (
                        <button
                          onClick={() => setShowRatingsPage(true)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition"
                        >
                          View All ({taskerRatings.length})
                        </button>
                      ) : null;
                    })()}
                  </div>
                  {(() => {
                    const taskerRatings = userRatings.filter((r) => r.rating_type === "tasker");
                    if (taskerRatings.length === 0) {
                      return <p className="text-sm text-gray-400">No tasker ratings yet. Complete tasks to receive ratings!</p>;
                    }
                    const rating = taskerRatings[0];
                    return (
                      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-yellow-400">{"⭐".repeat(rating.rating || 0)}</span>
                          <span className="text-sm font-semibold">{rating.rater?.username || "Anonymous"}</span>
                        </div>
                        {rating.comment && (
                          <p className="text-sm text-gray-300 italic">"{rating.comment}"</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(rating.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                // FREELANCER VIEW - Show only freelancer ratings
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">⭐ Freelancer Ratings</h3>
                    {(() => {
                      const freelancerRatings = userRatings.filter((r) => r.rating_type === "freelancer");
                      return freelancerRatings.length > 0 ? (
                        <button
                          onClick={() => setShowRatingsPage(true)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition"
                        >
                          View All ({freelancerRatings.length})
                        </button>
                      ) : null;
                    })()}
                  </div>
                  {(() => {
                    const freelancerRatings = userRatings.filter((r) => r.rating_type === "freelancer");
                    if (freelancerRatings.length === 0) {
                      return <p className="text-sm text-gray-400">No freelancer ratings yet. Complete tasks to receive ratings!</p>;
                    }
                    const rating = freelancerRatings[0];
                    return (
                      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-yellow-400">{"⭐".repeat(rating.rating || 0)}</span>
                          <span className="text-sm font-semibold">{rating.rater?.username || "Anonymous"}</span>
                        </div>
                        {rating.comment && (
                          <p className="text-sm text-gray-300 italic">"{rating.comment}"</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(rating.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* APPLICATION MODAL */}
      <ApplicationModal
        isOpen={showApplicationModal}
        onClose={() => setShowApplicationModal(false)}
        onSubmit={handleSubmitApplication}
        formData={applicationForm}
        onFormChange={setApplicationForm}
      />

      {/* APPLICATION REVIEW MODAL */}
      <ApplicationReviewModal
        isOpen={showApplicationReview}
        onClose={() => setShowApplicationReview(false)}
        applications={taskApplications}
        onApprove={handleApproveApplication}
        onDeny={handleDenyApplication}
        loading={reviewLoading}
      />

      {/* RATINGS PAGE MODAL */}
      {showRatingsPage && user && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">All Ratings ({userRatings.length})</h2>
              <button
                onClick={() => setShowRatingsPage(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {userRatings && userRatings.length > 0 ? (
              <div className="space-y-6">
                {/* Tasker Ratings Section */}
                <div>
                  <h3 className="text-lg font-semibold text-purple-400 mb-4">👤 Tasker Ratings</h3>
                  {(() => {
                    const taskerRatings = userRatings.filter((r) => r.rating_type === "tasker");
                    if (taskerRatings.length === 0) {
                      return <p className="text-sm text-gray-500">No tasker ratings yet</p>;
                    }
                    return (
                      <div className="space-y-3">
                        {taskerRatings.map((rating, index) => (
                          <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={
                                    rating.rater?.avatar_url ||
                                    `https://api.dicebear.com/8.x/thumbs/svg?seed=${rating.rater?.username || "user"}`
                                  }
                                  alt={rating.rater?.username}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                                <div>
                                  <p className="font-semibold text-sm">{rating.rater?.username || "Anonymous"}</p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(rating.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-yellow-400 text-lg">
                                {"⭐".repeat(rating.rating || 0)}
                              </div>
                            </div>
                            {rating.comment && (
                              <p className="text-sm text-gray-300 italic">"{rating.comment}"</p>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Freelancer Ratings Section */}
                <div>
                  <h3 className="text-lg font-semibold text-green-400 mb-4">💼 Freelancer Ratings</h3>
                  {(() => {
                    const freelancerRatings = userRatings.filter((r) => r.rating_type === "freelancer");
                    if (freelancerRatings.length === 0) {
                      return <p className="text-sm text-gray-500">No freelancer ratings yet</p>;
                    }
                    return (
                      <div className="space-y-3">
                        {freelancerRatings.map((rating, index) => (
                          <div key={index} className="bg-white/5 border border-white/10 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <img
                                  src={
                                    rating.rater?.avatar_url ||
                                    `https://api.dicebear.com/8.x/thumbs/svg?seed=${rating.rater?.username || "user"}`
                                  }
                                  alt={rating.rater?.username}
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                                <div>
                                  <p className="font-semibold text-sm">{rating.rater?.username || "Anonymous"}</p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(rating.created_at).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-yellow-400 text-lg">
                                {"⭐".repeat(rating.rating || 0)}
                              </div>
                            </div>
                            {rating.comment && (
                              <p className="text-sm text-gray-300 italic">"{rating.comment}"</p>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-400">No ratings yet</p>
            )}
          </div>
        </div>
      )}

      {/* EVERYTHING BELOW IS IDENTICAL — tasks, forms, filters, etc */}
      {/* (I DID NOT TOUCH YOUR UI) */}

      {/* POST TASK FORM */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">
          {form.id ? "Edit Task" : "Post a Task"}
        </h2>
        {message && <p className="text-sm text-gray-300 mb-3">{message}</p>}
        <form
          onSubmit={handleSubmit}
          className="space-y-3 relative z-10 pointer-events-auto"
        >
          <input
            type="text"
            placeholder="Task title"
            value={form.title}
            onChange={(e) =>
              setForm({ ...form, title: e.target.value })
            }
            autoComplete="off"
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 caret-white pointer-events-auto"
          />
          <textarea
            placeholder="Task description"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 caret-white pointer-events-auto"
            rows={3}
          />
          <select
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pointer-events-auto"
          >
            <option value="">Select a category</option>
            {categories.filter(cat => cat !== "all").map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Budget (in π)"
            value={form.budget || ""}
            onChange={(e) =>
              setForm({ ...form, budget: e.target.value ? parseFloat(e.target.value) : "" })
            }
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 caret-white pointer-events-auto"
          />
          <input
            type="date"
            value={form.deadline}
            onChange={(e) =>
              setForm({ ...form, deadline: e.target.value })
            }
            className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pointer-events-auto"
          />

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg transition"
          >
            {form.id ? "Update Task" : "Post Task"}
          </button>
        </form>
      </div>

      {/* TASK LIST — unchanged */}
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Available Tasks</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1 text-sm"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {tasks.length === 0 ? (
          <p className="text-gray-400 text-sm">No tasks found.</p>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">{task.title}</h3>
                  <p className="text-gray-300 text-sm mb-2">
                    {task.description}
                  </p>
                  <p className="text-xs text-gray-400">
                    Category: {task.category} • Budget: {task.budget} π •
                    Deadline:{" "}
                    {new Date(task.deadline).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2 mt-3 sm:mt-0 flex-wrap sm:flex-nowrap">
                  {user?.id === task.poster_id ? (
                    <>
                      <button
                        onClick={() => handleEdit(task)}
                        className="px-3 py-1 bg-blue-500/80 rounded-md text-sm hover:bg-blue-600 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="px-3 py-1 bg-red-500/80 rounded-md text-sm hover:bg-red-600 transition"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleApplyToTask(task.id)}
                      className="px-3 py-1 bg-green-600/80 rounded-md text-sm hover:bg-green-700 transition"
                    >
                      Apply
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PICTURE MODAL */}
      {showPictureModal && user && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 flex flex-col items-center">
            <button
              onClick={() => {
                setShowPictureModal(false);
                setPictureToEdit(null);
                setCropMode(false);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl"
            >
              ✕
            </button>

            {!cropMode ? (
              <>
                <img
                  src={
                    pictureToEdit ||
                    user.avatar_url ||
                    `https://api.dicebear.com/8.x/thumbs/svg?seed=${user.username}`
                  }
                  alt="Profile Picture"
                  className="w-48 h-48 rounded-full border-2 border-white/30 mb-6 object-cover"
                />
                <button
                  onClick={() => pictureInputRef.current?.click()}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-semibold mb-3"
                >
                  Change Profile Picture
                </button>
                <input
                  ref={pictureInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setPictureToEdit(event.target?.result as string);
                      setCropMode(true);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold mb-4">Crop Your Picture</h3>
                <div className="relative w-48 h-48 bg-black/20 rounded-full overflow-hidden mb-4 border-2 border-white/30">
                  <img
                    src={pictureToEdit || ""}
                    alt="Crop preview"
                    className="w-full h-full object-cover"
                    style={{
                      transform: `scale(${cropScale}) translate(${cropX}px, ${cropY}px)`,
                    }}
                  />
                </div>

                <div className="w-full space-y-3 mb-4">
                  <div>
                    <label className="text-xs text-gray-400">Zoom</label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      value={cropScale}
                      onChange={(e) => setCropScale(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">X Position</label>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={cropX}
                      onChange={(e) => setCropX(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Y Position</label>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={cropY}
                      onChange={(e) => setCropY(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => {
                      setCropMode(false);
                      setPictureToEdit(null);
                      setCropScale(1);
                      setCropX(0);
                      setCropY(0);
                    }}
                    className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!pictureToEdit || !user?.id) return;
                      try {
                        setMessage("⏳ Processing image...");
                        const canvas = canvasRef.current;
                        if (!canvas) return;

                        const img = new Image();
                        img.onload = async () => {
                          const ctx = canvas.getContext("2d");
                          if (!ctx) return;

                          canvas.width = 400;
                          canvas.height = 400;

                          ctx.translate(canvas.width / 2, canvas.height / 2);
                          ctx.scale(cropScale, cropScale);
                          ctx.translate(-canvas.width / 2 + cropX, -canvas.height / 2 + cropY);
                          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                          canvas.toBlob(async (blob) => {
                            if (!blob) return;
                            try {
                              const fileName = `${user.id}/avatar_${Date.now()}.png`;
                              const { error: uploadError } = await supabase.storage
                                .from("message-files")
                                .upload(fileName, blob);

                              if (uploadError) {
                                setMessage("❌ Upload failed: " + uploadError.message);
                                return;
                              }

                              const { data } = supabase.storage
                                .from("message-files")
                                .getPublicUrl(fileName);

                              const { error: updateError } = await supabase
                                .from("profiles")
                                .update({ avatar_url: data.publicUrl })
                                .eq("id", user.id);

                              if (updateError) {
                                setMessage("❌ Failed to update profile: " + updateError.message);
                              } else {
                                setUser({ ...user, avatar_url: data.publicUrl });
                                setMessage("✅ Profile picture updated!");
                                setShowPictureModal(false);
                                setPictureToEdit(null);
                                setCropMode(false);
                              }
                            } catch (err) {
                              setMessage("❌ Error: " + (err as any).message);
                            }
                          });
                        };
                        img.src = pictureToEdit;
                      } catch (err) {
                        setMessage("❌ Error: " + (err as any).message);
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm font-semibold"
                  >
                    Approve
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden canvas for image cropping */}
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
}
