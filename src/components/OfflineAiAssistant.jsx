import React, { useState, useRef, useEffect } from 'react';
import {
  matchAssistantQuery,
  getRoleQuickSuggestions,
  triggerVisualCue,
  ROLE_DISPLAY_NAMES
} from '../utils/aiAssistantEngine.js';

/**
 * OfflineAiAssistant - Responsive Floating AI Assistant Widget
 * 100% Offline, Zero External API, Sub-20ms Natural Language Navigation
 */
const OfflineAiAssistant = ({
  role = 'siswa',
  user = {},
  onNavigate = () => {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [lastNavMessage, setLastNavMessage] = useState('');
  const [messages, setMessages] = useState(() => {
    const roleName = ROLE_DISPLAY_NAMES[role] || 'Pengguna';
    const userName = user?.nama_lengkap || user?.nama || user?.username || roleName;
    return [
      {
        id: 'welcome',
        sender: 'assistant',
        timestamp: Date.now(),
        text: `Halo **${userName}**! Saya Asisten Offline NEXA CBT. Tanyakan menu atau fitur apa pun yang Anda cari, dan saya akan memberikan panduan serta tombol pintasan langsung.`,
        action: null,
        suggestions: getRoleQuickSuggestions(role).slice(0, 4)
      }
    ];
  });

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const triggerBtnRef = useRef(null);
  const navMessageTimerRef = useRef(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Focus input when opened with timer cleanup
  useEffect(() => {
    let timer;
    if (isOpen) {
      timer = setTimeout(() => inputRef.current?.focus(), 150);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

  // Clean up navigation message timer on unmount
  useEffect(() => {
    return () => {
      if (navMessageTimerRef.current) clearTimeout(navMessageTimerRef.current);
    };
  }, []);

  // Close on Escape key and restore focus to trigger button
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSendMessage = (textToSend) => {
    const query = (textToSend || inputValue).trim();
    if (!query) return;

    // Add user message
    const userMsg = {
      id: `user_${Date.now()}`,
      sender: 'user',
      timestamp: Date.now(),
      text: query
    };

    // Run offline intent match
    const result = matchAssistantQuery(query, role);

    let assistantMsg;
    if (result.status === 'matched') {
      assistantMsg = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        timestamp: Date.now(),
        title: result.title,
        text: result.description,
        steps: result.steps || [],
        action: result.action,
        executionTimeMs: result.executionTimeMs,
        suggestions: result.relatedSuggestions || []
      };
    } else if (result.status === 'unauthorized') {
      assistantMsg = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        timestamp: Date.now(),
        isUnauthorized: true,
        text: result.message,
        action: null,
        executionTimeMs: result.executionTimeMs,
        suggestions: result.allowedSuggestions || []
      };
    } else {
      assistantMsg = {
        id: `ast_${Date.now()}`,
        sender: 'assistant',
        timestamp: Date.now(),
        text: result.message,
        action: null,
        executionTimeMs: result.executionTimeMs,
        suggestions: result.suggestions || []
      };
    }

    // Bound message history in React state to prevent unbounded memory growth
    setMessages((prev) => [...prev.slice(-38), userMsg, assistantMsg]);
    setInputValue('');
  };

  const handleActionClick = (action) => {
    if (!action) return;

    if (navMessageTimerRef.current) clearTimeout(navMessageTimerRef.current);
    setLastNavMessage(`Membuka ${action.label || 'menu'}...`);
    navMessageTimerRef.current = setTimeout(() => setLastNavMessage(''), 2500);

    // 1. Programmatically trigger navigation callback
    if (typeof onNavigate === 'function') {
      onNavigate(action.tab, action.modal, action.selector);
    }

    // 2. Trigger visual cueing (highlight & scroll)
    if (action.selector) {
      setTimeout(() => {
        triggerVisualCue(action.selector, 3000);
      }, 100);
    }

    // Collapse assistant panel so user can immediately see and interact with target view/modal
    setIsOpen(false);
  };

  const handleResetChat = () => {
    const roleName = ROLE_DISPLAY_NAMES[role] || 'Pengguna';
    const userName = user?.nama_lengkap || user?.nama || user?.username || roleName;
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        sender: 'assistant',
        timestamp: Date.now(),
        text: `Halo **${userName}**! Percakapan di-reset. Ada menu atau panduan lain yang bisa saya bantu?`,
        action: null,
        suggestions: getRoleQuickSuggestions(role).slice(0, 4)
      }
    ]);
  };

  const currentRoleName = ROLE_DISPLAY_NAMES[role] || role;

  return (
    <>
      {/* ------------------------------------------------------------------- */}
      {/* 1. FLOATING ASSISTANT TRIGGER BUTTON (BUBBLE)                      */}
      {/* ------------------------------------------------------------------- */}
      <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end pointer-events-auto">
        {lastNavMessage && (
          <div className="mb-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg animate-fade-in-up flex items-center gap-1.5 border border-emerald-400">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            <span>{lastNavMessage}</span>
          </div>
        )}

        <button
          ref={triggerBtnRef}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-controls="assistant-dialog"
          className={`group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-full shadow-2xl transition-all duration-300 active:scale-95 border ${
            isOpen
              ? 'bg-slate-800 text-white border-slate-700'
              : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white border-emerald-400/40 hover:shadow-emerald-500/25 hover:scale-105'
          }`}
          aria-label={isOpen ? 'Tutup Asisten AI NEXA' : 'Buka Asisten AI NEXA (Offline)'}
          title="Asisten Cerdas NEXA (100% Offline)"
        >
          {/* Animated Glow / Pulse Ring */}
          {!isOpen && (
            <span className="absolute -inset-1 rounded-full bg-emerald-400/30 animate-pulse pointer-events-none"></span>
          )}

          <div className="relative w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[20px]">
              {isOpen ? 'close' : 'smart_toy'}
            </span>
          </div>

          <div className="hidden sm:flex flex-col text-left pr-1">
            <span className="text-xs font-bold leading-tight">Asisten NEXA</span>
            <span className="text-[10px] opacity-90 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-ping inline-block"></span>
              Offline AI
            </span>
          </div>
        </button>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* 2. CHAT PANEL MODAL / FLYOUT                                        */}
      {/* ------------------------------------------------------------------- */}
      {isOpen && (
        <div
          id="assistant-dialog"
          className="fixed bottom-20 sm:bottom-20 right-2 sm:right-6 z-50 w-[calc(100vw-1rem)] sm:w-[390px] max-w-[420px] h-[500px] max-h-[calc(100dvh-5.5rem)] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] overflow-hidden animate-scale-up"
          role="dialog"
          aria-modal="false"
          aria-labelledby="assistant-title"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">smart_toy</span>
              </div>
              <div className="min-w-0">
                <h3 id="assistant-title" className="font-bold text-sm leading-tight truncate">
                  Asisten NEXA
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] opacity-90">
                  <span className="px-1.5 py-0.2 rounded-md bg-white/20 font-bold uppercase tracking-wider text-[9px]">
                    {currentRoleName}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-medium text-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-200"></span>
                    100% Offline
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleResetChat}
                className="w-7 h-7 rounded-lg hover:bg-white/20 flex items-center justify-center text-white/90 hover:text-white transition-colors"
                title="Reset Percakapan"
                aria-label="Reset Percakapan"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  triggerBtnRef.current?.focus();
                }}
                className="w-7 h-7 rounded-lg hover:bg-white/20 flex items-center justify-center text-white/90 hover:text-white transition-colors"
                title="Tutup Panel Asisten"
                aria-label="Tutup Panel Asisten"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Quick Suggestion Chips Ribbon */}
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0 text-xs">
            <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0 pl-1">
              Cepat:
            </span>
            {getRoleQuickSuggestions(role).map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold text-[11px] transition-all shrink-0 active:scale-95 shadow-2xs"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Conversation Stream */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 text-xs bg-slate-100/40 dark:bg-slate-900/60">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fade-in`}
                >
                  {/* Message Bubble */}
                  <div
                    className={`max-w-[88%] rounded-2xl p-3 shadow-xs ${
                      isUser
                        ? 'bg-emerald-600 text-white rounded-br-xs'
                        : msg.isUnauthorized
                        ? 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-slate-800 dark:text-slate-200 rounded-bl-xs'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-xs'
                    }`}
                  >
                    {/* Unauthorized Badge */}
                    {msg.isUnauthorized && (
                      <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold text-[11px] mb-1.5 pb-1 border-b border-amber-200 dark:border-amber-800/60">
                        <span className="material-symbols-outlined text-[16px]">lock</span>
                        <span>Akses Dibatasi</span>
                      </div>
                    )}

                    {/* Matched Title */}
                    {msg.title && (
                      <div className="font-bold text-xs text-emerald-700 dark:text-emerald-400 mb-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">navigation</span>
                        <span>{msg.title}</span>
                      </div>
                    )}

                    {/* Message Body */}
                    <div className="leading-relaxed whitespace-pre-line text-[11.5px]">
                      {msg.text}
                    </div>

                    {/* Step-by-Step Guidance */}
                    {msg.steps && msg.steps.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1">
                        <p className="font-bold text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Panduan Langkah:
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                          {msg.steps.map((st, sIdx) => (
                            <li key={sIdx} className="leading-snug">
                              {st}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Prominent Direct Navigation Action Button (R3) */}
                    {msg.action && (
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => handleActionClick(msg.action)}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all group"
                        >
                          <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform">
                            open_in_new
                          </span>
                          <span>{msg.action.label || 'Buka Menu'}</span>
                        </button>
                      </div>
                    )}

                    {/* Latency Footnote */}
                    {msg.executionTimeMs !== undefined && (
                      <div className="mt-2 text-[9px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
                        <span>Offline Lexical Match</span>
                        <span>{msg.executionTimeMs.toFixed(1)}ms</span>
                      </div>
                    )}
                  </div>

                  {/* Contextual Suggestion Chips */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 max-w-[90%]">
                      {msg.suggestions.map((sug, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleSendMessage(sug)}
                          className="px-2 py-0.8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200 dark:border-emerald-800/80 text-[10px] font-semibold transition-colors flex items-center gap-1 active:scale-95"
                        >
                          <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                          <span>{sug}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input & Form Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Tanya menu, nilai, soal, jadwal..."
              aria-label="Ketik pertanyaan untuk asisten"
              className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 px-3.5 py-2.5 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 border border-transparent focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="w-9 h-9 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-sm"
              title="Kirim Pertanyaan"
              aria-label="Kirim Pertanyaan"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          </form>

          {/* Offline Footer Note */}
          <div className="py-1 px-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 text-[9px] text-center text-slate-400 dark:text-slate-500 font-medium">
            100% Offline • Bebas Kuota • Zero Network API
          </div>
        </div>
      )}
    </>
  );
};

export default OfflineAiAssistant;
