import React from 'react';
import type { UseIncognitoModeReturn } from '../hooks/useIncognitoMode';

interface IncognitoToggleProps extends UseIncognitoModeReturn {
    className?: string;
    compact?: boolean;
}

export const IncognitoToggle: React.FC<IncognitoToggleProps> = ({
    isIncognito, toggleIncognito, className = '', compact = false,
}) => {
    const label = isIncognito ? 'Disable incognito mode' : 'Enable incognito mode';

    if (compact) {
        // Render two separate buttons so aria-checked is always a literal
        if (isIncognito) {
            return (
                <button type="button" role="switch" aria-checked="true" aria-label={label}
                    onClick={toggleIncognito} title="Incognito on"
                    className={['h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 bg-violet-600/20 text-violet-400 ring-1 ring-violet-500/40', className].join(' ')}>
                    <span aria-hidden="true" className="text-base leading-none">👻</span>
                </button>
            );
        }
        return (
            <button type="button" role="switch" aria-checked="false" aria-label={label}
                onClick={toggleIncognito} title="Incognito off"
                className={['h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700', className].join(' ')}>
                <span aria-hidden="true" className="text-base leading-none">👻</span>
            </button>
        );
    }

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={['h-9 w-9 rounded-xl flex items-center justify-center text-lg transition-all duration-300',
                        isIncognito ? 'bg-violet-600/20 ring-1 ring-violet-500/40' : 'bg-zinc-800'].join(' ')}>
                        👻
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white leading-tight">Incognito Mode</p>
                        <p className="text-xs text-zinc-500 leading-tight">
                            {isIncognito ? 'Activity hidden from friends' : 'Friends can see your activity'}
                        </p>
                    </div>
                </div>

                {/* Two separate buttons so aria-checked is always a literal string */}
                {isIncognito ? (
                    <button type="button" role="switch" aria-checked="true" aria-label={label}
                        onClick={toggleIncognito}
                        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-violet-600 transition-colors duration-300 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500">
                        <span aria-hidden="true" className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-message transition-transform duration-300 ease-in-out translate-x-5" />
                    </button>
                ) : (
                    <button type="button" role="switch" aria-checked="false" aria-label={label}
                        onClick={toggleIncognito}
                        className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-zinc-700 transition-colors duration-300 ease-in-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500">
                        <span aria-hidden="true" className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-message transition-transform duration-300 ease-in-out translate-x-0" />
                    </button>
                )}
            </div>

            <div aria-live="polite" aria-atomic="true">
                {isIncognito && (
                    <div role="status" className="flex items-center gap-2 rounded-xl px-3 py-2 bg-violet-950/60 border border-violet-800/50 animate-fade-in">
                        <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 shrink-0 text-violet-400">
                            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
                        </svg>
                        <p className="text-xs text-violet-300">
                            <span className="font-semibold text-violet-200">Profile status hidden.</span>
                            {' '}Process scanning paused.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IncognitoToggle;
