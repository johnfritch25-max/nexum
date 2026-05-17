import React, { useState } from 'react';
import type { UseAuthReturn } from '../hooks/useAuth';

interface AuthFormProps {
    onLogin:    UseAuthReturn['login'];
    onRegister: UseAuthReturn['register'];
    error:      string | null;
    isLoading:  boolean;
}

const inputCls = 'rounded-xl bg-zinc-800/80 border border-zinc-700/60 px-3.5 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all duration-150';
const labelCls = 'text-xs font-medium text-zinc-400 px-1';

export const AuthForm: React.FC<AuthFormProps> = ({ onLogin, onRegister, error, isLoading }) => {
    const [mode, setMode]               = useState<'login' | 'register'>('login');
    const [loginId, setLoginId]         = useState('');
    const [username, setUsername]       = useState('');
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail]             = useState('');
    const [password, setPassword]       = useState('');
    const [localError, setLocalError]   = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        try {
            if (mode === 'login') {
                await onLogin(loginId, password);
            } else {
                if (!username || !displayName || !email || !password) {
                    setLocalError('All fields are required.');
                    return;
                }
                await onRegister(username, displayName, email, password);
            }
        } catch { /* surfaced via error prop */ }
    };

    const displayedError = localError ?? error;

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden safe-top safe-bottom">
            <div className="absolute top-[-20%] left-[-10%] w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-violet-900/20 rounded-full blur-[80px] sm:blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[250px] sm:w-[400px] h-[250px] sm:h-[400px] bg-violet-800/15 rounded-full blur-[60px] sm:blur-[100px] pointer-events-none" />

            <div className="relative w-full max-w-sm animate-slide-up">
                <div className="bg-zinc-900/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-zinc-800/60 p-6 sm:p-8 shadow-2xl flex flex-col gap-5 sm:gap-6">

                    {/* Logo */}
                    <div className="text-center flex flex-col items-center gap-2.5 sm:gap-3">
                        <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-glow-violet">
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 sm:h-7 sm:w-7 text-white">
                                <path d="M4.913 2.658c2.075-.27 4.19-.408 6.337-.408 2.147 0 4.262.139 6.337.408 1.922.25 3.291 1.861 3.405 3.727a4.403 4.403 0 00-1.032-.211 50.89 50.89 0 00-8.42 0c-2.358.196-4.04 2.19-4.04 4.434v4.286a4.47 4.47 0 002.433 3.984L7.28 21.53A.75.75 0 016 21v-4.03a48.527 48.527 0 01-1.087-.128C2.905 16.58 1.5 14.833 1.5 12.862V6.638c0-1.97 1.405-3.718 3.413-3.979z" />
                                <path d="M15.75 7.5c-1.376 0-2.739.057-4.086.169C10.124 7.797 9 9.103 9 10.609v4.285c0 1.507 1.128 2.814 2.67 2.94 1.243.102 2.5.157 3.768.165l2.782 2.781a.75.75 0 001.28-.53v-2.39l.33-.026c1.542-.125 2.67-1.433 2.67-2.94v-4.286c0-1.505-1.125-2.811-2.664-2.94A49.392 49.392 0 0015.75 7.5z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Nexum</h1>
                            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                                {mode === 'login' ? 'Welcome back' : 'Create your account'}
                            </p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-zinc-800/60 rounded-xl p-1 gap-1">
                        {(['login', 'register'] as const).map((m) => (
                            <button key={m} type="button" onClick={() => { setMode(m); setLocalError(null); }}
                                className={['flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500',
                                    mode === m ? 'bg-violet-600 text-white shadow-glow-sm' : 'text-zinc-400 hover:text-zinc-200'].join(' ')}>
                                {m === 'login' ? 'Sign in' : 'Register'}
                            </button>
                        ))}
                    </div>

                    {/* Error */}
                    {displayedError && (
                        <div role="alert" className="flex items-start gap-2 rounded-xl bg-red-950/60 border border-red-800/60 px-3 py-2.5 text-sm text-red-300 animate-fade-in">
                            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 mt-0.5 text-red-400">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            {displayedError}
                        </div>
                    )}

                    {/* Form — all inputs inlined so autoComplete values are always literals */}
                    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">

                        {mode === 'register' && (
                            <>
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="reg-username" className={labelCls}>Username</label>
                                    <input id="reg-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                                        placeholder="alice_dev" autoComplete="username" required className={inputCls} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="reg-name" className={labelCls}>Display name</label>
                                    <input id="reg-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                                        placeholder="Alice Nguyen" autoComplete="name" required className={inputCls} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label htmlFor="reg-email" className={labelCls}>Email</label>
                                    <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                        placeholder="alice@example.com" autoComplete="email" required className={inputCls} />
                                </div>
                            </>
                        )}

                        {mode === 'login' && (
                            <div className="flex flex-col gap-1">
                                <label htmlFor="login-id" className={labelCls}>Username or email</label>
                                <input id="login-id" type="text" value={loginId} onChange={(e) => setLoginId(e.target.value)}
                                    placeholder="alice or alice@example.com" autoComplete="username" required className={inputCls} />
                            </div>
                        )}

                        {/* Password — two separate inputs so autoComplete is always a literal */}
                        {mode === 'login' ? (
                            <div className="flex flex-col gap-1">
                                <label htmlFor="pw-login" className={labelCls}>Password</label>
                                <input id="pw-login" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••" autoComplete="current-password" required className={inputCls} />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <label htmlFor="pw-register" className={labelCls}>Password</label>
                                <input id="pw-register" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••" autoComplete="new-password" required className={inputCls} />
                                <p className="text-[11px] text-zinc-500 px-1">Min 8 chars · uppercase · lowercase · digit</p>
                            </div>
                        )}

                        <button type="submit" disabled={isLoading}
                            className={['mt-1 w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500',
                                isLoading ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' : 'bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 text-white shadow-glow-sm active:scale-[0.98]'].join(' ')}>
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Please wait…
                                </span>
                            ) : mode === 'login' ? 'Sign in' : 'Create account'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AuthForm;
