import React from 'react';

const Modal = ({ isOpen, title, message, onClose, type = 'info', children, onConfirm, confirmText = "Lanjutkan" }) => {
  if (!isOpen) return null;
  const bgColors = { info: 'bg-blue-600', warning: 'bg-amber-500', error: 'bg-red-600', success: 'bg-green-600' };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 transition-opacity">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up transform transition-all border border-slate-200 dark:border-slate-700">
        <div className={`${bgColors[type]} p-5 text-white font-bold text-lg flex items-center justify-between`}>
          {title}
        </div>
        <div className="p-6 text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
          {message}
          {children}
        </div>
        <div className="p-5 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
          {onConfirm && (
            <button onClick={onClose} className="px-5 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-bold shadow-sm">
              Batal
            </button>
          )}
          <button onClick={onConfirm ? onConfirm : onClose} className={`px-6 py-2.5 text-white rounded-xl transition-all font-bold shadow-lg active:scale-95 ${onConfirm ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-slate-800 dark:bg-primary hover:bg-slate-700 dark:hover:bg-primary-dark shadow-slate-800/30 dark:shadow-primary/30'}`}>
            {onConfirm ? confirmText : "Mengerti"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
