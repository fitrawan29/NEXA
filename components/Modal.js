    // Komponen Modal Premium (Pengganti Alert dan Confirm bawaan browser)
    const Modal = ({ isOpen, title, message, onClose, type = 'info', children, onConfirm, confirmText = "Lanjutkan" }) => {
      if (!isOpen) return null;
      const bgColors = { info: 'bg-blue-600', warning: 'bg-yellow-500', error: 'bg-red-600', success: 'bg-green-600' };

      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 transition-opacity">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up transform transition-all">
            <div className={`${bgColors[type]} p-5 text-white font-bold text-lg flex items-center justify-between`}>
              {title}
            </div>
            <div className="p-6 text-gray-700 font-medium leading-relaxed">
              {message}
              {children}
            </div>
            <div className="p-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              {onConfirm && (
                <button onClick={onClose} className="px-5 py-2 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors font-bold shadow-sm">
                  Batal
                </button>
              )}
              <button onClick={onConfirm ? onConfirm : onClose} className={`px-6 py-2 text-white rounded-xl transition-colors font-bold shadow-md ${onConfirm ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-700'}`}>
                {onConfirm ? confirmText : "Mengerti"}
              </button>
            </div>
          </div>
        </div>
      );
    };
