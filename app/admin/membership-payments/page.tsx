"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

const ADMIN_USER_IDS = [
  "6c392b2f-aa45-4943-b610-0331e480daea",
  "43f3c79f-ed30-4808-8273-41e382039f3a",
];

interface Member {
  id: string;
  user_id: string;
  username: string;
  payment_txid: string | null;
  status: string;
  started_at: string;
  last_paid_at: string | null;
  updated_at: string | null;
}

type Filter = "all" | "pending_review" | "active" | "expired";

export default function AdminMembershipPaymentsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending_review");
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const loadMembers = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("memberships")
      .select("id, user_id, username, payment_txid, status, started_at, last_paid_at, updated_at")
      .order("updated_at", { ascending: false });

    if (err) { setError("Failed to load members: " + err.message); }
    else { setMembers(data || []); }
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push("/dashboard"); return; }

      const isHardcodedAdmin = ADMIN_USER_IDS.includes(session.user.id);
      if (!isHardcodedAdmin) {
        const { data: adminData } = await supabase
          .from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
        if (!adminData) {
          setError("Access denied. You are not an admin.");
          setLoading(false);
          return;
        }
      }

      setIsAdmin(true);
      loadMembers();
    };

    checkAdmin();
  }, [router, loadMembers]);

  // Real-time subscription — auto-updates when any membership changes
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("memberships_admin")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "memberships",
      }, () => {
        loadMembers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, loadMembers]);

  const handleApprove = async (m: Member) => {
    if (!m.payment_txid) { alert("No TXID — ask user to submit their transaction ID first."); return; }
    setActionId(m.id + "approve");

    // Check for TXID reuse
    const { data: dup } = await supabase
      .from("memberships")
      .select("id")
      .eq("payment_txid", m.payment_txid)
      .eq("status", "active")
      .neq("id", m.id)
      .limit(1);

    if (dup && dup.length > 0) {
      alert("⚠️ Duplicate TXID — this transaction was already used to activate another account.");
      setActionId(null);
      return;
    }

    const { error } = await supabase
      .from("memberships")
      .update({ status: "active", last_paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", m.id);

    if (error) { alert("Failed to approve: " + error.message); setActionId(null); return; }

    // Notify the user
    await supabase.from("notifications").insert({
      user_id: m.user_id,
      type: "membership_approved",
      message: "✅ Your membership payment of 155 π has been verified and your account is now active!",
      read: false,
    });

    setActionId(null);
    loadMembers();
  };

  const handleReject = async (m: Member) => {
    const reason = window.prompt("Reason for rejection (shown to user):", "Payment could not be verified on the Pi blockchain.");
    if (reason === null) return;
    setActionId(m.id + "reject");

    await supabase
      .from("memberships")
      .update({ status: "expired", payment_txid: null, updated_at: new Date().toISOString() })
      .eq("id", m.id);

    await supabase.from("notifications").insert({
      user_id: m.user_id,
      type: "membership_rejected",
      message: `❌ Your membership payment was rejected: ${reason || "Payment could not be verified."} Please resubmit with a valid TXID.`,
      read: false,
    });

    setActionId(null);
    loadMembers();
  };

  const filtered = filter === "all" ? members : members.filter(m => m.status === filter);

  const count = (s: string) => members.filter(m => m.status === s).length;

  const expiryDate = (m: Member) => {
    const base = m.last_paid_at || m.started_at;
    if (!base) return "—";
    const d = new Date(base);
    d.setDate(d.getDate() + 30);
    return d.toLocaleDateString();
  };

  const isExpiringSoon = (m: Member) => {
    if (m.status !== "active") return false;
    const base = m.last_paid_at || m.started_at;
    if (!base) return false;
    const expiry = new Date(base);
    expiry.setDate(expiry.getDate() + 30);
    return (expiry.getTime() - Date.now()) < 1000 * 60 * 60 * 24 * 5; // within 5 days
  };

  if (loading) return (
    <div className="app-background min-h-screen flex items-center justify-center">
      <div className="glass-card p-8"><p className="glass-text">Loading members...</p></div>
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
            <h1 className="text-2xl font-bold glass-text">🏅 Membership Management</h1>
            <p className="text-xs glass-text-muted mt-1">
              Auto-refreshes in real-time • Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/admin/disputes" className="glass-button text-sm">Disputes</Link>
            <Link href="/admin/payouts" className="glass-button text-sm">Payouts</Link>
            <button onClick={loadMembers} className="glass-button glass-button-primary text-sm">↺ Refresh</button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {([
            { key: "all",           label: "Total",   val: members.length,          color: "glass-text" },
            { key: "pending_review",label: "Pending", val: count("pending_review"),  color: "text-yellow-400" },
            { key: "active",        label: "Active",  val: count("active"),          color: "text-green-400" },
            { key: "expired",       label: "Expired", val: count("expired"),         color: "text-red-400" },
          ] as const).map(s => (
            <button key={s.key} onClick={() => setFilter(s.key as Filter)}
              className={`glass-card p-3 text-left transition-all ${filter === s.key ? "border border-white/40" : ""}`}>
              <p className="text-xs glass-text-muted">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.val}</p>
            </button>
          ))}
        </div>

        {/* Pending banner */}
        {count("pending_review") > 0 && filter !== "pending_review" && (
          <div
            className="glass-card border border-yellow-500/40 bg-yellow-500/5 p-3 mb-4 flex items-center justify-between cursor-pointer"
            onClick={() => setFilter("pending_review")}
          >
            <p className="text-yellow-400 text-sm font-semibold">
              ⚠️ {count("pending_review")} payment{count("pending_review") > 1 ? "s" : ""} waiting for your review
            </p>
            <span className="glass-button text-xs px-3 py-1">View →</span>
          </div>
        )}

        {/* Member List */}
        {filtered.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="glass-text-muted">No {filter === "all" ? "" : filter.replace("_", " ")} members</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((m) => (
              <div key={m.id} className={`glass-card p-4 border ${
                m.status === "pending_review" ? "border-yellow-500/40" :
                m.status === "active" && isExpiringSoon(m) ? "border-orange-500/30" :
                m.status === "active" ? "border-green-500/20" :
                "border-white/10"
              }`}>
                {/* Row 1: info */}
                <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3">
                  <div>
                    <span className="text-xs glass-text-muted">Username</span>
                    <p className="glass-text font-semibold">{m.username || "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs glass-text-muted">Status</span>
                    <p className={`font-semibold text-sm capitalize ${
                      m.status === "active" ? "text-green-400" :
                      m.status === "pending_review" ? "text-yellow-400" :
                      "text-red-400"
                    }`}>{m.status.replace("_", " ")}{isExpiringSoon(m) ? " ⚠️" : ""}</p>
                  </div>
                  <div>
                    <span className="text-xs glass-text-muted">Amount</span>
                    <p className="text-yellow-400 font-semibold">155 π</p>
                  </div>
                  <div>
                    <span className="text-xs glass-text-muted">Member Since</span>
                    <p className="glass-text text-sm">{m.started_at ? new Date(m.started_at).toLocaleDateString() : "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs glass-text-muted">Last Paid</span>
                    <p className="glass-text text-sm">{m.last_paid_at ? new Date(m.last_paid_at).toLocaleDateString() : "—"}</p>
                  </div>
                  <div>
                    <span className="text-xs glass-text-muted">Expires</span>
                    <p className={`text-sm ${isExpiringSoon(m) ? "text-orange-400 font-semibold" : "glass-text"}`}>{expiryDate(m)}</p>
                  </div>
                  <div>
                    <span className="text-xs glass-text-muted">Submitted</span>
                    <p className="glass-text text-sm">{m.updated_at ? new Date(m.updated_at).toLocaleDateString() : "—"}</p>
                  </div>
                </div>

                {/* Row 2: TXID + actions */}
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  {m.payment_txid ? (
                    <a href={`https://blockexplorer.minepi.com/tx/${m.payment_txid}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex-1 glass-button text-xs text-blue-400 text-center py-2 truncate">
                      🔗 {m.payment_txid.slice(0, 28)}… Verify ↗
                    </a>
                  ) : (
                    <div className="flex-1 glass-card px-3 py-2 text-xs glass-text-muted italic">No TXID submitted yet</div>
                  )}

                  {m.status === "pending_review" && (
                    <>
                      <button onClick={() => handleApprove(m)} disabled={!!actionId}
                        className="glass-button glass-button-success text-sm px-4 py-2 disabled:opacity-50 flex-shrink-0">
                        {actionId === m.id + "approve" ? "Approving..." : "✅ Approve"}
                      </button>
                      <button onClick={() => handleReject(m)} disabled={!!actionId}
                        className="glass-button text-sm px-4 py-2 text-red-400 disabled:opacity-50 flex-shrink-0">
                        {actionId === m.id + "reject" ? "Rejecting..." : "❌ Reject"}
                      </button>
                    </>
                  )}

                  {m.status === "active" && (
                    <span className="text-xs glass-text-muted px-3 py-2 glass-card">
                      ✅ Verified & Active
                    </span>
                  )}

                  {m.status === "expired" && (
                    <span className="text-xs text-red-400 px-3 py-2 glass-card">
                      Expired — awaiting renewal
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
