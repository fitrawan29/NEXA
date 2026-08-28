import React, { useState, useEffect, useRef } from 'react';
// components/UI.js
window.safeJSONParse = (str, fallback) => {
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.warn("JSON parse error:", e);
    return fallback;
  }
};

const EmptyState = ({ icon, title, message, actionText, onAction }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant dark:border-slate-700 animate-fade-in-up">
      <div className="w-24 h-24 mb-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
        <span className="material-symbols-outlined text-5xl">{icon || 'folder_open'}</span>
      </div>
      <h3 className="text-xl font-bold text-on-surface dark:text-white mb-2">{title || 'Data Kosong'}</h3>
      <p className="text-slate-500 max-w-sm mb-6">{message || 'Belum ada data yang dapat ditampilkan di sini.'}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="px-6 py-2 bg-primary text-on-primary rounded-xl font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5">
          <span className="material-symbols-outlined text-[18px]">add</span> {actionText}
        </button>
      )}
    </div>
  );
};

const TableSkeleton = ({ rows = 5, columns = 4 }) => {
  return (
    <div className="w-full animate-pulse overflow-hidden bg-surface dark:bg-slate-800 rounded-2xl border border-outline-variant dark:border-slate-700">
      <div className="flex border-b border-outline-variant/30 dark:border-slate-700 bg-surface-variant/30 dark:bg-slate-800/80 p-4 gap-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={'th'+i} className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={'tr'+r} className="flex p-4 gap-4 border-b border-outline-variant/30 dark:border-slate-700">
          {Array.from({ length: columns }).map((_, c) => (
            <div key={'td'+r+c} className="h-4 bg-slate-100 dark:bg-slate-700/50 rounded w-full"></div>
          ))}
        </div>
      ))}
    </div>
  );
};

const CardSkeleton = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface dark:bg-slate-800 p-lg rounded-2xl border border-outline-variant dark:border-slate-700 animate-pulse h-32 flex flex-col justify-center">
          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 mb-4"></div>
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-slate-100 dark:bg-slate-700/50 rounded w-1/2"></div>
        </div>
      ))}
    </div>
  );
};

window.EmptyState = EmptyState;
window.TableSkeleton = TableSkeleton;
window.CardSkeleton = CardSkeleton;

// useSupabaseRealtime and safeJSONParse are now defined in api.js
// which loads before this file, so they are always available globally.
