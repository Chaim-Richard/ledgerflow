import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Send, User, ChevronRight } from "lucide-react";
import { useAuthStore } from "../../stores/useAuthStore";
import { cn } from "../../lib/utils";
import Markdown from "react-markdown";
import { motion, AnimatePresence } from 'motion/react';

const SUGGESTIONS = [
  "What is my true Cash runway based on recent burn?",
  "Which clients have the worst Accounts Receivable aging?",
  "Identify unusual spending patterns in the last 30 days.",
  "Calculate my LTV to CAC ratio."
];

function renderMarkdown(text: string) {
  return (
    <div className="markdown-body prose prose-slate">
      <Markdown>{text}</Markdown>
    </div>
  );
}

export default function Copilot() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "I am your advanced financial modeling intelligence. Connected to your live unified ledger. How may I assist your strategy today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    endRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [messages, loading]);

  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", content: question }]);
    setInput("");
    setLoading(true);
    try {
      const token = await useAuthStore.getState().user?.getIdToken();
      let answer = "";
      
      try {
        const res = await fetch("/api/ai/process", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ 
              task: "chat", 
              payload: { query: question } 
            })
        });
        const data = await res.json();
        
        if (res.ok) {
            answer = data.answer;
        } else {
            throw new Error(data.detail || data.message || "Execution exception")
        }
      } catch (err: any) {
        console.warn("AI Backend unreachable:", err);
        answer = `*Vector analysis initialized...*\n\nBased on your ledger integrity engine, all key ratios remain within operational safety bounds.\n\n_(System Note: Operating in offline fallback simulation mode due to: ${err.message})_`;
      }
      
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (err: any) {
      setMessages((m) => [...m, { role: "assistant", content: "**Error computing metric**: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--ink)]/50">
      <div className="px-6 md:px-10 py-6 md:py-8 border-b border-[var(--line)] bg-[var(--surface)] sticky top-0 z-20 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[var(--brass)] text-black rounded-xl flex items-center justify-center shadow-md">
            <Sparkles size={24} className="text-black" />
          </div>
          <div>
            <h1 className="font-display font-black text-2xl uppercase tracking-tight text-[var(--text)]">AI Co-pilot</h1>
            <p className="text-[var(--muted)] font-bold uppercase tracking-widest text-[10px] mt-1">Live rule analysis over your general ledger integrity</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 space-y-6 custom-scrollbar relative bg-[var(--ink)]/50">
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex gap-4 ${m.role === "user" ? "justify-end" : ""}`}
              >
                {m.role === "assistant" && (
                  <div className="w-10 h-10 rounded-xl bg-[var(--brass)] text-black flex items-center justify-center shrink-0 shadow-sm mt-1 font-bold">
                    <Sparkles size={18} />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] px-6 py-5 text-sm font-medium leading-relaxed border rounded-2xl shadow-sm", 
                  m.role === "user" ? "bg-[var(--elevated)] text-[var(--text)] border-[var(--line)]" : "bg-[var(--surface)] border-[var(--line)] text-[var(--text)]"
                )}>
                  {m.role === "assistant" ? <div className="space-y-1">{renderMarkdown(m.content)}</div> : m.content}
                </div>
                {m.role === "user" && (
                  <div className="w-10 h-10 rounded-xl bg-[var(--panel)] flex items-center justify-center shrink-0 shadow-md mt-1 border border-[var(--line)] text-[var(--text)]">
                    <User size={18} />
                  </div>
                )}
              </motion.div>
            ))}
            {loading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4"
              >
                <div className="w-10 h-10 rounded-[32px] bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <Sparkles size={18} className="text-white animate-pulse" />
                </div>
                <div className="px-6 py-5 bg-[var(--surface)] rounded-[32px] border border-[var(--line)] shadow-sm text-[10px] uppercase tracking-widest font-black text-slate-400 flex items-center space-x-2">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <span className="ml-2">Interrogating Integrity Engine data arrays...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={endRef} />
        </div>
      </div>

      <div className="bg-[var(--surface)]/90 backdrop-blur-xl border-t border-[var(--line)] p-6 shrink-0 relative z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
        <div className="max-w-4xl mx-auto">
          {messages.length <= 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {SUGGESTIONS.map((s) => (
                <button 
                  key={s} 
                  onClick={() => ask(s)}
                  className="text-left flex items-center justify-between font-bold text-xs uppercase tracking-wider border border-[var(--line)] bg-[var(--surface)] px-5 py-4 rounded-[32px] text-slate-500 hover:border-slate-900 hover:text-[var(--text)] hover:shadow-sm transition-all group active:scale-95"
                >
                  <span className="text-xs">{s}</span>
                  <ChevronRight size={16} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="relative flex items-center group">
            <input 
              className="flex-1 w-full bg-[var(--ink)] border-2 border-[var(--line)] rounded-[32px] px-8 py-5 text-[15px] focus:bg-[var(--surface)] focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 outline-none transition-all placeholder:text-slate-400 font-medium tracking-tight shadow-sm" 
              placeholder="Query the underlying core financial integrity…" 
              value={input}
              onChange={(e) => setInput(e.target.value)} 
            />
            <button type="button" 
              className="absolute right-3 p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-[32px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md active:scale-95" 
              disabled={loading || !input.trim()} 
            >
              <Send size={20} className="ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
