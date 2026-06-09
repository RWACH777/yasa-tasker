"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface Dispute {
  id: string;
  task_id: string;
  raised_by: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  task?: { title: string; budget: number; poster_id: string; assignee_id: string };
  raiser?: { username: string; freelancer_username: string };
  submission?: { content: string; file_urls: string[]; used_ai: boolean; revision_count: number };
  tasker?: { username: string };
  freelancer?: { username: string; freelancer_username: string };
}

export default function AdminDisputesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "closed" | "all">("open");

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/dashboard"); return; }

      const { data: adminData, error: adminError } = await supabase
        .from("admin_users").select("*").eq("user_id", session.user.id).maybeSingle();

      if (adminError || !adminData) {
        setError("Access denied. You are not an admin.");
        setLoading(false);
        return;
      }

      setUser(session.user);
      setIsAdmin(true);
      loadDisputes();
    };
    checkAdmin();
  }, [router]);

  const loadDisputes = async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("disputes")
      .select(`
        *,
        task:task_id(title, budget, poster_id, assignee_id),
        raiser:raised_by(username, freelancer_username)
      `)
      .order("created_at", { ascending: false });

    if (err) { setError("Failed to load disputes: " + err.message); setLoading(false); return; }

    const enriched = await Promise.all((data || []).map(async (d: any) => {
      const taskerId = d.task?.poster_id;
      const freelancerId = d.task?.assignee_id;

      const [{ data: sub }, { data: tasker }, { data: freelancer }] = await Promise.all([
        supabase.from("submissions").select("content, file_urls, used_ai, revision_count")
          .eq("task_id", d.task_id).order("submitted_at", { ascending: false }).limit(1).single(),
        taskerId ? supabase.from("profiles").select("username").eq("id", taskerId).single() : Promise.resolve({ data: null }),
        freelancerId ? supabase.from("profiles").select("username, freelancer_username").eq("id", freelancerId).single() : Promise.resolve({ data: null }),
      ]);

      return { ...d, submission: sub, tasker, freelancer };
    }));

    setDisputes(enriched);
    setLoading(false);
  };

  const handleResolve = async (dispute: Dispute, favor: "tasker" | "freelancer") => {
    setActionLoading(dispute.id + favor);
    const notes = adminNotes[dispute.id] || "";

    await supabase.from("disputes").update({
      status: "resolved",
      admin_notes: `Resolved in favor of ${favor}. ${notes}`.trim(),
      resolved_at: new Date().toISOString(),
    }).eq("id", dispute.id);

    if (favor === "freelancer") {
      await supabase.from("submissions").update({ status: "accepted" })
        .eq("task_id", dispute.task_id);
      await supabase.from("notifications").insert({
        user_id: dispute.task?.assignee_id,
        type: "submission_accepted",
        message: `Admin resolved the dispute for "${dispute.task?.title}" in your favor. The tasker will now proceed with payment.`,
        related_task_id: dispute.task_id, read: false,
      });
      await supabase.from("notifications").insert({
        user_id: dispute.task?.poster_id,
        type: "dispute_resolved",
        message: `Admin resolved the dispute for "${dispute.task?.title}" in favor of the freelancer. Please proceed with payment.`,
        related_task_id: dispute.task_id, read: false,
      });
    } else {
      await supabase.from("submissions").update({ status: "disputed" })
        .eq("task_id", dispute.task_id);
      await supabase.from("notifications").insert({
        user_id: dispute.task?.poster_id,
        type: "dispute_resolved",
        message: `Admin resolved the dispute for "${dispute.task?.title}" in your favor. The task is back to open.`,
        related_task_id: dispute.task_id, read: false,
      });
      await supabase.from("tasks").update({ status: "open", assignee_id: null }).eq("id", dispute.task_id);
    }

    setActionLoading(null);
    loadDisputes();
  };

  const handleClose = async (dispute: Dispute) => {
    setActionLoading(dispute.id + "close");
    const notes = adminNotes[dispute.id] || "";
    await supabase.from("disputes").update({
      status: "closed",
      admin_notes: notes || "Closed by admin.",
      resolved_at: new Date().toISOString(),
    }).eq("id", dispute.id);
    setActionLoading(null);
    loadDisputes();
  };

  const filtered = statusFilter === "all" ? disputes : disputes.filter(d => d.status === statusFilter);

  if (loading) return (
    <div className="app-background min-h-screen flex items-center justify-center">
      <div className="glass-card p-8"><p className="glass-text">Loading disputes...</p></div>
    </div>
  );

  if (error) return (
    <div className="app-background min-h-screen flex items-center justify-center">
      <div className="glass-card p-8 max-w-md text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Link href="/dashboard" className="glass-button">Go Home</Link>
      </div>
    </div>
  );

  return (
    <div className="app-background min-h-screen text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold glass-text">🚩 Submission Disputes</h1>
            <p className="text-sm glass-text-muted mt-1">Review and resolve disputes raised by taskers</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/payouts" className="glass-button text-sm">Payouts</Link>
            <Link href="/admin/membership-payments" className="glass-button text-sm">Memberships</Link>
            <button onClick={loadDisputes} className="glass-button glass-button-primary text-sm">Refresh</button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {(["all", "open", "resolved", "closed"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`glass-card p-3 text-left transition-all ${
                statusFilter === s ? "border border-yellow-500/50" : ""
              }`}>
              <p className="text-xs glass-text-muted capitalize">{s}</p>
              <p className={`text-xl font-bold mt-1 ${
                s === "open" ? "text-red-400" : s === "resolved" ? "text-green-400" : s === "closed" ? "text-white/50" : "glass-text"
              }`}>
                {s === "all" ? disputes.length : disputes.filter(d => d.status === s).length}
              </p>
            </button>
          ))}
        </div>

        {/* Dispute List */}
        {filtered.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="glass-text-muted">No {statusFilter === "all" ? "" : statusFilter} disputes</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((dispute) => (
              <div key={dispute.id} className={`glass-card overflow-hidden border ${
                dispute.status === "open" ? "border-red-500/30" :
                dispute.status === "resolved" ? "border-green-500/20" : "border-white/10"
              }`}>

                {/* Card Header */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        dispute.status === "open" ? "bg-red-500/20 text-red-400" :
                        dispute.status === "resolved" ? "bg-green-500/20 text-green-400" :
                        "bg-white/10 text-white/50"
                      }`}>{dispute.status.toUpperCase()}</span>
                      <span className="text-xs glass-text-muted">{new Date(dispute.created_at).toLocaleString()}</span>
                    </div>
                    <p className="font-semibold glass-text">{dispute.task?.title || "Unknown Task"}</p>
                    <p className="text-xs glass-text-muted mt-0.5">
                      Tasker: <span className="text-white/80">{dispute.tasker?.username || "—"}</span>
                      {" · "}
                      Freelancer: <span className="text-white/80">{dispute.freelancer?.freelancer_username || dispute.freelancer?.username || "—"}</span>
                      {" · "}
                      Budget: <span className="text-yellow-400">{dispute.task?.budget} π</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setExpandedId(expandedId === dispute.id ? null : dispute.id)}
                    className="glass-button text-xs px-3 py-1 flex-shrink-0"
                  >
                    {expandedId === dispute.id ? "Collapse ▲" : "View Details ▼"}
                  </button>
                </div>

                {/* Expanded Detail */}
                {expandedId === dispute.id && (
                  <div className="border-t border-white/10 p-4 space-y-4">

                    {/* Dispute Reason */}
                    <div>
                      <p className="text-xs glass-text-muted mb-1">🚩 Dispute Reason (from tasker)</p>
                      <div className="glass-card p-3 bg-red-500/5">
                        <p className="text-sm glass-text">{dispute.reason}</p>
                      </div>
                    </div>

                    {/* Submission */}
                    {dispute.submission && (
                      <div>
                        <p className="text-xs glass-text-muted mb-1">
                          📄 Freelancer Submission
                          {dispute.submission.used_ai && <span className="ml-2 text-yellow-400">⚡ AI Assisted</span>}
                          {dispute.submission.revision_count > 0 && <span className="ml-2 text-orange-400">Revision {dispute.submission.revision_count}</span>}
                        </p>
                        <div className="glass-card p-3 max-h-48 overflow-y-auto">
                          <p className="text-sm glass-text whitespace-pre-wrap">
                            {dispute.submission.content || "(No text content)"}
                          </p>
                        </div>
                        {dispute.submission.file_urls?.length > 0 && (
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {dispute.submission.file_urls.map((url: string, i: number) => (
                              <a key={i} href={url} target="_blank" rel="noreferrer"
                                className="text-xs text-blue-400 underline">📎 File {i + 1}</a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Admin Notes */}
                    {dispute.status === "open" && (
                      <div>
                        <p className="text-xs glass-text-muted mb-1">Admin Notes (optional)</p>
                        <textarea
                          value={adminNotes[dispute.id] || ""}
                          onChange={(e) => setAdminNotes(prev => ({ ...prev, [dispute.id]: e.target.value }))}
                          placeholder="Add a note about your decision..."
                          className="w-full glass-input px-3 py-2 text-sm resize-none"
                          rows={2}
                        />
                      </div>
                    )}

                    {/* Existing admin notes */}
                    {dispute.admin_notes && dispute.status !== "open" && (
                      <div>
                        <p className="text-xs glass-text-muted mb-1">Admin Decision</p>
                        <p className="text-sm glass-text bg-white/5 rounded-lg p-3">{dispute.admin_notes}</p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    {dispute.status === "open" && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => handleResolve(dispute, "freelancer")}
                          disabled={!!actionLoading}
                          className="flex-1 glass-button glass-button-success py-2 text-sm font-semibold disabled:opacity-50"
                        >
                          {actionLoading === dispute.id + "freelancer" ? "Processing..." : "✅ Favor Freelancer (Accept Work)"}
                        </button>
                        <button
                          onClick={() => handleResolve(dispute, "tasker")}
                          disabled={!!actionLoading}
                          className="flex-1 glass-button py-2 text-sm font-semibold text-orange-400 disabled:opacity-50"
                        >
                          {actionLoading === dispute.id + "tasker" ? "Processing..." : "↩️ Favor Tasker (Return Task to Open)"}
                        </button>
                        <button
                          onClick={() => handleClose(dispute)}
                          disabled={!!actionLoading}
                          className="glass-button py-2 px-4 text-sm text-white/50 disabled:opacity-50"
                        >
                          {actionLoading === dispute.id + "close" ? "..." : "Close"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
