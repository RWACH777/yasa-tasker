"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/app/components/Sidebar";
import ApplicationModal, { ApplicationFormData } from "@/app/components/ApplicationModal";
import ApplicationReviewModal from "@/app/components/ApplicationReviewModal";
import { sendApprovalNotification, sendDenialNotification, sendApplicationNotification } from "@/app/utils/notificationHelpers";
import { injectMockPiSDK } from "@/lib/piMock";

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
  ai_allowed?: boolean;
  completion_type?: string;
  is_remote?: boolean;
  location_continent?: string;
  location_country?: string;
  location_region?: string;
  location_city?: string;
  location_suburb?: string;
}

const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];

const COUNTRIES_BY_CONTINENT: Record<string, string[]> = {
  "Africa": ["Algeria","Angola","Botswana","Cameroon","Côte d'Ivoire","DR Congo","Egypt","Ethiopia","Ghana","Kenya","Libya","Madagascar","Malawi","Mali","Morocco","Mozambique","Namibia","Nigeria","Rwanda","Senegal","Sierra Leone","Somalia","South Africa","South Sudan","Sudan","Tanzania","Tunisia","Uganda","Zambia","Zimbabwe"],
  "Asia": ["Afghanistan","Bangladesh","Cambodia","China","Georgia","India","Indonesia","Iran","Iraq","Israel","Japan","Jordan","Kazakhstan","Kuwait","Kyrgyzstan","Laos","Lebanon","Malaysia","Mongolia","Myanmar","Nepal","North Korea","Oman","Pakistan","Palestine","Philippines","Qatar","Saudi Arabia","Singapore","South Korea","Sri Lanka","Syria","Taiwan","Tajikistan","Thailand","Turkmenistan","UAE","Uzbekistan","Vietnam","Yemen"],
  "Europe": ["Albania","Austria","Belarus","Belgium","Bosnia & Herzegovina","Bulgaria","Croatia","Cyprus","Czech Republic","Denmark","Estonia","Finland","France","Germany","Greece","Hungary","Iceland","Ireland","Italy","Kosovo","Latvia","Lithuania","Luxembourg","Malta","Moldova","Montenegro","Netherlands","North Macedonia","Norway","Poland","Portugal","Romania","Russia","Serbia","Slovakia","Slovenia","Spain","Sweden","Switzerland","Turkey","Ukraine","United Kingdom"],
  "North America": ["Bahamas","Belize","Canada","Costa Rica","Cuba","Dominican Republic","El Salvador","Guatemala","Haiti","Honduras","Jamaica","Mexico","Nicaragua","Panama","Puerto Rico","Trinidad & Tobago","United States"],
  "South America": ["Argentina","Bolivia","Brazil","Chile","Colombia","Ecuador","Guyana","Paraguay","Peru","Suriname","Uruguay","Venezuela"],
  "Oceania": ["Australia","Fiji","Kiribati","Marshall Islands","Micronesia","Nauru","New Zealand","Palau","Papua New Guinea","Samoa","Solomon Islands","Tonga","Tuvalu","Vanuatu"],
};

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

const membershipIsExpired = (membership: any) => {
  if (!membership) return true;
  if (membership.status === "expired") return true;
  if (membership.status === "pending_review") return true;

  const now = Date.now();
  const baseDate = membership.last_paid_at || membership.started_at || membership.created_at;
  if (!baseDate) return true;

  const daysSinceBase = Math.floor((now - new Date(baseDate).getTime()) / (1000 * 60 * 60 * 24));
  return daysSinceBase >= 30;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState<{
    id: string; title: string; description: string; category: string;
    budget: string; deadline: string; completion_type: string; ai_allowed: boolean;
    is_remote: boolean; location_continent: string; location_country: string;
    location_region: string; location_city: string; location_suburb: string;
  }>({
    id: "",
    title: "",
    description: "",
    category: "",
    budget: "",
    deadline: "",
    completion_type: "ai_plus_human",
    ai_allowed: false,
    is_remote: true,
    location_continent: "",
    location_country: "",
    location_region: "",
    location_city: "",
    location_suburb: "",
  });
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);

  const [freelancerUsername, setFreelancerUsername] = useState("");
  const [walletInput, setWalletInput] = useState("");
  const [walletData, setWalletData] = useState<any>(null);
  const [showWalletInput, setShowWalletInput] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletMessage, setWalletMessage] = useState("");

  // New state for features
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPictureModal, setShowPictureModal] = useState(false);
  const [showRatingsPage, setShowRatingsPage] = useState(false);
  const [profileTasks, setProfileTasks] = useState({ active: [], pending: [], completed: [] });
  const [userApplications, setUserApplications] = useState<any[]>([]);
  const [userRatings, setUserRatings] = useState<any[]>([]);
  const [approvedChatUrl, setApprovedChatUrl] = useState<string | null>(null);
  
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

  // Complete task modal state (txid verification)
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingTask, setCompletingTask] = useState<any>(null);
  const [completingFreelancer, setCompletingFreelancer] = useState<any>(null);
  const [txidInput, setTxidInput] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState(false);

  // Submission review state
  const [taskSubmissions, setTaskSubmissions] = useState<Record<string, any>>({});
  const [showSubmissionModal, setShowSubmissionModal] = useState(false);
  const [reviewingSubmission, setReviewingSubmission] = useState<any>(null);
  const [reviewingTask, setReviewingTask] = useState<any>(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [submissionReviewLoading, setSubmissionReviewLoading] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeInput, setShowDisputeInput] = useState(false);

  // AI description helper state
  const [aiDescLoading, setAiDescLoading] = useState(false);
  const [aiDescSuggestion, setAiDescSuggestion] = useState<string | null>(null);

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMembershipModal, setShowMembershipModal] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);

  const handleContactTasker = async (task: Task) => {
    if (!user?.id) {
      setMessage("⚠️ You must be logged in to contact a tasker.");
      return;
    }

    if (!task.poster_id) {
      setMessage("⚠️ Unable to contact tasker. Please try again.");
      return;
    }

    router.push(`/chat?user=${task.poster_id}&task=${task.id}`);
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
      // Check admin status
      const { data: adminData } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      setIsAdmin(!!adminData);

      // Check membership expiry — show modal if expired (skip for admins)
      if (!adminData) {
        const { data: membershipData } = await supabase
          .from("memberships")
          .select("status, last_paid_at, started_at, created_at")
          .eq("user_id", authUserId)
          .maybeSingle();
        if (membershipIsExpired(membershipData)) {
          setShowMembershipModal(true);
        }
      }
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

  // Load message count — total unread messages received by this user
  const loadMessageCount = async (userId: string) => {
    const { data: received } = await supabase
      .from("messages")
      .select("id")
      .eq("receiver_id", userId)
      .eq("read", false);
    
    setMessageCount(received?.length || 0);
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

        const authResult = await pi.authenticate(["username", "payments", "wallet_address"], (p) => p);
        piUser = authResult.user;
      }

      // 4️⃣ Exchange tokens via API (works for both localhost and production)
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: piUser.username,
          pi_uid: piUser.uid,
          wallet_address: piUser.wallet_address || null,
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

    // Polling fallback every 8 seconds (optimized from 2s to reduce API calls)
    const pollInterval = setInterval(() => {
      fetchTasks();
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [user?.id, filter]);

  // Refresh notification and message count periodically
  useEffect(() => {
    if (!user?.id) return;

    const messageSubscription = supabase
      .channel(`dashboard-messages:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          loadMessageCount(user.id);
        }
      )
      .subscribe();

    // Refresh notification and message count every 10 seconds (optimized)
    const interval = setInterval(() => {
      loadNotificationCount(user.id);
      loadMessageCount(user.id);
    }, 10000);

    return () => {
      messageSubscription.unsubscribe();
      clearInterval(interval);
    };
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

    // Check if user is admin (admins are exempt from membership)
    const { data: adminData } = await supabase
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const isAdmin = !!adminData;

    // Check membership status if not admin
    if (!isAdmin) {
      const { data: membershipData } = await supabase
        .from("memberships")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const membershipExpired = membershipIsExpired(membershipData);
      
      if (membershipExpired) {
        setMessage("🚫 Your free month or paid membership has expired. Please renew your membership with 1 Pi before posting tasks.");
        return;
      }
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
      completion_type: form.completion_type,
      ai_allowed: form.ai_allowed,
      updated_at: new Date().toISOString(),
      is_remote: form.is_remote,
      location_continent: form.is_remote ? null : (form.location_continent || null),
      location_country: form.is_remote ? null : (form.location_country || null),
      location_region: form.is_remote ? null : (form.location_region || null),
      location_city: form.is_remote ? null : (form.location_city || null),
      location_suburb: form.is_remote ? null : (form.location_suburb || null),
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
      completion_type: "ai_plus_human",
      ai_allowed: false,
      is_remote: true,
      location_continent: "",
      location_country: "",
      location_region: "",
      location_city: "",
      location_suburb: "",
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
      completion_type: task.completion_type || "ai_plus_human",
      ai_allowed: task.ai_allowed ?? false,
      is_remote: task.is_remote !== false,
      location_continent: task.location_continent || "",
      location_country: task.location_country || "",
      location_region: task.location_region || "",
      location_city: task.location_city || "",
      location_suburb: task.location_suburb || "",
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
        if (active.length > 0) loadSubmissionsForTasks(active.map((t) => t.id));
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

  // Load latest submission for each active task (tasker view)
  const loadSubmissionsForTasks = async (taskIds: string[]) => {
    if (!taskIds.length) return;
    const { data } = await supabase
      .from("submissions")
      .select("*, freelancer:freelancer_id(id, username, freelancer_username)")
      .in("task_id", taskIds)
      .order("submitted_at", { ascending: false });

    if (data) {
      const map: Record<string, any> = {};
      data.forEach((s) => {
        if (!map[s.task_id]) map[s.task_id] = s;
      });
      setTaskSubmissions(map);
    }
  };

  const handleOpenReviewModal = (task: any) => {
    const sub = taskSubmissions[task.id];
    if (!sub) return;
    setReviewingTask(task);
    setReviewingSubmission(sub);
    setRevisionNote("");
    setDisputeReason("");
    setShowDisputeInput(false);
    setShowSubmissionModal(true);
  };

  const handleAcceptSubmission = async () => {
    if (!reviewingSubmission || !reviewingTask) return;
    setSubmissionReviewLoading(true);
    await supabase.from("submissions").update({ status: "accepted", reviewed_at: new Date().toISOString() }).eq("id", reviewingSubmission.id);
    await supabase.from("notifications").insert({
      user_id: reviewingSubmission.freelancer_id,
      type: "submission_accepted",
      message: `Your submission for "${reviewingTask.title}" was accepted! The tasker will now proceed with payment.`,
      related_task_id: reviewingTask.id,
      read: false,
    });
    setTaskSubmissions((prev) => ({ ...prev, [reviewingTask.id]: { ...reviewingSubmission, status: "accepted" } }));
    setSubmissionReviewLoading(false);
    setShowSubmissionModal(false);
  };

  const handleRequestRevision = async () => {
    if (!reviewingSubmission || !reviewingTask || !revisionNote.trim()) return;
    const newCount = (reviewingSubmission.revision_count || 0) + 1;
    if (newCount > (reviewingSubmission.max_revisions || 3)) {
      alert("Maximum revisions reached. You must Accept or Dispute.");
      return;
    }
    setSubmissionReviewLoading(true);
    await supabase.from("submissions").update({
      status: "revision_requested",
      revision_count: newCount,
      revision_note: revisionNote.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", reviewingSubmission.id);
    await supabase.from("notifications").insert({
      user_id: reviewingSubmission.freelancer_id,
      type: "revision_requested",
      message: `Revision ${newCount}/${reviewingSubmission.max_revisions || 3} requested for "${reviewingTask.title}": ${revisionNote.trim()}`,
      related_task_id: reviewingTask.id,
      read: false,
    });
    setTaskSubmissions((prev) => ({ ...prev, [reviewingTask.id]: { ...reviewingSubmission, status: "revision_requested", revision_count: newCount } }));
    setSubmissionReviewLoading(false);
    setShowSubmissionModal(false);
  };

  const handleDisputeSubmission = async () => {
    if (!reviewingSubmission || !reviewingTask || !disputeReason.trim()) return;
    setSubmissionReviewLoading(true);
    await supabase.from("disputes").insert({
      task_id: reviewingTask.id,
      raised_by: user!.id,
      reason: disputeReason.trim(),
      status: "open",
    });
    await supabase.from("submissions").update({ status: "disputed", updated_at: new Date().toISOString() }).eq("id", reviewingSubmission.id);
    await supabase.from("notifications").insert({
      user_id: reviewingSubmission.freelancer_id,
      type: "dispute_raised",
      message: `A dispute was raised for "${reviewingTask.title}". An admin will review it shortly.`,
      related_task_id: reviewingTask.id,
      read: false,
    });
    setTaskSubmissions((prev) => ({ ...prev, [reviewingTask.id]: { ...reviewingSubmission, status: "disputed" } }));
    setSubmissionReviewLoading(false);
    setShowSubmissionModal(false);
  };

  // Open the complete-task modal for a specific task (tasker view)
  const handleOpenCompleteModal = async (task: any) => {
    setCompletingTask(task);
    setCompletingFreelancer(null);
    setTxidInput("");
    setVerifyError(null);
    setVerifySuccess(false);

    if (task.assignee_id) {
      const { data: freelancer } = await supabase
        .from("profiles")
        .select("id, username, freelancer_username")
        .eq("id", task.assignee_id)
        .single();
      setCompletingFreelancer(freelancer || null);
    }
    setShowCompleteModal(true);
  };

  // Verify the txid on Pi blockchain then mark task complete
  const handleVerifyAndComplete = async () => {
    if (!txidInput.trim()) {
      setVerifyError("Please enter the Transaction ID.");
      return;
    }

    setVerifyLoading(true);
    setVerifyError(null);

    try {
      const res = await fetch("/api/payments/verify-txid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txid: txidInput.trim(),
          taskId: completingTask.id,
          expectedAmount: completingTask.budget,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.verified) {
        setVerifyError(result.error || "Transaction verification failed. Please check your Transaction ID.");
        setVerifyLoading(false);
        return;
      }

      // Mark task as completed
      await supabase
        .from("tasks")
        .update({
          status: "completed",
          payment_txid: txidInput.trim(),
          payment_status: "completed",
          payment_completed_at: new Date().toISOString(),
        })
        .eq("id", completingTask.id);

      // Create transaction record
      await supabase.from("transactions").insert({
        task_id: completingTask.id,
        sender_uid: user.id,
        sender_username: user.username,
        receiver_uid: completingFreelancer.id,
        receiver_username: completingFreelancer.freelancer_username || completingFreelancer.username,
        total_amount: completingTask.budget,
        net_amount: completingTask.budget,
        status: "success",
        pi_txid: txidInput.trim(),
        payment_memo: `Payment for task: ${completingTask.title}`,
      });

      // Create payment ledger entry
      await supabase.from("payment_ledger").insert({
        task_id: completingTask.id,
        tasker_id: user.id,
        freelancer_id: completingFreelancer.id,
        amount_pi: completingTask.budget,
        currency: "PI",
        payment_status: "payment_sent",
        transaction_reference: txidInput.trim(),
        confirmed_by_tasker: true,
        confirmed_by_freelancer: false,
        notes: `Payment for task: ${completingTask.title}`,
      });

      // Notify freelancer to confirm payment received
      await supabase.from("notifications").insert({
        user_id: completingFreelancer.id,
        type: "payment_received",
        message: `Tasker has marked payment as sent for "${completingTask.title}". Please confirm you received ${completingTask.budget} π to close the task.`,
        related_task_id: completingTask.id,
        read: false,
      });

      setVerifySuccess(true);
      setVerifyLoading(false);
      loadProfileTasks();

      setTimeout(() => {
        setShowCompleteModal(false);
        router.push(`/rating?task=${completingTask.id}&role=tasker`);
      }, 2000);
    } catch (err: any) {
      setVerifyError("Verification error: " + (err.message || "Please try again."));
      setVerifyLoading(false);
    }
  };

  // Load user ratings
  const computeBadges = (u: any) => {
    const badges: { icon: string; label: string; color: string }[] = [];
    const done = u?.completed_tasks || 0;
    const avg = u?.average_rating || 0;
    const total = u?.total_ratings || 0;
    badges.push({ icon: "🔰", label: "Member", color: "border-blue-500/40 bg-blue-500/10 text-blue-300" });
    if (done >= 1) badges.push({ icon: "🎯", label: "First Task", color: "border-green-500/40 bg-green-500/10 text-green-300" });
    if (done >= 10) badges.push({ icon: "🏆", label: "Task Master", color: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" });
    if (done >= 50) badges.push({ icon: "💎", label: "Elite", color: "border-purple-500/40 bg-purple-500/10 text-purple-300" });
    if (done >= 100) badges.push({ icon: "👑", label: "Legend", color: "border-orange-500/40 bg-orange-500/10 text-orange-300" });
    if (avg >= 4.0 && total >= 3) badges.push({ icon: "⭐", label: "Rising Star", color: "border-yellow-400/40 bg-yellow-400/10 text-yellow-200" });
    if (avg >= 4.5 && total >= 5) badges.push({ icon: "🌟", label: "Top Rated", color: "border-yellow-300/40 bg-yellow-300/10 text-yellow-100" });
    if (avg >= 5.0 && total >= 5) badges.push({ icon: "✨", label: "Five Star", color: "border-amber-300/40 bg-amber-300/10 text-amber-200" });
    if (total >= 10) badges.push({ icon: "🏅", label: "Trusted", color: "border-blue-400/40 bg-blue-400/10 text-blue-200" });
    if (total >= 50) badges.push({ icon: "💪", label: "Veteran", color: "border-red-400/40 bg-red-400/10 text-red-300" });
    if (done >= 5 && avg >= 4.0) badges.push({ icon: "🚀", label: "Fast Mover", color: "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" });
    return badges;
  };

  const loadUserRatings = async () => {
    if (!user?.id) {
      console.log("No user ID, skipping loadUserRatings");
      return;
    }

    try {
      console.log("Loading ratings for user:", user.id);
      const { data: ratings, error } = await supabase
        .from("ratings")
        .select("id, rating, comment, rating_type, created_at, rater_id, task_id")
        .eq("rated_user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ Error loading ratings:", error);
        return;
      }

      console.log("Ratings fetched:", ratings?.length || 0);

      if (ratings && ratings.length > 0) {
        // Fetch rater profiles separately
        const raterIds = [...new Set(ratings.map((r) => r.rater_id))];
        console.log("Fetching profiles for rater IDs:", raterIds);
        
        const { data: raterProfiles, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", raterIds);

        if (profileError) {
          console.error("❌ Error loading rater profiles:", profileError);
        }

        // Merge rater info into ratings
        const enrichedRatings = ratings.map((rating) => ({
          ...rating,
          rater: raterProfiles?.find((p) => p.id === rating.rater_id),
        }));

        setUserRatings(enrichedRatings);
        console.log("✅ Ratings loaded:", enrichedRatings.length);
        
        // Calculate averages by rating type
        const taskerRatings = enrichedRatings.filter((r) => r.rating_type === "tasker");
        const freelancerRatings = enrichedRatings.filter((r) => r.rating_type === "freelancer");
        
        const taskerAvg = taskerRatings.length > 0
          ? (taskerRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / taskerRatings.length).toFixed(2)
          : 0;
        
        const freelancerAvg = freelancerRatings.length > 0
          ? (freelancerRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / freelancerRatings.length).toFixed(2)
          : 0;
        
        const overallAvg = ((parseFloat(taskerAvg as any) + parseFloat(freelancerAvg as any)) / 2).toFixed(2);
        
        console.log("📊 Rating breakdown:", { taskerAvg, freelancerAvg, overallAvg, taskerCount: taskerRatings.length, freelancerCount: freelancerRatings.length });
      } else {
        console.log("No ratings found for user", user.id);
        setUserRatings([]);
      }
    } catch (err) {
      console.error("Exception loading ratings:", err);
    }
  };

  // Load ratings when profile modal opens
  useEffect(() => {
    if (showProfileModal && user?.id) {
      console.log("Profile modal opened, loading ratings");
      loadUserRatings();
    }
  }, [showProfileModal, user?.id]);

  // Subscribe to rating changes
  useEffect(() => {
    if (!user?.id) return;

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
          console.log("✅ New rating received:", payload.new);
          loadUserRatings();
          // Also reload profile to get updated average_rating and total_ratings
          loadProfile(user.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ratings",
          filter: `rated_user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("✅ Rating updated:", payload.new);
          loadUserRatings();
          // Also reload profile to get updated average_rating and total_ratings
          loadProfile(user.id);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

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

    // Check if user is admin (admins are exempt from membership)
    const { data: adminData } = await supabase
      .from("admin_users")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const isAdmin = !!adminData;

    // Check membership status if not admin
    if (!isAdmin) {
      const { data: membershipData } = await supabase
        .from("memberships")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const membershipExpired = membershipIsExpired(membershipData);
      
      if (membershipExpired) {
        setMessage("🚫 Your free month or paid membership has expired. Please renew your membership with 1 Pi before applying for tasks.");
        return;
      }
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
        task_id: taskId,
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
        .update({ status: "active", assignee_id: applicantId })
        .eq("id", taskId);
    }
    
    loadProfileTasks();
    // STEP 1: Store task context in localStorage for Pi Browser compatibility
    if (taskId && applicantId) {
      localStorage.setItem("activeTaskId", taskId);
      localStorage.setItem("activeChatUserId", applicantId);
      console.log("Stored in localStorage:", { taskId, applicantId });
    }
    router.push(`/chat?user=${applicantId}&task=${taskId}`);
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

// Logout handler - clears session and local storage
const handleLogout = async () => {
  // Clear Pi's cached session so the next Pi.authenticate() call is fully
  // fresh and will re-fetch wallet_address (Pi caches auth results and skips
  // the permission dialog on repeat logins if the session is still alive).
  try {
    const Pi = (window as any).Pi;
    if (Pi?.logout) await Pi.logout();
  } catch (_) {}
  await supabase.auth.signOut();
  localStorage.removeItem("pi_user");
  localStorage.removeItem("supabase.auth.token");
  router.push("/");
};

// Load own wallet data from secure API
const loadWalletData = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;
  try {
    const res = await fetch("/api/profile/wallet", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (res.ok) setWalletData(await res.json());
  } catch (_) {}
};

// Save wallet address via secure API
const handleSaveWallet = async (acknowledged: boolean) => {
  if (!walletInput.trim()) return;
  setWalletSaving(true);
  setWalletMessage("");
  const { data: { session } } = await supabase.auth.getSession();
  try {
    const res = await fetch("/api/profile/wallet", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ wallet_address: walletInput.trim(), acknowledged }),
    });
    const result = await res.json();
    if (res.ok) {
      setWalletMessage("\u2705 Wallet address saved securely!");
      setShowWalletInput(false);
      setShowPrivacyNotice(false);
      setWalletInput("");
      await loadWalletData();
    } else {
      setWalletMessage("\u274c " + result.error);
    }
  } catch (e: any) {
    setWalletMessage("\u274c " + e.message);
  }
  setWalletSaving(false);
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
    <div className="app-background min-h-screen text-white flex flex-col items-center px-4 py-10">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        notificationCount={notificationCount}
        messageCount={messageCount}
        onLogout={handleLogout}
      />
      
      {/* Navigation Bar */}
      <div className="w-full max-w-3xl mb-4 flex justify-between items-center">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="relative glass-button px-4 py-2 text-sm"
        >
          ☰ Menu
          {notificationCount > 0 && (
            <span className="absolute -top-2 -right-2 glass-badge text-white text-xs font-bold w-6 h-6 flex items-center justify-center">
              {notificationCount}
            </span>
          )}
        </button>
      </div>

      {/* Local Testing Mode Banner */}
      {isLocalMode && (
        <div className="w-full max-w-3xl mb-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 text-center">
          <p className="text-yellow-200 text-sm font-semibold">🧪 LOCAL TESTING MODE</p>
          <p className="text-yellow-100 text-xs mt-1">Pi SDK is mocked. Payments will show confirmation dialogs.</p>
        </div>
      )}
      <div
        onClick={() => {
          if (user?.id) {
            loadProfileTasks();
            loadUserRatings();
            loadWalletData();
            setShowProfileModal(true);
          }
        }}
        className="w-full max-w-3xl glass-profile p-6 text-center mb-6"
      >
        {loading ? (
          <p className="glass-text">Loading profile...</p>
        ) : user ? (
          <div className="flex flex-col items-center space-y-2">
            <img
              src={
                user.avatar_url ||
                `https://api.dicebear.com/8.x/thumbs/svg?seed=${user.username}`
              }
              alt="Avatar"
              className="w-20 h-20 glass-avatar object-cover flex-shrink-0"
            />
            <h2 className="text-xl font-semibold glass-text">{user.username}</h2>
            <p className="text-sm glass-text-muted">
              ⭐️ {user.rating || 0} • {user.completed_tasks || 0} Tasks Completed
            </p>
            <p className="text-xs glass-text-muted opacity-60">Click to view profile details</p>
          </div>
        ) : (
          <p className="glass-text">⚠️ Please log in with Pi to view your profile.</p>
        )}
      </div>

      {/* WALLET PRIVACY NOTICE MODAL */}
      {showPrivacyNotice && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70">
          <div className="glass-modal p-6 max-w-sm w-full">
            <h3 className="font-semibold glass-text mb-3">🔐 Wallet Address Privacy</h3>
            <ul className="text-xs glass-text-muted space-y-2 mb-4 list-none">
              <li>• Only you can view and edit your wallet address.</li>
              <li>• Other users cannot view or access your wallet address.</li>
              <li>• YASA Tasker acts as the secure bridge — your address is used only to receive task payments.</li>
              <li>• Your wallet address is never publicly displayed or shared.</li>
              <li>• Your wallet info prepares your account for future automatic A2U payments when Pi enables this.</li>
            </ul>
            <div className="flex gap-2">
              <button onClick={() => setShowPrivacyNotice(false)} className="glass-button px-4 py-2 text-sm flex-1">
                Cancel
              </button>
              <button
                onClick={() => handleSaveWallet(true)}
                disabled={walletSaving}
                className="glass-button glass-button-primary px-4 py-2 text-sm flex-1 disabled:opacity-50"
              >
                {walletSaving ? "Saving..." : "I Understand & Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {showProfileModal && user && (
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl glass-modal p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold glass-text">{user.username}'s Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="glass-close"
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
                  className="w-24 h-24 glass-avatar object-cover flex-shrink-0 group-hover:opacity-70 transition"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-full glass-overlay">
                  <span className="text-white text-xs font-semibold">View</span>
                </div>
              </button>
              <div className="flex flex-col gap-3 w-full">
                <div>
                  <label className="text-xs glass-text-muted block mb-1">Freelancer Username (what others see)</label>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="text"
                      placeholder="Your freelancer username"
                      value={freelancerUsername || user.freelancer_username || ""}
                      onChange={(e) => setFreelancerUsername(e.target.value)}
                      className="flex-1 min-w-0 glass-input px-3 py-2 text-sm"
                    />
                    <button
                      onClick={handleUpdateFreelancerUsername}
                      className="glass-button glass-button-primary px-4 py-2 text-sm flex-shrink-0 whitespace-nowrap"
                    >
                      Update
                    </button>
                  </div>
                  {user.freelancer_username && (
                    <p className="text-xs glass-text-accent mt-1">✓ Current: {user.freelancer_username}</p>
                  )}
                </div>
              </div>

              {/* Payment Information */}
              <div className="mt-4 w-full border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs glass-text-muted font-semibold">🔐 Payment Wallet Address</label>
                  {walletData?.wallet_address && !showWalletInput && (
                    <button onClick={() => { setShowWalletInput(true); setWalletMessage(""); }} className="text-xs glass-text-accent underline">
                      Edit
                    </button>
                  )}
                </div>

                {walletData?.wallet_address && !showWalletInput ? (
                  <div>
                    <div className="glass-input px-3 py-2 text-xs font-mono tracking-wider select-none">
                      {walletData.wallet_address.slice(0, 6)}••••••...••••••{walletData.wallet_address.slice(-6)}
                    </div>
                    {walletData.wallet_updated_at && (
                      <p className="text-[10px] glass-text-muted/60 mt-1">
                        Updated: {new Date(walletData.wallet_updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="text"
                      placeholder="Your Pi wallet address (starts with G, 56 chars)"
                      value={walletInput}
                      onChange={(e) => setWalletInput(e.target.value)}
                      className="flex-1 min-w-0 glass-input px-3 py-2 text-xs font-mono"
                    />
                    <button
                      onClick={() => {
                        if (!walletData?.wallet_acknowledged) setShowPrivacyNotice(true);
                        else handleSaveWallet(true);
                      }}
                      disabled={walletSaving || !walletInput.trim()}
                      className="glass-button glass-button-primary px-4 py-2 text-sm flex-shrink-0 whitespace-nowrap disabled:opacity-50"
                    >
                      {walletSaving ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}

                {walletMessage && <p className="text-xs mt-1">{walletMessage}</p>}

                {!walletData?.wallet_address && (
                  <p className="text-[10px] glass-text-muted/60 mt-2">
                    🔒 Encrypted and private. Only you can see this. Used only to receive task payments.
                  </p>
                )}
              </div>

              <p className="text-xs glass-text-muted mt-3">
                ⭐️ Rating: {user.average_rating && user.average_rating > 0 ? `${user.average_rating}/5 (${user.total_ratings || 0} ratings)` : "No ratings yet"} • Completed: {user.completed_tasks || 0}
              </p>

              {/* Achievement Badges */}
              {(() => {
                const badges = computeBadges(user);
                return badges.length > 0 ? (
                  <div className="w-full mt-3">
                    <p className="text-xs glass-text-muted mb-2">🏆 Achievements</p>
                    <div className="flex flex-wrap gap-1.5">
                      {badges.map((b, i) => (
                        <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${b.color}`}>
                          {b.icon} {b.label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              <p className="text-[10px] glass-text-muted/50 mt-2 font-mono">
                ID: {user.id}
              </p>
              
              {/* Admin Button — only visible to admin users */}
              {isAdmin && (
                <Link
                  href="/admin/disputes"
                  className="glass-button glass-button-primary mt-4 px-6 py-2 text-sm"
                  onClick={() => setShowProfileModal(false)}
                >
                  🛡️ Admin Panel
                </Link>
              )}
            </div>

            {/* Profile View Tabs */}
            <div className="flex gap-2 mb-6 border-b border-white/10">
              <button
                onClick={() => setProfileView("tasker")}
                className={`px-4 py-2 font-semibold transition ${
                  profileView === "tasker"
                    ? "glass-tab-active"
                    : "glass-tab"
                }`}
              >
                👤 Tasker View
              </button>
              <button
                onClick={() => setProfileView("freelancer")}
                className={`px-4 py-2 font-semibold transition ${
                  profileView === "freelancer"
                    ? "glass-tab-active border-green-400"
                    : "glass-tab"
                }`}
              >
                💼 Freelancer View
              </button>
            </div>

            {/* Tasks Sections */}
            <div className="space-y-6">
              {/* Active Tasks */}
              <div>
                <h3 className="text-lg font-semibold mb-3 glass-text-accent">Active Tasks ({profileTasks.active.length})</h3>
                {profileTasks.active.length === 0 ? (
                  <p className="glass-text-muted text-sm">No active tasks</p>
                ) : (
                  <div className="space-y-2">
                    {profileTasks.active.map((task: any) => (
                      <div key={task.id} className="glass-list-item p-3">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm glass-text truncate">{task.title}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <p className="text-xs glass-text-muted">Budget: {task.budget} π</p>
                              {task.ai_allowed && (
                                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">⚡ AI</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {profileView === "freelancer" && (
                              <button
                                onClick={() => { setShowProfileModal(false); router.push(`/workspace/${task.id}` as any); }}
                                className="glass-button px-3 py-1 text-xs"
                              >
                                Open Workspace
                              </button>
                            )}
                            {profileView === "tasker" && (() => {
                              const sub = taskSubmissions[task.id];
                              const subStatus = sub?.status;
                              if (sub && subStatus !== "accepted" && subStatus !== "disputed") {
                                return (
                                  <button
                                    onClick={() => handleOpenReviewModal(task)}
                                    className="glass-button glass-button-primary px-3 py-1 text-xs"
                                  >
                                    {subStatus === "revision_requested" ? "⏳ Revision Sent" : "📋 Review"}
                                  </button>
                                );
                              }
                              if (subStatus === "accepted") {
                                return (
                                  <button
                                    onClick={() => handleOpenCompleteModal(task)}
                                    className="glass-button glass-button-success px-3 py-1 text-xs"
                                  >
                                    💰 Pay & Complete
                                  </button>
                                );
                              }
                              return (
                                <button
                                  onClick={() => handleOpenCompleteModal(task)}
                                  className="glass-button glass-button-primary px-3 py-1 text-xs"
                                >
                                  Complete
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Tasks */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-yellow-300">Pending Tasks ({profileTasks.pending.length})</h3>
                {profileTasks.pending.length === 0 ? (
                  <p className="glass-text-muted text-sm">No pending tasks</p>
                ) : (
                  <div className="space-y-2">
                    {profileTasks.pending.map((task) => (
                      <div key={task.id} className="glass-list-item p-3">
                        <p className="font-semibold text-sm glass-text">{task.title}</p>
                        <p className="text-xs glass-text-muted">
                          Budget: {task.budget} π
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Completed Tasks */}
              <div>
                <h3 className="text-lg font-semibold mb-3 glass-text-accent">Completed Tasks ({profileTasks.completed.length})</h3>
                {profileTasks.completed.length === 0 ? (
                  <p className="glass-text-muted text-sm">No completed tasks</p>
                ) : (
                  <div className="space-y-2">
                    {profileTasks.completed.map((task) => (
                      <div key={task.id} className="glass-list-item p-3">
                        <p className="font-semibold text-sm glass-text">{task.title}</p>
                        <p className="text-xs glass-text-muted">
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
                // TASKER VIEW - Show ratings that TASKER received (from freelancers) = rating_type "tasker"
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold glass-text">⭐ Tasker Ratings</h3>
                    {(() => {
                      const taskerRatings = userRatings.filter((r) => r.rating_type === "tasker");
                      return taskerRatings.length > 0 ? (
                        <button
                          onClick={() => setShowRatingsPage(true)}
                          className="text-xs glass-text-accent hover:underline transition"
                        >
                          View All ({taskerRatings.length})
                        </button>
                      ) : null;
                    })()}
                  </div>
                  {(() => {
                    const taskerRatings = userRatings.filter((r) => r.rating_type === "tasker");
                    if (taskerRatings.length === 0) {
                      return <p className="text-sm glass-text-muted">No tasker ratings yet. Complete tasks to receive ratings!</p>;
                    }
                    const rating = taskerRatings[0];
                    return (
                      <div className="glass-list-item p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-yellow-300">{"⭐".repeat(rating.rating || 0)}</span>
                          <span className="text-sm font-semibold glass-text">{rating.rater?.username || "Anonymous"}</span>
                        </div>
                        {rating.comment && (
                          <p className="text-sm glass-text-muted italic">"{rating.comment}"</p>
                        )}
                        <p className="text-xs glass-text-muted opacity-60 mt-2">
                          {new Date(rating.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                // FREELANCER VIEW - Show ratings that FREELANCER received (from taskers) = rating_type "freelancer"
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold glass-text">⭐ Freelancer Ratings</h3>
                    {(() => {
                      const freelancerRatings = userRatings.filter((r) => r.rating_type === "freelancer");
                      return freelancerRatings.length > 0 ? (
                        <button
                          onClick={() => setShowRatingsPage(true)}
                          className="text-xs glass-text-accent hover:underline transition"
                        >
                          View All ({freelancerRatings.length})
                        </button>
                      ) : null;
                    })()}
                  </div>
                  {(() => {
                    const freelancerRatings = userRatings.filter((r) => r.rating_type === "freelancer");
                    if (freelancerRatings.length === 0) {
                      return <p className="text-sm glass-text-muted">No freelancer ratings yet. Complete tasks to receive ratings!</p>;
                    }
                    const rating = freelancerRatings[0];
                    return (
                      <div className="glass-list-item p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-yellow-300">{"⭐".repeat(rating.rating || 0)}</span>
                          <span className="text-sm font-semibold glass-text">{rating.rater?.username || "Anonymous"}</span>
                        </div>
                        {rating.comment && (
                          <p className="text-sm glass-text-muted italic">"{rating.comment}"</p>
                        )}
                        <p className="text-xs glass-text-muted opacity-60 mt-2">
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

      {/* COMPLETE TASK MODAL (txid verification) */}
      {showCompleteModal && completingTask && (
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md glass-modal p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold glass-text">Verify & Complete Task</h2>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="glass-close"
              >
                ✕
              </button>
            </div>

            {verifySuccess ? (
              <div className="text-center py-6">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-green-400 font-semibold text-lg mb-1">Payment Verified!</p>
                <p className="glass-text-muted text-sm">Task marked as completed. Redirecting to rating...</p>
              </div>
            ) : (
              <>
                <div className="glass-card p-4 mb-4">
                  <p className="text-sm glass-text-muted">Task</p>
                  <p className="font-semibold glass-text">{completingTask.title}</p>
                  <p className="text-sm glass-text-muted mt-1">
                    Amount: <span className="text-yellow-400 font-bold">{completingTask.budget} π</span>
                  </p>
                  {completingFreelancer && (
                    <p className="text-sm glass-text-muted mt-1">
                      Paid to: <span className="glass-text">{completingFreelancer.freelancer_username || completingFreelancer.username}</span>
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm glass-text-muted mb-2">
                    Pi Transaction ID (txid)
                  </label>
                  <input
                    type="text"
                    value={txidInput}
                    onChange={(e) => setTxidInput(e.target.value)}
                    placeholder="Paste the blockchain transaction ID here"
                    className="glass-input w-full px-3 py-2 text-sm font-mono"
                  />
                  <p className="text-xs glass-text-muted mt-1">
                    Find this in your Pi Wallet after sending payment.
                  </p>
                </div>

                {verifyError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">⚠️ {verifyError}</p>
                  </div>
                )}

                <button
                  onClick={handleVerifyAndComplete}
                  disabled={verifyLoading || !txidInput.trim()}
                  className="glass-button glass-button-primary w-full py-3 font-semibold disabled:opacity-50"
                >
                  {verifyLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="glass-loading w-4 h-4"></span>
                      Verifying on blockchain...
                    </span>
                  ) : (
                    "Verify & Complete Task"
                  )}
                </button>

                <p className="text-xs glass-text-muted text-center mt-3">
                  YASA Tasker will verify your payment on the Pi blockchain before completing the task.
                </p>
              </>
            )}
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
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl glass-modal p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold glass-text">
                {profileView === "tasker" ? "👤 Ratings as Tasker" : "💼 Ratings as Freelancer"}
              </h2>
              <button
                onClick={() => setShowRatingsPage(false)}
                className="glass-close"
              >
                ✕
              </button>
            </div>

            {userRatings && userRatings.length > 0 ? (
              <div className="space-y-6">
                {profileView === "tasker" ? (
                  // TASKER VIEW - Show only ratings that TASKER received (rating_type = "tasker")
                  <div>
                    <h3 className="text-lg font-semibold glass-text-accent mb-4">👤 Tasker Ratings</h3>
                    {(() => {
                      const taskerRatings = userRatings.filter((r) => r.rating_type === "tasker");
                      if (taskerRatings.length === 0) {
                        return <p className="text-sm glass-text-muted">No tasker ratings yet</p>;
                      }
                      return (
                        <div className="space-y-3">
                          {taskerRatings.map((rating, index) => (
                            <div key={index} className="glass-list-item p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={
                                      rating.rater?.avatar_url ||
                                      `https://api.dicebear.com/8.x/thumbs/svg?seed=${rating.rater?.username || "user"}`
                                    }
                                    alt={rating.rater?.username}
                                    className="w-10 h-10 glass-avatar object-cover flex-shrink-0"
                                  />
                                  <div>
                                    <p className="font-semibold text-sm glass-text">{rating.rater?.username || "Anonymous"}</p>
                                    <p className="text-xs glass-text-muted">
                                      {new Date(rating.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-yellow-300 text-lg">
                                  {"⭐".repeat(rating.rating || 0)}
                                </div>
                              </div>
                              {rating.comment && (
                                <p className="text-sm glass-text-muted italic">"{rating.comment}"</p>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  // FREELANCER VIEW - Show only ratings that FREELANCER received (rating_type = "freelancer")
                  <div>
                    <h3 className="text-lg font-semibold glass-text-accent mb-4">💼 Freelancer Ratings</h3>
                    {(() => {
                      const freelancerRatings = userRatings.filter((r) => r.rating_type === "freelancer");
                      if (freelancerRatings.length === 0) {
                        return <p className="text-sm glass-text-muted">No freelancer ratings yet</p>;
                      }
                      return (
                        <div className="space-y-3">
                          {freelancerRatings.map((rating, index) => (
                            <div key={index} className="glass-list-item p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={
                                      rating.rater?.avatar_url ||
                                      `https://api.dicebear.com/8.x/thumbs/svg?seed=${rating.rater?.username || "user"}`
                                    }
                                    alt={rating.rater?.username}
                                    className="w-10 h-10 glass-avatar object-cover flex-shrink-0"
                                  />
                                  <div>
                                    <p className="font-semibold text-sm glass-text">{rating.rater?.username || "Anonymous"}</p>
                                    <p className="text-xs glass-text-muted">
                                      {new Date(rating.created_at).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-yellow-300 text-lg">
                                  {"⭐".repeat(rating.rating || 0)}
                                </div>
                              </div>
                              {rating.comment && (
                                <p className="text-sm glass-text-muted italic">"{rating.comment}"</p>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center glass-text-muted">No ratings yet</p>
            )}
          </div>
        </div>
      )}

      {/* EVERYTHING BELOW IS IDENTICAL — tasks, forms, filters, etc */}
      {/* (I DID NOT TOUCH YOUR UI) */}

      {/* POST TASK FORM */}
      <div className="w-full max-w-3xl glass-panel p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 glass-text">
          {form.id ? "Edit Task" : "Post a Task"}
        </h2>
        {message && <p className="text-sm glass-text-muted mb-3">{message}</p>}
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
            className="w-full glass-input px-4 py-2 text-sm"
          />
          <div className="relative">
            <textarea
              placeholder="Task description — what do you need done?"
              value={form.description}
              onChange={(e) => {
                setForm({ ...form, description: e.target.value });
                setAiDescSuggestion(null);
              }}
              className="w-full glass-input px-4 py-2 text-sm pr-28"
              rows={3}
            />
            <button
              type="button"
              disabled={aiDescLoading || !form.title.trim()}
              onClick={async () => {
                setAiDescLoading(true);
                setAiDescSuggestion(null);
                try {
                  const prompt = form.description.trim()
                    ? `Improve this task description for a freelance marketplace. Task title: "${form.title}". Current description: "${form.description}". Make it clear, specific, and professional. Return only the improved description.`
                    : `Write a clear, specific task description for a freelance marketplace task titled: "${form.title}". Be professional and mention what deliverables are expected. Return only the description text.`;
                  const { data: { session: aiSession } } = await supabase.auth.getSession();
                  const res = await fetch("/api/ai", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(aiSession?.access_token ? { Authorization: `Bearer ${aiSession.access_token}` } : {}),
                    },
                    body: JSON.stringify({ tool: "improve_writing", content: prompt }),
                  });
                  const data = await res.json();
                  if (data.result) setAiDescSuggestion(data.result);
                } catch {}
                setAiDescLoading(false);
              }}
              className="absolute top-2 right-2 text-xs px-2 py-1 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
              title={!form.title.trim() ? "Add a title first" : "Generate description with AI"}
            >
              {aiDescLoading ? "..." : "✨ AI Help"}
            </button>
          </div>
          {aiDescSuggestion && (
            <div className="glass-card p-3 border border-yellow-500/30 space-y-2">
              <p className="text-xs text-yellow-400 font-semibold">✨ AI Suggestion</p>
              <p className="text-sm glass-text">{aiDescSuggestion}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setForm({ ...form, description: aiDescSuggestion }); setAiDescSuggestion(null); }}
                  className="glass-button glass-button-primary text-xs px-3 py-1"
                >
                  Use This
                </button>
                <button
                  type="button"
                  onClick={() => setAiDescSuggestion(null)}
                  className="glass-button text-xs px-3 py-1 text-white/50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          <select
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
            className="w-full glass-select px-4 py-2 text-sm"
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
              setForm({ ...form, budget: e.target.value })
            }
            className="w-full glass-input px-4 py-2 text-sm"
          />
          <input
            type="date"
            value={form.deadline}
            onChange={(e) =>
              setForm({ ...form, deadline: e.target.value })
            }
            className="w-full glass-input px-4 py-2 text-sm"
          />

          {/* Completion Type */}
          <div className="space-y-1">
            <label className="text-xs glass-text-muted">Task Completion Type</label>
            <select
              value={form.completion_type}
              onChange={(e) => setForm({ ...form, completion_type: e.target.value })}
              className="w-full glass-select px-4 py-2 text-sm"
            >
              <option value="ai_plus_human">⚡ AI + Human (Recommended)</option>
              <option value="human_only">👤 Human Only</option>
            </select>
            <p className="text-xs glass-text-muted">
              {form.completion_type === "ai_plus_human"
                ? "AI + Human combines AI speed with human expertise and verification."
                : "Worker must complete this task without any AI assistance."}
            </p>
          </div>

          {/* AI Allowed Toggle */}
          <div className="flex items-center justify-between py-2 px-3 glass-card">
            <div>
              <p className="text-sm glass-text">Allow AI assistance?</p>
              <p className="text-xs glass-text-muted">Workers can use built-in AI tools</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, ai_allowed: !form.ai_allowed })}
              className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors overflow-hidden ${
                form.ai_allowed ? "bg-yellow-500" : "bg-white/20"
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${
                form.ai_allowed ? "left-7" : "left-1"
              }`} />
            </button>
          </div>

          {/* Task Location */}
          <div className="space-y-2">
            <label className="text-xs glass-text-muted">Task Location</label>
            <div className="flex items-center justify-between py-2 px-3 glass-card">
              <div>
                <p className="text-sm glass-text">Remote / Online Task?</p>
                <p className="text-xs glass-text-muted">Can be completed from anywhere</p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, is_remote: !form.is_remote })}
                className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-colors overflow-hidden ${form.is_remote ? "bg-blue-500" : "bg-white/20"}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${form.is_remote ? "left-7" : "left-1"}`} />
              </button>
            </div>
            {!form.is_remote && (
              <div className="space-y-2">
                <select
                  value={form.location_continent}
                  onChange={(e) => setForm({ ...form, location_continent: e.target.value, location_country: "", location_region: "", location_city: "", location_suburb: "" })}
                  className="w-full glass-select px-4 py-2 text-sm"
                >
                  <option value="">Select continent</option>
                  {CONTINENTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {form.location_continent && (
                  <select
                    value={form.location_country}
                    onChange={(e) => setForm({ ...form, location_country: e.target.value, location_region: "", location_city: "", location_suburb: "" })}
                    className="w-full glass-select px-4 py-2 text-sm"
                  >
                    <option value="">Select country</option>
                    {(COUNTRIES_BY_CONTINENT[form.location_continent] || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {form.location_country && (
                  <input
                    type="text"
                    placeholder="Region / State (optional)"
                    value={form.location_region}
                    onChange={(e) => setForm({ ...form, location_region: e.target.value })}
                    className="w-full glass-input px-4 py-2 text-sm"
                  />
                )}
                {form.location_country && (
                  <input
                    type="text"
                    placeholder="City"
                    value={form.location_city}
                    onChange={(e) => setForm({ ...form, location_city: e.target.value })}
                    className="w-full glass-input px-4 py-2 text-sm"
                  />
                )}
                {form.location_city && (
                  <input
                    type="text"
                    placeholder="Suburb / Area (optional)"
                    value={form.location_suburb}
                    onChange={(e) => setForm({ ...form, location_suburb: e.target.value })}
                    className="w-full glass-input px-4 py-2 text-sm"
                  />
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full glass-button glass-button-primary py-2"
          >
            {form.id ? "Update Task" : "Post Task"}
          </button>
        </form>
      </div>

      {/* TASK LIST */}
      <div className="w-full max-w-3xl glass-panel p-6">
        <div className="mb-4 space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold glass-text">Available Tasks</h2>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="glass-select px-3 py-1 text-sm"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={locationFilter}
              onChange={(e) => { setLocationFilter(e.target.value); setCountryFilter(""); }}
              className="glass-select px-3 py-1 text-sm flex-1 min-w-0"
            >
              <option value="">🌍 All Locations</option>
              <option value="remote">🌐 Remote Only</option>
              {CONTINENTS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {locationFilter && locationFilter !== "remote" && (
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="glass-select px-3 py-1 text-sm flex-1 min-w-0"
              >
                <option value="">All Countries</option>
                {(COUNTRIES_BY_CONTINENT[locationFilter] || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>
        </div>

        {tasks.length === 0 ? (
          <p className="glass-text-muted text-sm">No tasks found.</p>
        ) : (
          <div className="space-y-4">
            {tasks
              .filter(task => {
                if (!locationFilter) return true;
                if (locationFilter === "remote") return task.is_remote !== false;
                return task.location_continent === locationFilter;
              })
              .filter(task => !countryFilter || task.location_country === countryFilter)
              .map((task) => (
              <div
                key={task.id}
                className={`glass-list-item p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center${task.status === "completed" ? " opacity-50 grayscale" : ""}`}
              >
                <div className="flex-1">
                  <h3 className="font-semibold glass-text">{task.title}</h3>
                  <p className="glass-text-muted text-sm mb-2">
                    {task.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-xs glass-text-muted">
                      {task.category} • {task.budget} π • {new Date(task.deadline).toLocaleDateString()}
                    </span>
                    {task.ai_allowed ? (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">⚡ AI Allowed</span>
                    ) : (
                      <span className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">👤 Human Only</span>
                    )}
                    {task.is_remote === false ? (
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                        📍 {[task.location_city, task.location_country].filter(Boolean).join(", ") || task.location_continent}
                      </span>
                    ) : (
                      <span className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">🌐 Remote</span>
                    )}
                  </div>
                  {task.status === "completed" && (
                    <p className="text-xs text-white/40 mt-1.5">🔒 Closed Task</p>
                  )}
                </div>

                <div className="flex gap-2 mt-3 sm:mt-0 flex-wrap sm:flex-nowrap">
                  {user?.id === task.poster_id ? (
                    <>
                      <button
                        onClick={() => handleEdit(task)}
                        className="glass-button glass-button-primary px-3 py-1 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="glass-button glass-button-danger px-3 py-1 text-sm"
                      >
                        Delete
                      </button>
                    </>
                  ) : task.status === "completed" ? null : (
                    <button
                      onClick={() => handleApplyToTask(task.id)}
                      className="glass-button glass-button-success px-3 py-1 text-sm"
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
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md glass-modal p-6 flex flex-col items-center relative">
            <button
              onClick={() => {
                setShowPictureModal(false);
                setPictureToEdit(null);
                setCropMode(false);
              }}
              className="absolute top-4 right-4 glass-close"
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
                  className="w-48 h-48 glass-avatar mb-6 object-cover"
                />
                <button
                  onClick={() => pictureInputRef.current?.click()}
                  className="w-full glass-button glass-button-primary px-4 py-2 text-sm font-semibold mb-3"
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
                <h3 className="text-lg font-semibold mb-4 glass-text">Crop Your Picture</h3>
                <div className="relative w-48 h-48 glass-panel rounded-full overflow-hidden mb-4">
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
                    <label className="text-xs glass-text-muted">Zoom</label>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      value={cropScale}
                      onChange={(e) => setCropScale(parseFloat(e.target.value))}
                      className="w-full glass-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs glass-text-muted">X Position</label>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={cropX}
                      onChange={(e) => setCropX(parseInt(e.target.value))}
                      className="w-full glass-input"
                    />
                  </div>
                  <div>
                    <label className="text-xs glass-text-muted">Y Position</label>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={cropY}
                      onChange={(e) => setCropY(parseInt(e.target.value))}
                      className="w-full glass-input"
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
                    className="flex-1 glass-button px-3 py-2 text-sm"
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

                          // object-cover: scale image so the shorter side fills the canvas
                          const coverScale = Math.max(
                            canvas.width / img.naturalWidth,
                            canvas.height / img.naturalHeight
                          );
                          const drawW = img.naturalWidth * coverScale * cropScale;
                          const drawH = img.naturalHeight * coverScale * cropScale;
                          const drawX = (canvas.width - drawW) / 2 + cropX;
                          const drawY = (canvas.height - drawH) / 2 + cropY;

                          ctx.drawImage(img, drawX, drawY, drawW, drawH);

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
                    className="flex-1 glass-button glass-button-primary px-3 py-2 text-sm font-semibold"
                  >
                    Approve
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SUBMISSION REVIEW MODAL */}
      {showSubmissionModal && reviewingSubmission && reviewingTask && (
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg glass-modal p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowSubmissionModal(false)}
              className="absolute top-4 right-4 glass-text-muted hover:text-white text-xl"
            >✕</button>

            <h2 className="text-lg font-bold glass-text mb-1">📋 Review Submission</h2>
            <p className="text-sm glass-text-muted mb-4">{reviewingTask.title}</p>

            {/* Submission meta */}
            <div className="flex items-center gap-3 mb-4 p-3 glass-card">
              <div>
                <p className="text-sm glass-text font-semibold">
                  {reviewingSubmission.freelancer?.freelancer_username || reviewingSubmission.freelancer?.username || "Freelancer"}
                </p>
                <p className="text-xs glass-text-muted">
                  Submitted {new Date(reviewingSubmission.submitted_at).toLocaleString()}
                  {reviewingSubmission.revision_count > 0 && ` • Revision ${reviewingSubmission.revision_count}/${reviewingSubmission.max_revisions}`}
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                {reviewingSubmission.used_ai && (
                  <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">⚡ AI Assisted</span>
                )}
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">👤 Human Reviewed</span>
              </div>
            </div>

            {/* Content */}
            {reviewingSubmission.content && (
              <div className="mb-4">
                <p className="text-xs glass-text-muted mb-1">Submitted Work</p>
                <div className="glass-card p-3 max-h-48 overflow-y-auto">
                  <p className="text-sm glass-text whitespace-pre-wrap">{reviewingSubmission.content}</p>
                </div>
              </div>
            )}

            {/* Files */}
            {reviewingSubmission.file_urls?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs glass-text-muted mb-2">Attachments ({reviewingSubmission.file_urls.length})</p>
                <div className="space-y-1">
                  {reviewingSubmission.file_urls.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-xs text-blue-400 underline glass-card px-3 py-2">
                      📎 File {i + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3 mt-4">
              {/* Accept */}
              <button
                onClick={handleAcceptSubmission}
                disabled={submissionReviewLoading}
                className="w-full glass-button glass-button-success py-2 text-sm font-semibold disabled:opacity-50"
              >
                ✅ Accept Submission
              </button>

              {/* Request Revision */}
              {(reviewingSubmission.revision_count || 0) < (reviewingSubmission.max_revisions || 3) ? (
                <div className="space-y-2">
                  <textarea
                    value={revisionNote}
                    onChange={(e) => setRevisionNote(e.target.value)}
                    placeholder="Explain what needs to be changed..."
                    className="w-full glass-input px-3 py-2 text-sm resize-none"
                    rows={3}
                  />
                  <button
                    onClick={handleRequestRevision}
                    disabled={submissionReviewLoading || !revisionNote.trim()}
                    className="w-full glass-button py-2 text-sm disabled:opacity-50"
                  >
                    🔄 Request Revision ({(reviewingSubmission.revision_count || 0)}/{reviewingSubmission.max_revisions || 3} used)
                  </button>
                </div>
              ) : (
                <p className="text-xs text-orange-400 text-center">Maximum revisions reached — Accept or Dispute</p>
              )}

              {/* Dispute */}
              {!showDisputeInput ? (
                <button
                  onClick={() => setShowDisputeInput(true)}
                  className="w-full glass-button py-2 text-sm text-red-400"
                >
                  🚩 Raise Dispute
                </button>
              ) : (
                <div className="space-y-2 border border-red-500/30 rounded-lg p-3">
                  <p className="text-xs text-red-400">Describe the issue — an admin will review:</p>
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Describe why this submission is unacceptable..."
                    className="w-full glass-input px-3 py-2 text-sm resize-none"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => setShowDisputeInput(false)} className="flex-1 glass-button py-2 text-xs">Cancel</button>
                    <button
                      onClick={handleDisputeSubmission}
                      disabled={submissionReviewLoading || !disputeReason.trim()}
                      className="flex-1 glass-button py-2 text-xs text-red-400 border-red-500/30 disabled:opacity-50"
                    >
                      Confirm Dispute
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for image cropping */}
      <canvas ref={canvasRef} className="hidden"></canvas>

      {/* MEMBERSHIP EXPIRED MODAL */}
      {showMembershipModal && (
        <div className="fixed inset-0 glass-overlay flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm glass-modal p-6 flex flex-col items-center text-center gap-4">
            <div className="text-4xl">🔒</div>
            <h2 className="text-lg font-bold glass-text">Membership Expired</h2>
            <p className="glass-text-muted text-sm">
              Your membership has expired. Please purchase a membership to continue posting tasks, applying to tasks, and using AI tools.
            </p>
            <div className="flex flex-col gap-2 w-full">
              <a
                href="/membership"
                className="glass-button glass-button-primary w-full py-2 text-sm text-center"
                onClick={() => setShowMembershipModal(false)}
              >
                Purchase Membership
              </a>
              <button
                onClick={() => setShowMembershipModal(false)}
                className="glass-button w-full py-2 text-sm text-white/60"
              >
                Continue Browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
