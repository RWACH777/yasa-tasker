/**
 * /api/payment/freelancer-wallet
 *
 * GET ?taskId=<uuid>
 *
 * Returns the freelancer's decrypted wallet address ONLY when:
 *   1. The requester is authenticated.
 *   2. The requester is the tasker (poster) of the specified task.
 *   3. The task has an assignee (approved freelancer).
 *
 * The wallet address is NEVER returned to anyone other than the tasker
 * of the exact task being paid. It is never browsable.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decryptWallet, maskWallet } from "@/lib/walletEncryption";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getAdminClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

async function getUserFromRequest(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return null;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const admin = getAdminClient();

  // Verify requester is the tasker (poster) of this task
  const { data: task, error: taskErr } = await admin
    .from("tasks")
    .select("id, poster_id, assignee_id, status, budget, title")
    .eq("id", taskId)
    .single();

  if (taskErr || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.poster_id !== user.id) {
    return NextResponse.json(
      { error: "Access denied: only the task poster can view payment details" },
      { status: 403 }
    );
  }

  if (!task.assignee_id) {
    return NextResponse.json({ error: "No freelancer assigned to this task" }, { status: 400 });
  }

  // Fetch the freelancer's wallet address
  const { data: freelancer, error: fErr } = await admin
    .from("profiles")
    .select("id, username, freelancer_username, user_wallet_address, wallet_address")
    .eq("id", task.assignee_id)
    .single();

  if (fErr || !freelancer) {
    return NextResponse.json({ error: "Freelancer profile not found" }, { status: 404 });
  }

  // Determine wallet: prefer manually-entered (encrypted) over Pi-SDK value
  let walletAddress: string | null = null;
  let walletSource: "manual" | "pi_sdk" | "none" = "none";

  if (freelancer.user_wallet_address) {
    try {
      walletAddress = decryptWallet(freelancer.user_wallet_address);
      walletSource = "manual";
    } catch {
      walletAddress = null;
    }
  } else if (freelancer.wallet_address) {
    walletAddress = freelancer.wallet_address;
    walletSource = "pi_sdk";
  }

  return NextResponse.json({
    task: {
      id: task.id,
      title: task.title,
      budget: task.budget,
      status: task.status,
    },
    freelancer: {
      id: freelancer.id,
      display_name: freelancer.freelancer_username || freelancer.username,
    },
    wallet_address: walletAddress,
    wallet_masked: walletAddress ? maskWallet(walletAddress) : null,
    wallet_source: walletSource,
    has_wallet: !!walletAddress,
  });
}
