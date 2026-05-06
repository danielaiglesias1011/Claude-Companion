import { useState, useMemo, useCallback, type ComponentProps, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage, ContentBlock } from "../types.js";
import { ToolBlock, getToolIcon, getToolLabel, getPreview, ToolIcon } from "./ToolBlock.js";

export function MessageBubble({ message, cwd }: { message: ChatMessage; cwd?: string }) {
  if (message.role === "system") {
    return (
      <div className="flex items-center gap-3 py-1 min-w-0">
        <div className="shrink-0 flex-1 h-px bg-white/[0.06]" />
        <span className="text-[11px] text-[#9ba3b4] italic font-mono-code px-1 min-w-0 break-words text-center">
          {message.content}
        </span>
        <div className="shrink-0 flex-1 h-px bg-white/[0.06]" />
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-[fadeSlideIn_0.2s_ease-out]">
        <div className="max-w-[85%] sm:max-w-[80%] px-3 sm:px-4 py-2.5 rounded-[14px] rounded-br-[4px] bg-[rgba(17,22,40,0.9)] border border-white/[0.1] text-[#f6f7fb] shadow-[0_4px_20px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]">
          {message.images && message.images.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {message.images.map((img, i) => (
                <img
                  key={i}
                  src={`data:${img.media_type};base64,${img.data}`}
                  alt="attachment"
                  className="max-w-[150px] sm:max-w-[200px] max-h-[120px] sm:max-h-[150px] rounded-lg object-cover"
                />
              ))}
            </div>
          )}
          <div className="text-[13px] sm:text-[14px] leading-relaxed break-words">
            <MarkdownContent text={message.content} />
          </div>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="animate-[fadeSlideIn_0.2s_ease-out]">
      <AssistantMessage message={message} cwd={cwd} />
    </div>
  );
}

interface ToolGroupItem {
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface ToolUseInfo {
  name: string;
  input: Record<string, unknown>;
}

type GroupedBlock =
  | { kind: "content"; block: ContentBlock }
  | { kind: "tool_group"; name: string; items: ToolGroupItem[] };

function groupContentBlocks(blocks: ContentBlock[]): GroupedBlock[] {
  const groups: GroupedBlock[] = [];

  for (const block of blocks) {
    if (block.type === "tool_use") {
      const last = groups[groups.length - 1];
      if (last?.kind === "tool_group" && last.name === block.name) {
        last.items.push({ id: block.id, name: block.name, input: block.input });
      } else {
        groups.push({
          kind: "tool_group",
          name: block.name,
          items: [{ id: block.id, name: block.name, input: block.input }],
        });
      }
    } else {
      groups.push({ kind: "content", block });
    }
  }

  return groups;
}

function mapToolUsesById(blocks: ContentBlock[]): Map<string, ToolUseInfo> {
  const map = new Map<string, ToolUseInfo>();
  for (const block of blocks) {
    if (block.type === "tool_use") {
      map.set(block.id, { name: block.name, input: block.input });
    }
  }
  return map;
}

function getMessageText(message: ChatMessage): string {
  if (message.contentBlocks && message.contentBlocks.length > 0) {
    return message.contentBlocks
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n\n")
      .trim();
  }
  return message.content || "";
}

function AssistantMessage({ message, cwd }: { message: ChatMessage; cwd?: string }) {
  const blocks = message.contentBlocks || [];

  const grouped = useMemo(() => groupContentBlocks(blocks), [blocks]);
  const toolUseById = useMemo(() => mapToolUsesById(blocks), [blocks]);
  const copyText = useMemo(() => getMessageText(message), [message]);
  const downloadablePaths = useMemo(
    () => (!message.isStreaming && cwd ? extractDownloadablePaths(copyText) : []),
    [copyText, cwd, message.isStreaming],
  );

  if (blocks.length === 0 && message.content) {
    return (
      <div className="flex items-start gap-3">
        <AssistantAvatar />
        <div className="flex-1 min-w-0">
          <MarkdownContent text={message.content} showCursor={!!message.isStreaming} />
          {downloadablePaths.length > 0 && cwd && (
            <FileDownloadCards paths={downloadablePaths} cwd={cwd} />
          )}
          {!message.isStreaming && copyText && (
            <div className="mt-1.5">
              <CopyButton text={copyText} label="Copy response" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 group">
      <AssistantAvatar />
      <div className="flex-1 min-w-0 space-y-3">
        {grouped.map((group, i) => {
          if (group.kind === "content") {
            return <ContentBlockRenderer key={i} block={group.block} toolUseById={toolUseById} />;
          }
          if (group.items.length === 1) {
            const item = group.items[0];
            return <ToolBlock key={i} name={item.name} input={item.input} toolUseId={item.id} />;
          }
          return <ToolGroupBlock key={i} name={group.name} items={group.items} />;
        })}
        {downloadablePaths.length > 0 && cwd && (
          <FileDownloadCards paths={downloadablePaths} cwd={cwd} />
        )}
        {!message.isStreaming && copyText && (
          <div className="mt-1.5">
            <CopyButton text={copyText} label="Copy response" />
          </div>
        )}
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <div className="w-6 h-6 rounded-full bg-[rgba(255,79,163,0.12)] border border-[rgba(255,79,163,0.25)] flex items-center justify-center shrink-0 mt-0.5">
      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-[#ff4fa3]">
        <circle cx="8" cy="8" r="3" />
      </svg>
    </div>
  );
}

function MarkdownContent({ text, showCursor = false }: { text: string; showCursor?: boolean }) {
  return (
    <div className="markdown-body text-[14px] sm:text-[15px] text-[#f6f7fb] leading-relaxed overflow-hidden">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-3 last:mb-0">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[#f6f7fb]">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-[#f6f7fb] mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-[#f6f7fb] mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-[#f6f7fb] mt-3 mb-1">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-[#f6f7fb]">{children}</li>
          ),
          a: ({ href, children }) => {
            if (href && !href.startsWith("http") && !href.startsWith("//") && DOWNLOADABLE_EXTENSIONS.test(href)) {
              return <DownloadLink path={href}>{children}</DownloadLink>;
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#ff4fa3] hover:underline">
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[rgba(255,79,163,0.35)] pl-3 my-2 text-[#9ba3b4] italic">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="border-white/[0.08] my-4" />
          ),
          code: (props: ComponentProps<"code">) => {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = match || (typeof children === "string" && children.includes("\n"));

            if (isBlock) {
              const lang = match?.[1] || "";
              const codeText = typeof children === "string" ? children : String(children ?? "");
              return (
                <div className="my-2 rounded-2xl overflow-hidden border border-[rgba(255,79,163,0.2)] shadow-[0_18px_50px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[rgba(5,9,17,0.95)] border-b border-[rgba(255,79,163,0.15)]">
                    {lang ? (
                      <span className="text-[10px] text-[#ff4fa3]/70 font-mono-code uppercase tracking-wider">{lang}</span>
                    ) : (
                      <span />
                    )}
                    <CopyButton text={codeText} />
                  </div>
                  <pre className="px-2 sm:px-3 py-2 sm:py-2.5 bg-[rgba(5,9,17,0.92)] text-[#c4c9d6] text-[12px] sm:text-[13px] font-mono-code leading-relaxed overflow-x-auto">
                    <code>{children}</code>
                  </pre>
                </div>
              );
            }

            return (
              <code className="px-1.5 py-0.5 rounded-lg bg-[rgba(255,79,163,0.12)] text-[#ff8cc8] text-[13px] font-mono-code">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-sm border border-white/[0.08] rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[rgba(255,79,163,0.06)]">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-1.5 text-left text-xs font-semibold text-[#f6f7fb] border-b border-white/[0.08]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 text-xs text-[#c4c9d6] border-b border-white/[0.06]">
              {children}
            </td>
          ),
        }}
      >
        {text}
      </Markdown>
      {showCursor && (
        <span
          data-testid="assistant-stream-cursor"
          className="inline-block w-0.5 h-4 bg-[#ff4fa3] ml-0.5 align-middle animate-[pulse-dot_0.8s_ease-in-out_infinite]"
        />
      )}
    </div>
  );
}

function ContentBlockRenderer({
  block,
  toolUseById,
}: {
  block: ContentBlock;
  toolUseById: Map<string, ToolUseInfo>;
}) {
  if (block.type === "text") {
    return <MarkdownContent text={block.text} />;
  }

  if (block.type === "thinking") {
    return <ThinkingBlock text={block.thinking} />;
  }

  if (block.type === "tool_use") {
    return <ToolBlock name={block.name} input={block.input} toolUseId={block.id} />;
  }

  if (block.type === "tool_result") {
    const content = typeof block.content === "string" ? block.content : JSON.stringify(block.content);
    const linkedTool = toolUseById.get(block.tool_use_id);
    const toolName = linkedTool?.name;
    const isError = block.is_error ?? false;
    if (toolName === "Bash") {
      return <BashResultBlock text={content} isError={isError} />;
    }
    return (
      <div className={`text-xs font-mono-code rounded-lg px-3 py-2 border ${
        isError
          ? "bg-[#ff6b6b]/5 border-[#ff6b6b]/20 text-[#ff6b6b]"
          : "bg-[rgba(5,9,17,0.8)] border-white/[0.07] text-[#9ba3b4]"
      } max-h-40 overflow-y-auto whitespace-pre-wrap`}>
        {content}
      </div>
    );
  }

  return null;
}

function BashResultBlock({ text, isError }: { text: string; isError: boolean }) {
  const lines = text.split(/\r?\n/);
  const hasMore = lines.length > 20;
  const [showFull, setShowFull] = useState(false);
  const rendered = showFull || !hasMore ? text : lines.slice(-20).join("\n");

  return (
    <div className={`rounded-xl border ${
      isError
        ? "bg-[#ff6b6b]/5 border-[#ff6b6b]/20"
        : "bg-[rgba(5,9,17,0.8)] border-white/[0.07] shadow-[0_2px_12px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.04)]"
    }`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.07]">
        <span className={`text-[10px] font-medium ${
          isError ? "text-[#ff6b6b]" : "text-[#9ba3b4]"
        }`}>
          {hasMore && !showFull ? "Output (last 20 lines)" : "Output"}
        </span>
        {hasMore && (
          <button
            onClick={() => setShowFull(!showFull)}
            className="text-[10px] text-[#ff4fa3] hover:underline cursor-pointer"
          >
            {showFull ? "Show tail" : "Show full"}
          </button>
        )}
      </div>
      <pre className={`text-xs font-mono-code px-3 py-2 whitespace-pre-wrap max-h-60 overflow-y-auto ${
        isError ? "text-[#ff6b6b]" : "text-[#9ba3b4]"
      }`}>
        {rendered}
      </pre>
    </div>
  );
}

function ToolGroupBlock({ name, items }: { name: string; items: ToolGroupItem[] }) {
  const [open, setOpen] = useState(false);
  const iconType = getToolIcon(name);
  const label = getToolLabel(name);

  return (
    <div className="border border-white/[0.08] rounded-[10px] overflow-hidden bg-[rgba(13,17,32,0.8)] shadow-[0_2px_12px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.04] transition-colors cursor-pointer"
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-3 h-3 text-[#9ba3b4] transition-transform shrink-0 ${open ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <ToolIcon type={iconType} />
        <span className="text-xs font-medium text-[#f6f7fb]">{label}</span>
        <span className="text-[10px] text-[#9ba3b4] bg-white/[0.06] rounded-full px-1.5 py-0.5 tabular-nums">
          {items.length}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/[0.07] px-3 py-1.5">
          {items.map((item, i) => {
            const preview = getPreview(item.name, item.input);
            return (
              <div key={item.id || i} className="flex items-center gap-2 py-1 text-xs text-[#9ba3b4] font-mono-code truncate">
                <span className="w-1 h-1 rounded-full bg-[#9ba3b4]/40 shrink-0" />
                <span className="truncate">{preview || JSON.stringify(item.input).slice(0, 80)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] text-[#9ba3b4] hover:text-white transition-colors cursor-pointer px-2 py-0.5 rounded-md hover:bg-white/[0.055]"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-green-500">
            <path d="M2 8l4 4 8-8" />
          </svg>
          <span className="text-green-500">Copied!</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
            <rect x="5" y="2" width="8" height="10" rx="1.5" />
            <path d="M3 4H2.5A1.5 1.5 0 001 5.5v8A1.5 1.5 0 002.5 15h7A1.5 1.5 0 0011 13.5V13" />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

// Extensions that are user-facing output files (not source code)
const DOWNLOADABLE_EXTENSIONS = /\.(docx?|xlsx?|xlsm|pptx?|pdf|csv|zip|tar\.gz|gz|html?|png|jpg|jpeg|gif|webp|svg|mp4|mp3|wav)$/i;

const FILE_TYPE_LABELS: Record<string, string> = {
  xlsx: "Excel spreadsheet", xls: "Excel spreadsheet", xlsm: "Excel spreadsheet",
  docx: "Word document", doc: "Word document",
  pptx: "PowerPoint", ppt: "PowerPoint",
  pdf: "PDF document",
  csv: "CSV spreadsheet",
  zip: "ZIP archive", gz: "Archive", tar: "Archive",
  html: "HTML file", htm: "HTML file",
  png: "PNG image", jpg: "JPEG image", jpeg: "JPEG image",
  gif: "GIF image", webp: "WebP image", svg: "SVG image",
  mp4: "MP4 video", mp3: "MP3 audio", wav: "WAV audio",
};

export function extractDownloadablePaths(text: string): string[] {
  const paths = new Set<string>();

  // 1. Paths in backticks: `some/path/file.xlsx` or `file.xlsx`
  const backtickRe = /`([^`\n]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = backtickRe.exec(text)) !== null) {
    const candidate = m[1].trim();
    if (DOWNLOADABLE_EXTENSIONS.test(candidate) && !candidate.includes(" ")) {
      paths.add(candidate);
    }
  }

  // 2. Plain-text paths that contain at least one slash (reduces false positives)
  //    e.g. "saved to web/report.xlsx" but NOT bare "report.xlsx" in prose
  const slashPathRe = /(?:^|[\s,;:"])([./~]?(?:[\w.-]+\/)+[\w.-]+\.(?:xlsx?|xlsm|docx?|pptx?|pdf|csv|zip|html?|png|jpg|jpeg|gif|webp|mp4|mp3|wav))(?=[,\s.!?)"']|$)/gim;
  while ((m = slashPathRe.exec(text)) !== null) {
    const candidate = m[1].trim();
    // Skip if it looks like a JS/TS import or URL
    if (/^https?:\/\//.test(candidate)) continue;
    if (/\.(js|ts|tsx|jsx|css|json|md|py|rb|go|rs|java|sh)$/.test(candidate)) continue;
    paths.add(candidate);
  }

  return Array.from(paths);
}

function FileDownloadCards({ paths, cwd }: { paths: string[]; cwd: string }) {
  return (
    <div className="flex flex-col gap-2 mt-3">
      {paths.map((p) => (
        <FileDownloadCard key={p} filePath={p} cwd={cwd} />
      ))}
    </div>
  );
}

function FileDownloadCard({ filePath, cwd }: { filePath: string; cwd: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const filename = filePath.split("/").pop() || filePath;
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const absPath = filePath.startsWith("/") || filePath.startsWith("~")
    ? filePath
    : `${cwd}/${filePath}`;
  const typeLabel = FILE_TYPE_LABELS[ext] || "File";

  const handleDownload = async () => {
    setState("loading");
    try {
      const res = await fetch(`/api/fs/raw?path=${encodeURIComponent(absPath)}`);
      if (!res.ok) throw new Error("Not found");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
    }
  };

  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[rgba(10,14,24,0.85)] border border-[rgba(255,79,163,0.18)] max-w-sm shadow-[0_2px_12px_rgba(0,0,0,0.2)]">
      <div className="w-9 h-9 rounded-lg bg-[rgba(255,79,163,0.1)] border border-[rgba(255,79,163,0.18)] flex items-center justify-center shrink-0">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#ff4fa3]">
          <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z" />
          <polyline points="9 1 9 5 13 5" />
          <line x1="7" y1="9" x2="9" y2="9" />
          <line x1="7" y1="11" x2="9" y2="11" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-[#f6f7fb] truncate">{filename}</p>
        <p className="text-[11px] text-[#9ba3b4]">{typeLabel}</p>
      </div>
      <button
        onClick={handleDownload}
        disabled={state === "loading"}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-b from-[rgba(255,79,163,0.2)] to-[rgba(255,79,163,0.1)] text-[#ff4fa3] text-[12px] font-medium border border-[rgba(255,79,163,0.28)] hover:brightness-110 transition-all cursor-pointer disabled:opacity-50 shrink-0"
      >
        {state === "loading" ? (
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
            <path d="M8 2a6 6 0 016 6" strokeLinecap="round" />
          </svg>
        ) : state === "error" ? (
          <span className="text-[#ff6b6b]">Not found</span>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2v8M5 7l3 3 3-3" />
              <path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" />
            </svg>
            Download
          </>
        )}
      </button>
    </div>
  );
}

function DownloadLink({ path, children }: { path: string; children: ReactNode }) {
  const [downloading, setDownloading] = useState(false);
  const filename = path.split("/").pop() || "download";

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/fs/raw?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("File not found");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(path, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-b from-[rgba(255,79,163,0.12)] to-[rgba(255,79,163,0.08)] text-[#ff4fa3] text-[13px] hover:from-[rgba(255,79,163,0.2)] hover:to-[rgba(255,79,163,0.15)] transition-colors border border-[rgba(255,79,163,0.25)] cursor-pointer disabled:opacity-50 shadow-[0_1px_3px_rgba(255,79,163,0.15)]"
    >
      {downloading ? (
        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
          <path d="M8 2a6 6 0 016 6" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v8M5 7l3 3 3-3" />
          <path d="M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" />
        </svg>
      )}
      {children || filename}
    </button>
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const normalized = text.trim();
  const preview = normalized.replace(/\s+/g, " ").slice(0, 90);
  const [open, setOpen] = useState(Boolean(normalized));

  return (
    <div className="border border-white/[0.08] rounded-[12px] overflow-hidden bg-[rgba(13,17,32,0.8)] backdrop-blur-[3px] shadow-[0_2px_12px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-[#9ba3b4] hover:bg-white/[0.04] transition-colors cursor-pointer"
      >
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-[rgba(255,79,163,0.1)] text-[#ff4fa3] shrink-0">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
            <path d="M8 2.5a3.5 3.5 0 013.5 3.5c0 1.3-.7 2.1-1.4 2.8-.6.6-1.1 1.1-1.1 1.7V11" strokeLinecap="round" />
            <circle cx="8" cy="13" r="0.7" fill="currentColor" stroke="none" />
            <path d="M5.3 3.8A3.5 3.5 0 004.5 6c0 1.3.7 2.1 1.4 2.8.6.6 1.1 1.1 1.1 1.7V11" strokeLinecap="round" />
          </svg>
        </span>
        <span className="font-medium text-[#f6f7fb]">Reasoning</span>
        <span className="text-[#9ba3b4]/60">{text.length} chars</span>
        {!open && preview && (
          <span className="text-[#9ba3b4] truncate max-w-[55%]">{preview}</span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0">
          <div className="border border-white/[0.07] rounded-lg px-3 py-2 bg-[rgba(5,7,13,0.6)] max-h-60 overflow-y-auto">
            <div className="markdown-body text-[13px] text-[#9ba3b4] leading-relaxed">
              <Markdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  code: ({ children }) => (
                    <code className="px-1.5 py-0.5 rounded-md bg-[rgba(255,79,163,0.1)] text-[#ff8cc8] font-mono-code text-[12px]">
                      {children}
                    </code>
                  ),
                }}
              >
                {normalized || "No thinking text captured."}
              </Markdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
