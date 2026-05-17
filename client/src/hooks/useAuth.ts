/**
 * useAuth.ts
 * Manages authentication state for the application.
 *
 * - Rehydrates session from localStorage on mount via getMe().
 *   If the access token is expired, fetchWithAuth silently refreshes it.
 * - Exposes login, register, and logout.
 * - logout calls POST /auth/logout to invalidate the refresh token server-side.
 */

import { useState, useCallback, useEffect } from 'react';
import {
    login as apiLogin,
    register as apiRegister,
    logout as apiLogout,
    clearToken,
    getStoredToken,
    type AuthUser,
} from '../api/auth';
import { getMe } from '../api/users';

export interface UseAuthReturn {
    user: AuthUser | null;
    isLoading: boolean;
    error: string | null;
    login: (loginId: string, password: string) => Promise<void>;
    register: (username: string, displayName: string, email: string, password: string) => Promise<void>;
    logout: () => void;
}

export function useAuth(): UseAuthReturn {
    const [user, setUser]         = useState<AuthUser | null>(null);
    const [isLoading, setLoading] = useState(true);
    const [error, setError]       = useState<string | null>(null);

    // Rehydrate session from stored access token on mount.
    // fetchWithAuth (used inside getMe) will silently refresh if the access
    // token is expired but a valid refresh token exists.
    useEffect(() => {
        const token = getStoredToken();
        if (!token) {
            setLoading(false);
            return;
        }

        getMe()
            .then((profile) => {
                setUser({
                    id:            profile.id,
                    username:      profile.username,
                    display_name:  profile.display_name,
                    email:         profile.email,
                    is_incognito:  profile.is_incognito,
                    online_status: profile.online_status,
                });
            })
            .catch(() => {
                // Both tokens are invalid/expired — force re-login
                clearToken();
            })
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (loginId: string, password: string) => {
        setError(null);
        setLoading(true);
        try {
            const { user: authUser } = await apiLogin(loginId, password);
            setUser(authUser);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed.');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const register = useCallback(async (
        username: string,
        displayName: string,
        email: string,
        password: string
    ) => {
        setError(null);
        setLoading(true);
        try {
            const { user: authUser } = await apiRegister(username, displayName, email, password);
            setUser(authUser);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed.');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        // Fire-and-forget: invalidate refresh token on the server
        apiLogout().catch(() => { /* ignore network errors */ });
        setUser(null);
        setError(null);
    }, []);

    return { user, isLoading, error, login, register, logout };
}
