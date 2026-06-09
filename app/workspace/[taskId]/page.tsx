"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

const AI_TOOLS = [
  { id: "improve_writing", label: "✍️ Improve Writing", category: "writing" },
  { id: "fix_grammar", label: "✅ Fix Grammar", category: "writing" },
  { id: "rewrite_text", label: "🔄 Rewrite Text", category: "writing" },
  { id: "shorten", label: "✂️ Shorten", category: "writing" },
  { id: "expand", label: "📝 Expand", category: "writing" },
  { id: "summarize", label: "📋 Summarize", category: "writing" },
  { id: "translate", label: "🌍 Translate", category: "writing" },
  { id: "brainstorm", label: "💡 Brainstorm Ideas", category: "creative" },
  { id: "generate_outline", label: "📐 Generate Outline", category: "creative" },
  { id: "explain_code", label: "🔍 Explain Code", category: "code" },
  { id: "debug_code", label: "🐛 Debug Code", category: "code" },
  { id: "suggest_improvements", label: "⚡ Suggest Improvements", category: "code" },
];

const CATEGORIES = [
  { id: "writing", label: "Writing" },
  { id: "creative", label: "Creative" },
  { id: "code", label: "Code" },
];

export default function WorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.taskId as string;

  const [task, setTask] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [usedAi, setUsedAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [activeCategory, setActiveCategory] = useState("writing");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [translateLang, setTranslateLang] = useState("French");
  const [selectedText, setSelectedText] = useState("");

  const [uploadingFile, setUploadingFile] = useState(false);
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadData();
  }, [taskId]);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { router.push("/"); return; }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
    setUser(profile || { id: session.user.id, username: session.user.user_metadata?.username || "User" });

    const { data: taskData, error: taskErr } = await supabase.from("tasks").select("*").eq("id", taskId).single();
    if (taskErr || !taskData) { setError("Task not found."); setLoading(false); return; }
    setTask(taskData);

    const { data: existingSubmission } = await supabase
      .from("submissions")
      .select("*")
      .eq("task_id", taskId)
      .eq("freelancer_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingSubmission) {
      setSubmission(existingSubmission);
      setContent(existingSubmission.content || "");
      setFileUrls(existingSubmission.file_urls || []);
      setUsedAi(existingSubmission.used_ai || false);
    }

    setLoading(false);
  };

  const handleTextSelect = () => {
    const sel = window.getSelection()?.toString().trim();
    if (sel) setSelectedText(sel);
  };

  const handleRunAiTool = async (toolId: string) => {
    const inputText = selectedText || content;
    if (!inputText.trim()) {
      setAiError("Please write something in the editor first (or select text to process).");
      return;
    }

    setAiLoading(true);
    setAiResult(null);
    setAiError(null);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: toolId,
          content: inputText,
          targetLanguage: toolId === "translate" ? translateLang : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setAiError(data.error || "AI tool failed."); return; }

      setAiResult(data.result);
      setUsedAi(true);
    } catch (err: any) {
      setAiError(err.message || "Failed to run AI tool.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleInsertResult = () => {
    if (!aiResult) return;
    if (selectedText && content.includes(selectedText)) {
      setContent(content.replace(selectedText, aiResult));
    } else {
      setContent(content ? content + "\n\n" + aiResult : aiResult);
    }
    setSelectedText("");
    setAiResult(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert("File too large. Maximum 5MB allowed.");
      return;
    }

    setUploadingFile(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user.id);
      formData.append("chatId", `workspace_${taskId}`);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Upload failed");

      setFileUrls((prev) => [...prev, result.url]);
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (url: string) => setFileUrls((prev) => prev.filter((u) => u !== url));

  const handleSubmit = async () => {
    if (!content.trim() && fileUrls.length === 0) {
      alert("Please add some content or files before submitting.");
      return;
    }

    setSubmitting(true);

    const submissionData = {
      task_id: taskId,
      freelancer_id: user.id,
      content: content.trim(),
      file_urls: fileUrls,
      used_ai: usedAi,
      reviewed_by_human: true,
      status: "pending",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let result;
    if (submission?.id) {
      result = await supabase.from("submissions").update({ ...submissionData, revision_count: (submission.revision_count || 0) }).eq("id", submission.id).select().single();
    } else {
      result = await supabase.from("submissions").insert(submissionData).select().single();
    }

    if (result.error) {
      alert("Failed to submit: " + result.error.message);
      setSubmitting(false);
      return;
    }

    setSubmission(result.data);

    await supabase.from("notifications").insert({
      user_id: task.poster_id,
      type: "submission_received",
      message: `A new submission was received for "${task.title}". Review it in your dashboard.`,
      related_task_id: taskId,
      read: false,
    });

    setSubmitting(false);
    setSubmitSuccess(true);
  };

  if (loading) return (
    <div className="min-h-screen app-background flex items-center justify-center">
      <div className="glass-loading"></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen app-background flex items-center justify-center p-4">
      <div className="glass-card p-8 max-w-md text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Link href="/dashboard" className="glass-button">Back to Dashboard</Link>
      </div>
    </div>
  );

  const isRevision = submission?.status === "revision_requested";
  const isAccepted = submission?.status === "accepted";
  const isPending = submission?.status === "pending";

  return (
    <div className="min-h-screen glass-dark app-background flex flex-col">
      {/* Header */}
      <div className="glass-nav sticky top-0 z-50 p-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <Link href="/dashboard" className="text-sm glass-text-muted">← Dashboard</Link>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-sm font-bold glass-text truncate">{task?.title}</h1>
            <div className="flex items-center justify-center gap-2 mt-0.5">
              {task?.ai_allowed && (
                <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">⚡ AI Allowed</span>
              )}
              {isRevision && <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">🔄 Revision {submission.revision_count}/{submission.max_revisions}</span>}
              {isPending && submission && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">⏳ Awaiting Review</span>}
              {isAccepted && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">✅ Accepted</span>}
            </div>
          </div>
          <button
            onClick={() => setAiPanelOpen(!aiPanelOpen)}
            className={`text-xs px-3 py-1 rounded-full border transition-all ${aiPanelOpen ? "border-yellow-500/50 text-yellow-400" : "border-white/20 glass-text-muted"}`}
          >
            🤖 AI
          </button>
        </div>
      </div>

      {/* Task Brief */}
      <div className="max-w-6xl mx-auto w-full px-4 pt-4">
        <div className="glass-card p-4 mb-4">
          <p className="text-xs glass-text-muted mb-1">Task Brief</p>
          <p className="text-sm glass-text">{task?.description}</p>
          <p className="text-xs glass-text-muted mt-2">Budget: <span className="text-yellow-400">{task?.budget} π</span> • Deadline: {new Date(task?.deadline).toLocaleDateString()}</p>
        </div>

        {isRevision && submission?.revision_note && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-4">
            <p className="text-orange-400 text-sm font-semibold mb-1">🔄 Revision Requested</p>
            <p className="text-sm glass-text">{submission.revision_note}</p>
          </div>
        )}

        {isAccepted && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4 text-center">
            <p className="text-green-400 font-semibold">✅ Your submission was accepted!</p>
            <p className="text-sm glass-text-muted mt-1">The tasker will now proceed with payment.</p>
          </div>
        )}
      </div>

      {/* Main Layout */}
      {!isAccepted && (
        <div className="max-w-6xl mx-auto w-full px-4 pb-6 flex flex-col gap-4 flex-1">

          {/* AI Toolbar (horizontal, above editor) */}
          {aiPanelOpen && task?.ai_allowed && (
            <div className="glass-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Category tabs */}
                <div className="flex gap-1">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`text-xs px-2 py-1 rounded-lg transition-all ${activeCategory === cat.id ? "bg-yellow-500/30 text-yellow-400" : "glass-text-muted hover:bg-white/5"}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="w-px h-5 bg-white/10 hidden sm:block"></div>

                {/* Tool buttons (horizontal wrap) */}
                {AI_TOOLS.filter((t) => t.category === activeCategory).map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => handleRunAiTool(tool.id)}
                    disabled={aiLoading || isPending}
                    className="text-xs glass-button px-2 py-1 disabled:opacity-50 hover:bg-white/10 whitespace-nowrap"
                  >
                    {tool.label}
                  </button>
                ))}

                {activeCategory === "writing" && (
                  <input
                    type="text"
                    value={translateLang}
                    onChange={(e) => setTranslateLang(e.target.value)}
                    placeholder="Language"
                    className="glass-input px-2 py-1 text-xs w-24"
                    title="Target language for Translate"
                  />
                )}
              </div>

              {/* Selected text indicator */}
              {selectedText && (
                <div className="flex items-center gap-2 mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2 py-1">
                  <p className="text-xs text-yellow-400 flex-1 truncate">Selected: "{selectedText.slice(0, 60)}{selectedText.length > 60 ? "..." : ""}"</p>
                  <button onClick={() => setSelectedText("")} className="text-xs text-white/40 hover:text-white/70">Clear</button>
                </div>
              )}

              {/* AI Loading */}
              {aiLoading && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="glass-loading w-4 h-4"></div>
                  <p className="text-xs glass-text-muted">Thinking...</p>
                </div>
              )}

              {/* AI Error */}
              {aiError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 mt-2">
                  <p className="text-red-400 text-xs">{aiError}</p>
                </div>
              )}

              {/* AI Result */}
              {aiResult && (
                <div className="mt-2 space-y-2">
                  <div className="bg-white/5 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <p className="text-xs glass-text whitespace-pre-wrap">{aiResult}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleInsertResult} className="glass-button glass-button-primary text-xs py-1.5 px-3">Insert into Doc</button>
                    <button onClick={() => setAiResult(null)} className="glass-button text-xs py-1.5 px-3">✕ Dismiss</button>
                  </div>
                </div>
              )}

              {!aiLoading && !aiError && !aiResult && !selectedText && (
                <p className="text-[10px] glass-text-muted mt-2">💡 Select text in the editor and click a tool, or just click a tool to process all content.</p>
              )}
            </div>
          )}

          {aiPanelOpen && !task?.ai_allowed && (
            <div className="glass-card p-3 text-center">
              <p className="text-sm glass-text-muted">🔒 AI tools are disabled for this task.</p>
            </div>
          )}

          {/* Editor */}
          <div className="flex flex-col gap-3 w-full">
            <div className="glass-card p-1">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                <span className="text-xs glass-text-muted">Your Work</span>
                {usedAi && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">⚡ AI Assisted</span>}
                <span className="ml-auto text-xs glass-text-muted">{content.length} chars</span>
              </div>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onMouseUp={handleTextSelect}
                onKeyUp={handleTextSelect}
                placeholder={`Start writing your work here...\n\nTip: Select any text, then use an AI tool above to improve it.`}
                className="w-full bg-transparent p-4 text-sm glass-text resize-none focus:outline-none min-h-[300px]"
                rows={16}
                disabled={isPending}
              />
            </div>

            {/* File Uploads */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm glass-text-muted">Attachments</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile || isPending}
                  className="glass-button px-3 py-1 text-xs disabled:opacity-50"
                >
                  {uploadingFile ? "Uploading..." : "+ Add File"}
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              </div>
              {fileUrls.length === 0 ? (
                <p className="text-xs glass-text-muted">No files attached yet</p>
              ) : (
                <div className="space-y-2">
                  {fileUrls.map((url, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline truncate flex-1">
                        File {i + 1}
                      </a>
                      {!isPending && (
                        <button onClick={() => handleRemoveFile(url)} className="text-red-400 text-xs">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            {!isPending && (
              submitSuccess ? (
                <div className="glass-card p-4 text-center bg-green-500/10 border border-green-500/30">
                  <p className="text-green-400 font-semibold">✅ Submission sent!</p>
                  <p className="text-sm glass-text-muted mt-1">The tasker has been notified and will review your work.</p>
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="glass-button glass-button-primary w-full py-3 font-semibold disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="glass-loading w-4 h-4"></span> Submitting...
                    </span>
                  ) : isRevision ? "Submit Revision" : "Submit Work"}
                </button>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
