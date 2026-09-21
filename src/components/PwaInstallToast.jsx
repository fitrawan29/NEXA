import React, { useState, useEffect } from 'react';
import nexaLogo from '../assets/screen_3_logo.png';

/**
 * PwaInstallToast
 * Non-intrusive floating toast notification prompting users to install NEXA CBT as a PWA.
 * Floats at bottom-right corner (bottom-20 on mobile to clear bottom navigation bar, bottom-6 on desktop).
 * Automatically suppresses during active exam sessions (ExamRoom) or in standalone mode.
 */
export default function PwaInstallToast({
  isExamActive = false,
  activeExam = false,
  inExam = false,
  examActive = false,
  activeView = ''
}) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isPrompting, setIsPrompting] = useState(false);

  // Helper to determine if an exam session is currently active
  const checkExamActive = () => {
    if (isExamActive || activeExam || inExam || examActive || activeView === 'exam_room') {
      return true;
    }
    try {
      if (typeof window !== 'undefined') {
        if (window.location.hash.includes('exam') || window.location.pathname.includes('exam')) {
          return true;
        }
        if (sessionStorage.getItem('nexa_active_exam')) {
          return true;
        }
        if (document.querySelector('.exam-room-container') || document.querySelector('[data-exam-room]')) {
          return true;
        }
      }
    } catch (err) {}
    return false;
  };

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
       window.navigator.standalone === true);

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Check if user already dismissed the prompt
    const isDismissed =
      typeof window !== 'undefined' &&
      (localStorage.getItem('nexa_pwa_prompt_dismissed') === 'true' ||
       sessionStorage.getItem('nexa_pwa_prompt_dismissed') === 'true' ||
       !!localStorage.getItem('nexa_pwa_dismissed_at'));

    if (isDismissed) {
      return;
    }

    // 3. Listen for the native beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!checkExamActive()) {
        setIsVisible(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
      console.log('[PWA] NEXA CBT app was successfully installed.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isExamActive, activeExam, inExam, examActive, activeView]);

  // Hide toast if an exam begins while it is displayed
  useEffect(() => {
    if (checkExamActive() && isVisible) {
      setIsVisible(false);
    }
  }, [isExamActive, activeExam, inExam, examActive, activeView, isVisible]);

  const handleInstallClick = async () => {
    if (isPrompting || !deferredPrompt) return;
    setIsPrompting(true);

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
    } catch (err) {
      console.warn('[PWA] Installation prompt error:', err);
    } finally {
      setIsPrompting(false);
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem('nexa_pwa_prompt_dismissed', 'true');
      sessionStorage.setItem('nexa_pwa_prompt_dismissed', 'true');
      localStorage.setItem('nexa_pwa_dismissed_at', Date.now().toString());
    } catch (err) {}
  };

  if (!isVisible || !deferredPrompt || isInstalled || checkExamActive()) {
    return null;
  }

  return (
    <aside
      role="region"
      aria-label="Notifikasi Instal Aplikasi NEXA"
      className="fixed bottom-20 md:bottom-6 right-4 z-50 max-w-sm w-[calc(100%-2rem)] md:w-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl p-4 transition-all duration-300 animate-slide-up"
    >
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex-shrink-0 flex items-center justify-center p-1.5 shadow-inner">
          <img src={nexaLogo} alt="NEXA Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white leading-snug">
            Instal Aplikasi NEXA
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
            Akses ujian lebih cepat, stabil, & hemat kuota dalam mode layar penuh.
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={isPrompting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-75"
            >
              <span className="material-symbols-outlined text-[15px]">download</span>
              Instal Sekarang
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Nanti Saja
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 -mr-1 -mt-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Tutup"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </aside>
  );
}
