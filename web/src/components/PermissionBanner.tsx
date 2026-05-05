import { useState, type ComponentProps } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useStore } from "../store.js";
import { sendToSession } from "../ws.js";
import type { PermissionRequest } from "../types.js";
import type { PermissionUpdate, AiValidationInfo } from "../../server/session-types.js";
import { DiffViewer } from "./DiffViewer.js";

/** Human-readable label for a permission suggestion */
function suggestionLabel(s: PermissionUpdate): string {
  if (s.type === "setMode") return `Set mode to "${s.mode}"`;
  const dest = s.destination;
  const scope = dest === "session" ? "for session" : "always";
  if (s.type === "addRules" || s.type === "replaceRules") {
    const rule = s.rules[0];
    if (rule?.ruleContent) return `Allow "${rule.ruleContent}" ${scope}`;
    if (rule?.toolName) return `Allow ${rule.toolName} ${scope}`;
  }
  if (s.type === "addDirectories") {
    return `Trust ${s.directories[0] || "directory"} ${scope}`;
  }
  return `Allow ${scope}`;
}

export function PermissionBanner({
  permission,
  sessionId,
}: {
  permission: PermissionRequest;
  sessionId: string;
}) {
  const [loading, setLoading] = useState(false);
  const removePermission = useStore((s) => s.removePermission);

  function handleAllow(updatedInput?: Record<string, unknown>, updatedPermissions?: PermissionUpdate[]) {
    setLoading(true);
    sendToSession(sessionId, {
      type: "permission_response",
      request_id: permission.request_id,
      behavior: "allow",
      updated_input: updatedInput,
      ...(updatedPermissions?.length ? { updated_permissions: updatedPermissions } : {}),
    });
    removePermission(sessionId, permission.request_id);
  }

  function handleDeny() {
    setLoading(true);
    sendToSession(sessionId, {
      type: "permission_response",
      request_id: permission.request_id,
      behavior: "deny",
      message: "Denied by user",
    });
    removePermission(sessionId, permission.request_id);
  }

  const isAskUser = permission.tool_name === "AskUserQuestion";
  const suggestions = permission.permission_suggestions;

  return (
    <div className="px-2 sm:px-4 py-3 border-b border-white/[0.08] animate-[fadeSlideIn_0.2s_ease-out]">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start gap-2 sm:gap-3">
          {/* Icon */}
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
            isAskUser
              ? "bg-[rgba(255,79,163,0.1)] border border-[rgba(255,79,163,0.2)]"
              : "bg-yellow-500/10 border border-yellow-500/20"
          }`}>
            {isAskUser ? (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#ff4fa3]">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-yellow-400">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-xs font-semibold ${isAskUser ? "text-[#ff4fa3]" : "text-yellow-400"}`}>
                {isAskUser ? "Question" : "Permission Request"}
              </span>
              {!isAskUser && (
                <span className="text-[11px] text-[#9ba3b4] font-mono-code">{permission.tool_name}</span>
              )}
            </div>

            {isAskUser ? (
              <AskUserQuestionDisplay
                input={permission.input}
                onSelect={(answers) => handleAllow({ ...permission.input, answers })}
                disabled={loading}
              />
            ) : (
              <ToolInputDisplay toolName={permission.tool_name} input={permission.input} description={permission.description} />
            )}

            {/* AI validation recommendation (shown for "uncertain" verdicts that fall through to manual) */}
            {permission.ai_validation && !isAskUser && (
              <AiValidationBadge validation={permission.ai_validation} />
            )}

            {/* Actions - only for non-AskUserQuestion tools */}
            {!isAskUser && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <button
                  onClick={() => handleAllow()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                    <path d="M3 8.5l3.5 3.5 6.5-7" />
                  </svg>
                  Allow
                </button>

                {/* Permission suggestion buttons — only when CLI provides them */}
                {suggestions?.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleAllow(undefined, [suggestion])}
                    disabled={loading}
                    title={`${suggestion.type}: ${JSON.stringify(suggestion)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg bg-[rgba(255,79,163,0.1)] hover:bg-[rgba(255,79,163,0.2)] text-[#ff4fa3] border border-[rgba(255,79,163,0.2)] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3">
                      <path d="M3 8.5l3.5 3.5 6.5-7" />
                    </svg>
                    {suggestionLabel(suggestion)}
                  </button>
                ))}

                <button
                  onClick={handleDeny}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-[#f6f7fb] border border-white/[0.1] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                  Deny
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Detect if a reason string indicates a service/infrastructure failure rather than a genuine analysis. */
function isServiceFailure(reason: string): boolean {
  const failurePatterns = [
    /^Invalid Anthropic/i,
    /^Anthropic .*(rate limit|overloaded|unavailable|error|lacks permission)/i,
    /^AI service/i,
    /^AI evaluation timed out/i,
    /^Model not found/i,
    /^No Anthropic API key/i,
  ];
  return failurePatterns.some((p) => p.test(reason));
}

function AiValidationBadge({ validation }: { validation: AiValidationInfo }) {
  const isFailure = validation.verdict === "uncertain" && isServiceFailure(validation.reason);

  const colorClass =
    validation.verdict === "safe"
      ? "bg-emerald-500/10 text-emerald-400"
      : validation.verdict === "dangerous"
        ? "bg-[#ff6b6b]/10 text-[#ff6b6b]"
        : "bg-yellow-500/10 text-yellow-400";

  const label = isFailure ? "AI analysis unavailable — manual review:" : "AI analysis:";

  return (
    <div className={`mt-2 flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-md ${colorClass}`}>
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 shrink-0">
        <path d="M8 1a2.5 2.5 0 00-2.5 2.5v.382a8 8 0 00-1.074.646l-.33-.191a2.5 2.5 0 00-3.415.912 2.5 2.5 0 00.916 3.42l.33.19A8 8 0 001.5 9.5v.382A8 8 0 002 10.5l-.33.19a2.5 2.5 0 00-.916 3.42 2.5 2.5 0 003.415.912l.33-.191a8 8 0 001.074.646V16A2.5 2.5 0 008 13.5 2.5 2.5 0 0010.5 16v-.713a8 8 0 001.074-.646l.33.191a2.5 2.5 0 003.415-.912 2.5 2.5 0 00-.916-3.42L14 10.5V9.5l.33-.19a2.5 2.5 0 00.916-3.42 2.5 2.5 0 00-3.415-.912l-.33.191A8 8 0 0010.5 4.882V4.5A2.5 2.5 0 008 2V1z"/>
      </svg>
      <span className="font-medium">{label}</span>
      <span>{validation.reason}</span>
    </div>
  );
}

function ToolInputDisplay({
  toolName,
  input,
  description,
}: {
  toolName: string;
  input: Record<string, unknown>;
  description?: string;
}) {
  if (toolName === "Bash") {
    return <BashDisplay input={input} />;
  }
  if (toolName === "Edit") {
    return <EditDisplay input={input} />;
  }
  if (toolName === "Write") {
    return <WriteDisplay input={input} />;
  }
  if (toolName === "Read") {
    return <ReadDisplay input={input} />;
  }
  if (toolName === "Glob") {
    return <GlobDisplay input={input} />;
  }
  if (toolName === "Grep") {
    return <GrepDisplay input={input} />;
  }
  if (toolName === "ExitPlanMode") {
    return <ExitPlanModeDisplay input={input} />;
  }

  // Fallback: formatted key-value display
  return <GenericDisplay input={input} description={description} />;
}

function BashDisplay({ input }: { input: Record<string, unknown> }) {
  const command = typeof input.command === "string" ? input.command : "";
  const desc = typeof input.description === "string" ? input.description : "";

  return (
    <div className="space-y-1.5">
      {desc && <div className="text-xs text-[#9ba3b4]">{desc}</div>}
      <pre className="text-xs text-[#f6f7fb] font-mono-code bg-[rgba(5,9,17,0.6)] rounded-lg px-2 sm:px-3 py-2 max-h-32 overflow-y-auto overflow-x-auto whitespace-pre-wrap break-words border border-white/[0.07]">
        <span className="text-[#9ba3b4] select-none">$ </span>{command}
      </pre>
    </div>
  );
}

function AskUserQuestionDisplay({
  input,
  onSelect,
  disabled,
}: {
  input: Record<string, unknown>;
  onSelect: (answers: Record<string, string>) => void;
  disabled: boolean;
}) {
  const questions = Array.isArray(input.questions) ? input.questions : [];
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [customText, setCustomText] = useState<Record<string, string>>({});
  const [showCustom, setShowCustom] = useState<Record<string, boolean>>({});

  function handleOptionClick(questionIdx: number, label: string) {
    const key = String(questionIdx);
    setSelections((prev) => ({ ...prev, [key]: label }));
    setShowCustom((prev) => ({ ...prev, [key]: false }));

    // Auto-submit if single question
    if (questions.length <= 1) {
      onSelect({ [key]: label });
    }
  }

  function handleCustomSubmit(questionIdx: number) {
    const key = String(questionIdx);
    const text = customText[key]?.trim();
    if (!text) return;
    setSelections((prev) => ({ ...prev, [key]: text }));

    if (questions.length <= 1) {
      onSelect({ [key]: text });
    }
  }

  function handleCustomChange(questionIdx: number, value: string) {
    const key = String(questionIdx);
    setCustomText((prev) => ({ ...prev, [key]: value }));
    const trimmed = value.trim();
    setSelections((prev) => {
      if (!trimmed) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: trimmed };
    });
  }

  function handleCustomToggle(questionIdx: number) {
    const key = String(questionIdx);
    setShowCustom((prev) => {
      const wasOpen = Boolean(prev[key]);
      const next = { ...prev, [key]: !wasOpen };
      if (wasOpen) {
        setSelections((s) => {
          const cleared = { ...s };
          delete cleared[key];
          return cleared;
        });
        setCustomText((t) => {
          const cleared = { ...t };
          delete cleared[key];
          return cleared;
        });
      }
      return next;
    });
  }

  function handleSubmitAll() {
    onSelect(selections);
  }

  if (questions.length === 0) {
    // Fallback for simple question string
    const question = typeof input.question === "string" ? input.question : "";
    if (question) {
      return (
        <div className="text-sm text-[#f6f7fb] bg-[rgba(5,9,17,0.6)] rounded-lg px-3 py-2 border border-white/[0.07]">
          {question}
        </div>
      );
    }
    return <GenericDisplay input={input} />;
  }

  return (
    <div className="space-y-3">
      {questions.map((q: Record<string, unknown>, i: number) => {
        const header = typeof q.header === "string" ? q.header : "";
        const text = typeof q.question === "string" ? q.question : "";
        const options = Array.isArray(q.options) ? q.options : [];
        const key = String(i);
        const selected = selections[key];
        const isCustom = showCustom[key];

        return (
          <div key={i} className="space-y-2">
            {header && (
              <span className="inline-block text-[10px] font-semibold text-[#ff4fa3] bg-[rgba(255,79,163,0.1)] px-1.5 py-0.5 rounded">
                {header}
              </span>
            )}
            {text && (
              <p className="text-sm text-[#f6f7fb] leading-relaxed">{text}</p>
            )}
            {options.length > 0 && (
              <div className="space-y-1.5">
                {options.map((opt: Record<string, unknown>, j: number) => {
                  const label = typeof opt.label === "string" ? opt.label : String(opt);
                  const desc = typeof opt.description === "string" ? opt.description : "";
                  const isSelected = selected === label;

                  return (
                    <button
                      key={j}
                      onClick={() => handleOptionClick(i, label)}
                      disabled={disabled}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
                        isSelected
                          ? "border-[rgba(255,79,163,0.45)] bg-[rgba(255,79,163,0.1)] ring-1 ring-[rgba(255,79,163,0.3)]"
                          : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-[rgba(255,79,163,0.3)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? "border-[#ff4fa3]" : "border-[#9ba3b4]/40"
                        }`}>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-[#ff4fa3]" />}
                        </span>
                        <div>
                          <span className="text-xs font-medium text-[#f6f7fb]">{label}</span>
                          {desc && <p className="text-[11px] text-[#9ba3b4] mt-0.5 leading-snug">{desc}</p>}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* "Other" option */}
                <button
                  onClick={() => handleCustomToggle(i)}
                  disabled={disabled}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
                    isCustom
                      ? "border-[rgba(255,79,163,0.45)] bg-[rgba(255,79,163,0.1)] ring-1 ring-[rgba(255,79,163,0.3)]"
                      : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-[rgba(255,79,163,0.3)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isCustom ? "border-[#ff4fa3]" : "border-[#9ba3b4]/40"
                    }`}>
                      {isCustom && <span className="w-2 h-2 rounded-full bg-[#ff4fa3]" />}
                    </span>
                    <span className="text-xs font-medium text-[#9ba3b4]">Other...</span>
                  </div>
                </button>

                {isCustom && (
                  <div className="pl-6">
                    <input
                      type="text"
                      value={customText[key] || ""}
                      onChange={(e) => handleCustomChange(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCustomSubmit(i); }}
                      placeholder="Type your answer..."
                      className="w-full px-2.5 py-1.5 text-xs bg-[rgba(5,9,17,0.8)] border border-white/[0.1] rounded-lg text-[#f6f7fb] placeholder:text-[#9ba3b4]/70 focus:outline-none focus:border-[rgba(255,79,163,0.5)]"
                      autoFocus
                    />
                    {questions.length <= 1 && (
                      <p className="mt-1 text-[10px] text-[#9ba3b4]">Press Enter to submit</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Submit all for multi-question */}
      {questions.length > 1 && Object.keys(selections).length > 0 && (
        <button
          onClick={handleSubmitAll}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-gradient-to-b from-[#ff6ab5] to-[#c62b7e] hover:opacity-90 text-white disabled:opacity-50 transition-opacity cursor-pointer shadow-[0_0_14px_rgba(255,79,163,0.4)]"
        >
          Submit answers
        </button>
      )}
    </div>
  );
}

function EditDisplay({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path || "");
  const oldStr = String(input.old_string || "");
  const newStr = String(input.new_string || "");

  return (
    <DiffViewer
      oldText={oldStr}
      newText={newStr}
      fileName={filePath}
      mode="compact"
    />
  );
}

function WriteDisplay({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path || "");
  const content = String(input.content || "");

  return (
    <DiffViewer
      newText={content}
      fileName={filePath}
      mode="compact"
    />
  );
}

function ReadDisplay({ input }: { input: Record<string, unknown> }) {
  const filePath = String(input.file_path || "");
  return (
    <div className="text-xs text-[#9ba3b4] font-mono-code bg-[rgba(5,9,17,0.6)] rounded-lg px-3 py-2 border border-white/[0.07]">
      {filePath}
    </div>
  );
}

function GlobDisplay({ input }: { input: Record<string, unknown> }) {
  const pattern = typeof input.pattern === "string" ? input.pattern : "";
  const path = typeof input.path === "string" ? input.path : "";
  return (
    <div className="text-xs font-mono-code bg-[rgba(5,9,17,0.6)] rounded-lg px-3 py-2 space-y-0.5 border border-white/[0.07]">
      <div className="text-[#f6f7fb]">{pattern}</div>
      {path && <div className="text-[#9ba3b4]">{path}</div>}
    </div>
  );
}

function GrepDisplay({ input }: { input: Record<string, unknown> }) {
  const pattern = typeof input.pattern === "string" ? input.pattern : "";
  const path = typeof input.path === "string" ? input.path : "";
  const glob = typeof input.glob === "string" ? input.glob : "";
  return (
    <div className="text-xs font-mono-code bg-[rgba(5,9,17,0.6)] rounded-lg px-3 py-2 space-y-0.5 border border-white/[0.07]">
      <div className="text-[#f6f7fb]">{pattern}</div>
      {path && <div className="text-[#9ba3b4]">{path}</div>}
      {glob && <div className="text-[#9ba3b4]">{glob}</div>}
    </div>
  );
}

function ExitPlanModeDisplay({ input }: { input: Record<string, unknown> }) {
  const plan = typeof input.plan === "string" ? input.plan : "";
  const allowedPrompts = Array.isArray(input.allowedPrompts) ? input.allowedPrompts : [];

  return (
    <div className="space-y-2">
      {plan && (
        <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-[rgba(13,17,32,0.8)]">
          <div className="px-3 py-2 border-b border-white/[0.07] bg-[rgba(255,79,163,0.04)] flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-[rgba(255,79,163,0.15)] text-[#ff4fa3] shrink-0">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                <path d="M3 3.5h10M3 8h10M3 12.5h6" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-[11px] text-[#ff4fa3] font-semibold tracking-wide uppercase">Plan</span>
          </div>
          <div className="px-3 py-3 max-h-72 overflow-y-auto markdown-body text-[13px] text-[#f6f7fb] leading-relaxed">
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-base font-semibold text-[#f6f7fb] mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-semibold text-[#f6f7fb] mb-1.5 mt-3 first:mt-0">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-medium text-[#f6f7fb] mb-1.5 mt-2">{children}</h3>,
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li>{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-[#f6f7fb]">{children}</strong>,
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#ff4fa3] hover:underline">{children}</a>
                ),
                code: (props: ComponentProps<"code">) => {
                  const { children, className } = props;
                  const match = /language-(\w+)/.exec(className || "");
                  const isBlock = match || (typeof children === "string" && children.includes("\n"));

                  if (isBlock) {
                    return (
                      <pre className="my-2 px-2.5 py-2 rounded-lg bg-[rgba(5,9,17,0.8)] text-[#c4c9d6] text-[12px] font-mono-code leading-relaxed overflow-x-auto border border-white/[0.07]">
                        <code>{children}</code>
                      </pre>
                    );
                  }

                  return (
                    <code className="px-1.5 py-0.5 rounded-md bg-[rgba(255,79,163,0.1)] text-[#ff8cc8] font-mono-code text-[12px]">
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => <>{children}</>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-[rgba(255,79,163,0.35)] pl-2 text-[#9ba3b4] italic my-2">{children}</blockquote>
                ),
              }}
            >
              {plan}
            </Markdown>
          </div>
        </div>
      )}
      {allowedPrompts.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-[#9ba3b4] uppercase tracking-wider">Requested permissions</div>
          <div className="space-y-1">
            {allowedPrompts.map((p: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[11px] font-mono-code bg-[rgba(5,9,17,0.6)] rounded-lg px-2.5 py-1.5 border border-white/[0.07]">
                <span className="text-[#9ba3b4] shrink-0">{String(p.tool || "")}</span>
                <span className="text-[#f6f7fb]">{String(p.prompt || "")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!plan && allowedPrompts.length === 0 && (
        <div className="text-xs text-[#9ba3b4]">Plan approval requested</div>
      )}
    </div>
  );
}

function GenericDisplay({
  input,
  description,
}: {
  input: Record<string, unknown>;
  description?: string;
}) {
  const entries = Object.entries(input).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );

  if (entries.length === 0 && description) {
    return <div className="text-xs text-[#f6f7fb]">{description}</div>;
  }

  return (
    <div className="space-y-1">
      {description && <div className="text-xs text-[#9ba3b4] mb-1">{description}</div>}
      <div className="bg-[rgba(5,9,17,0.6)] rounded-lg px-3 py-2 space-y-1 border border-white/[0.07]">
        {entries.map(([key, value]) => {
          const displayValue = typeof value === "string"
            ? value.length > 200 ? value.slice(0, 200) + "..." : value
            : JSON.stringify(value);
          return (
            <div key={key} className="flex gap-2 text-[11px] font-mono-code">
              <span className="text-[#9ba3b4] shrink-0">{key}:</span>
              <span className="text-[#f6f7fb] break-all">{displayValue}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
