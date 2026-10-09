import React from 'react';
import { AlertTriangle, Trash2, CheckCircle2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Ya, Lanjutkan',
  cancelText = 'Batal',
  type = 'danger',
  onConfirm,
  onCancel,
  isLoading = false
}) => {
  if (!isOpen) return null;

  const getTheme = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />,
          iconBg: 'bg-rose-100 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900',
          btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
          iconBg: 'bg-amber-100 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900',
          btn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20'
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
          iconBg: 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900',
          btn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
        };
      default:
        return {
          icon: <AlertTriangle className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
          iconBg: 'bg-blue-100 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900',
          btn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
        };
    }
  };

  const theme = getTheme();

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 relative">
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-2xl border shrink-0 ${theme.iconBg}`}>
            {theme.icon}
          </div>
          <div className="space-y-1.5 flex-1 pr-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end space-x-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors min-h-[38px]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 text-xs font-black rounded-xl shadow-md transition-all flex items-center space-x-1.5 min-h-[38px] ${theme.btn}`}
          >
            {isLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
