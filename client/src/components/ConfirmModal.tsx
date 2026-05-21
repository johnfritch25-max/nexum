import React from 'react';

interface ConfirmModalProps {
    isOpen:      boolean;
    title:       string;
    message:     string;
    confirmLabel?: string;
    cancelLabel?:  string;
    danger?:     boolean;
    onConfirm:   () => void;
    onCancel:    () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen, title, message,
    confirmLabel = 'Confirm',
    cancelLabel  = 'Cancel',
    danger = false,
    onConfirm, onCancel,
}) => {
    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={onCancel} aria-hidden="true" />
            <div role="dialog" aria-modal="true" aria-label={title}
                className={[
                    'fixed z-[80] bg-zinc-900 flex flex-col shadow-2xl',
                    'bottom-0 left-0 right-0 rounded-t-2xl sheet-up',
                    'md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2',
                    'md:w-[360px] md:rounded-2xl md:border md:border-zinc-800/60 md:animate-scale-in',
                ].join(' ')}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Drag handle mobile */}
                <div className="flex justify-center pt-3 pb-1 md:hidden" aria-hidden="true">
                    <div className="h-1 w-10 rounded-full bg-zinc-700" />
                </div>

                <div className="p-5 flex flex-col gap-4">
                    {/* Icon */}
                    <div className={['h-12 w-12 rounded-2xl flex items-center justify-center mx-auto',
                        danger ? 'bg-red-950/60' : 'bg-zinc-800'].join(' ')}>
                        {danger ? (
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-red-400">
                                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-zinc-400">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        )}
                    </div>

                    {/* Text */}
                    <div className="text-center">
                        <h2 className="text-base font-semibold text-white">{title}</h2>
                        <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{message}</p>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2 mt-1">
                        <button type="button" onClick={onCancel}
                            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors active:scale-[0.98]">
                            {cancelLabel}
                        </button>
                        <button type="button" onClick={onConfirm}
                            className={['flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors active:scale-[0.98]',
                                danger
                                    ? 'bg-red-600 hover:bg-red-500 text-white'
                                    : 'bg-violet-600 hover:bg-violet-500 text-white'].join(' ')}>
                            {confirmLabel}
                        </button>
                    </div>
                </div>
                <div className="safe-bottom md:hidden" />
            </div>
        </>
    );
};

export default ConfirmModal;
