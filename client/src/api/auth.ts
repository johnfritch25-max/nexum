/**
 * auth.ts
 * Thin fetch wrappers for the REST auth endpoints.
 * Stores access + refresh tokens in localStorage after login/register.
 * Provides a refreshAccessToken() function for silent token renewal.
 */

const BASE_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:4000';

export const ACCESS_TOKEN_KEY  = 'messenger_access_token';
export const REFRESH_TOKEN_KEY = 'messenger_refresh_token';

export interface AuthUser {
    id: number;
    username: string;
    display_name: string;
    email: string;
    is_incognito: boolean;
    online_status: string;
}

export interface AuthResponse {
    message: string;
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
}

// ── Token storage ─────────────────────────────────────────────────────────────

export function getStoredToken(): string | null {
    try { return localStorage.getItem(ACCESS_TOKEN_KEY); }
    catch { return null; }
}

export function storeTokens(accessToken: string, refreshToken: string): void {
    try {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch { /* ignore */ }
}

export function clearToken(): void {
    try {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch { /* ignore */ }
}

// ── Silent token refresh ──────────────────────────────────────────────────────

let refreshPromise: Promise<string | null> | null = null;

/**
 * Exchanges the stored refresh token for a new access token.
 * Deduplicates concurrent calls — only one refresh request is in-flight at a time.
 * Returns the new access token, or null if the refresh failed.
 */
export async function refreshAccessToken(): Promise<string | null> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) return null;

        try {
            const res = await fetch(`${BASE_URL}/auth/refresh`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ refreshToken }),
            });

            if (!res.ok) {
                clearToken();
                return null;
            }

            const data = await res.json();
            storeTokens(data.accessToken, data.refreshToken);
            return data.accessToken as string;
        } catch {
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

/**
 * Fetch wrapper that automatically retries with a refreshed token on 401.
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = getStoredToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        const newToken = await refreshAccessToken();
        if (newToken) {
            const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
            res = await fetch(url, { ...options, headers: retryHeaders });
        }
    }

    return res;
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

export async function register(
    username: string,
    displayName: string,
    email: string,
    password: string
): Promise<AuthResponse> {
    const res = await fetch(`${BASE_URL}/auth/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username, display_name: displayName, email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Registration failed.');

    storeTokens(data.accessToken, data.refreshToken);
    return data as AuthResponse;
}

export async function login(loginId: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ login: loginId, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Login failed.');

    storeTokens(data.accessToken, data.refreshToken);
    return data as AuthResponse;
}

export async function logout(refreshToken?: string): Promise<void> {
    const storedRefresh = refreshToken ?? localStorage.getItem(REFRESH_TOKEN_KEY) ?? '';
    try {
        await fetch(`${BASE_URL}/auth/logout`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ refreshToken: storedRefresh }),
        });
    } catch { /* ignore network errors on logout */ }
    clearToken();
}
