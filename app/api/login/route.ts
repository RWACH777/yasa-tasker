import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ✅ Use your public Supabase keys (RLS still applies here)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Create client for inserting with logged-in user's context
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function POST(req: Request) {
  try {
    const { title, description, category, budget, deadline, userId } = await req.json();

    // 🧩 Validation
    if (!userId) {
      return NextResponse.json({ error: "You must be logged in to post a task." }, { status: 401 });
    }

    if (!title  !description  !category  !budget  !deadline) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    // ✅ Insert task record
    const { error } = await supabase.from("tasks").insert([
      {
        poster_id: userId,  // comes from logged-in user's Supabase ID
        title,
        description,
        category,
        budget,
        deadline,
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("❌ Task insert error:", error);
      return NextResponse.json({ error: "Failed to post task." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Task posted successfully!" });
  } catch (err) {
    console.error("❌ Server error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}