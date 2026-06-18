import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/apiAuth";

const MAX_CONTENT_LENGTH = 8000;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// All tools use Haiku to minimise API cost
const TOOLS: Record<string, { system: string }> = {
  improve_writing: {
    system: "You are a professional writing assistant. Improve the given text for clarity, flow, and professionalism. Return only the improved text, no explanations.",
  },
  fix_grammar: {
    system: "You are a grammar expert. Fix all grammar, punctuation, and spelling errors in the text. Return only the corrected text.",
  },
  rewrite_text: {
    system: "Rewrite the given text in a clearer, more professional way while keeping the original meaning. Return only the rewritten text.",
  },
  shorten: {
    system: "Make the given text more concise by removing unnecessary words. Keep all key information. Return only the shortened text.",
  },
  expand: {
    system: "Expand the given text with more detail and depth. Keep the same tone and style. Return only the expanded text.",
  },
  translate: {
    system: "Translate the given text to the target language specified. Return only the translated text.",
  },
  summarize: {
    system: "Summarize the given text into key points. Be concise and clear. Return only the summary.",
  },
  brainstorm: {
    system: "Generate 5-7 creative and actionable ideas based on the given topic or prompt. Format as a numbered list.",
  },
  generate_outline: {
    system: "Create a detailed structured outline for the given topic. Use clear headings and sub-points. Return only the outline.",
  },
  explain_code: {
    system: "Explain what the given code does in simple, clear language. Break down each part. Return a clear explanation.",
  },
  debug_code: {
    system: "Analyze the given code for bugs, errors, or issues. Explain what is wrong and provide the corrected code. Be specific.",
  },
  suggest_improvements: {
    system: "Analyze the given code or text and suggest specific improvements for quality, performance, or readability. Be practical and actionable.",
  },
};

const isMembershipActive = (membership: any): boolean => {
  if (!membership) return false;
  if (membership.status === "expired") return false;
  if (membership.status === "pending_review") return false;
  const baseDate = membership.last_paid_at || membership.started_at || membership.created_at;
  if (!baseDate) return false;
  const daysSince = Math.floor((Date.now() - new Date(baseDate).getTime()) / (1000 * 60 * 60 * 24));
  return daysSince < 30;
};

export async function POST(req: Request) {
  try {
    // Require authenticated user
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check membership — only active members (or admins) can use AI
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: adminData } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminData) {
      const { data: membership } = await supabaseAdmin
        .from("memberships")
        .select("status, last_paid_at, started_at, created_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMembershipActive(membership)) {
        return NextResponse.json(
          { error: "AI tools are available for active members only. Please renew your membership to access this feature." },
          { status: 403 }
        );
      }
    }

    const { tool, content, targetLanguage } = await req.json();

    if (!tool || !content?.trim()) {
      return NextResponse.json({ error: "Missing tool or content." }, { status: 400 });
    }

    const toolConfig = TOOLS[tool];
    if (!toolConfig) {
      return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 });
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json({ error: "Content too long. Max 8000 characters." }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI service not configured. Please add your Anthropic API key." }, { status: 503 });
    }

    const userMessage = tool === "translate" && targetLanguage
      ? `Translate to ${targetLanguage}:\n\n${content}`
      : content;

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: toolConfig.system,
      messages: [{ role: "user", content: userMessage }],
    });

    const result = message.content[0]?.type === "text" ? message.content[0].text : "";

    return NextResponse.json({ result, tool });
  } catch (err: any) {
    if (err?.status === 401) {
      return NextResponse.json({ error: "Invalid Anthropic API key. Please check your configuration." }, { status: 503 });
    }
    if (err?.status === 529) {
      return NextResponse.json({ error: "AI service is overloaded. Please try again in a moment." }, { status: 503 });
    }
    return NextResponse.json({ error: err.message || "AI request failed." }, { status: 500 });
  }
}
