import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthenticatedUser } from "@/lib/apiAuth";

const MAX_CONTENT_LENGTH = 8000;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS: Record<string, { system: string; model: "claude-haiku-4-5" | "claude-sonnet-4-5" }> = {
  improve_writing: {
    system: "You are a professional writing assistant. Improve the given text for clarity, flow, and professionalism. Return only the improved text, no explanations.",
    model: "claude-haiku-4-5",
  },
  fix_grammar: {
    system: "You are a grammar expert. Fix all grammar, punctuation, and spelling errors in the text. Return only the corrected text.",
    model: "claude-haiku-4-5",
  },
  rewrite_text: {
    system: "Rewrite the given text in a clearer, more professional way while keeping the original meaning. Return only the rewritten text.",
    model: "claude-haiku-4-5",
  },
  shorten: {
    system: "Make the given text more concise by removing unnecessary words. Keep all key information. Return only the shortened text.",
    model: "claude-haiku-4-5",
  },
  expand: {
    system: "Expand the given text with more detail and depth. Keep the same tone and style. Return only the expanded text.",
    model: "claude-haiku-4-5",
  },
  translate: {
    system: "Translate the given text to the target language specified. Return only the translated text.",
    model: "claude-haiku-4-5",
  },
  summarize: {
    system: "Summarize the given text into key points. Be concise and clear. Return only the summary.",
    model: "claude-haiku-4-5",
  },
  brainstorm: {
    system: "Generate 5-7 creative and actionable ideas based on the given topic or prompt. Format as a numbered list.",
    model: "claude-sonnet-4-5",
  },
  generate_outline: {
    system: "Create a detailed structured outline for the given topic. Use clear headings and sub-points. Return only the outline.",
    model: "claude-haiku-4-5",
  },
  explain_code: {
    system: "Explain what the given code does in simple, clear language. Break down each part. Return a clear explanation.",
    model: "claude-sonnet-4-5",
  },
  debug_code: {
    system: "Analyze the given code for bugs, errors, or issues. Explain what is wrong and provide the corrected code. Be specific.",
    model: "claude-sonnet-4-5",
  },
  suggest_improvements: {
    system: "Analyze the given code or text and suggest specific improvements for quality, performance, or readability. Be practical and actionable.",
    model: "claude-sonnet-4-5",
  },
};

export async function POST(req: Request) {
  try {
    // Require authenticated user to prevent API cost abuse
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      model: toolConfig.model,
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
