'use strict';

/**
 * auth.js
 * REST routes for registration, login, and token refresh.
 *
 * POST /auth/register  — create a new account
 * POST /auth/login     — verify credentials, return access + refresh tokens
 * POST /auth/refresh   — exchange a valid refresh token for a new access token
 * POST /auth/logout    — invalidate the refresh token
 */

const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

const BCRYPT_ROUNDS       = 12;
const JWT_SECRET          = process.env.JWT_SECRET           || 'change_me_in_production';
const JWT_REFRESH_SECRET  = process.env.JWT_REFRESH_SECRET   || 'change_refresh_secret_too';
const JWT_EXPIRES         = process.env.JWT_EXPIRES_IN       || '15m';   // short-lived access token
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES  || '30d';   // long-lived refresh token

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidUsername(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9_]{3,32}$/.test(value);
}

function isValidEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPassword(value) {
    return (
        typeof value === 'string' &&
        value.length >= 8 &&
        /[A-Z]/.test(value) &&
        /[a-z]/.test(value) &&
        /[0-9]/.test(value)
    );
}

function signAccessToken(user) {
    return jwt.sign(
        { sub: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES }
    );
}

function signRefreshToken(user) {
    return jwt.sign(
        { sub: user.id },
        JWT_REFRESH_SECRET,
        { expiresIn: JWT_REFRESH_EXPIRES }
    );
}

// ── POST /auth/register ──────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
    const { username, display_name, email, password } = req.body ?? {};

    if (!isValidUsername(username)) {
        return res.status(400).json({
            error: 'username must be 3–32 characters and contain only letters, numbers, or underscores.',
        });
    }
    if (typeof display_name !== 'string' || display_name.trim().length < 1 || display_name.trim().length > 64) {
        return res.status(400).json({ error: 'display_name must be between 1 and 64 characters.' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!isValidPassword(password)) {
        return res.status(400).json({
            error: 'Password must be at least 8 characters and include uppercase, lowercase, and a digit.',
        });
    }

    try {
        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
            [username.toLowerCase(), email.toLowerCase()]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Username or email is already taken.' });
        }
    } catch (err) {
        console.error('[Auth] Register duplicate check error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    let passwordHash;
    try {
        passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    } catch (err) {
        console.error('[Auth] bcrypt error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    let insertedId;
    try {
        const [result] = await pool.execute(
            `INSERT INTO users (username, display_name, email, password_hash)
             VALUES (?, ?, ?, ?)`,
            [username.toLowerCase(), display_name.trim(), email.toLowerCase(), passwordHash]
        );
        insertedId = result.insertId;
    } catch (err) {
        console.error('[Auth] Register insert error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    const user         = { id: insertedId, username: username.toLowerCase() };
    const accessToken  = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // Store hashed refresh token in DB
    try {
        const tokenHash = await bcrypt.hash(refreshToken, 10);
        await pool.execute(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
            [insertedId, tokenHash]
        );
    } catch (err) {
        console.error('[Auth] Refresh token store error:', err);
        // Non-fatal — user can still log in again
    }

    return res.status(201).json({
        message:      'Account created successfully.',
        accessToken,
        refreshToken,
        user: {
            id:           insertedId,
            username:     username.toLowerCase(),
            display_name: display_name.trim(),
            email:        email.toLowerCase(),
        },
    });
});

// ── POST /auth/login ─────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
    const { login, password } = req.body ?? {};

    if (typeof login !== 'string' || login.trim().length === 0) {
        return res.status(400).json({ error: 'login (username or email) is required.' });
    }
    if (typeof password !== 'string' || password.length === 0) {
        return res.status(400).json({ error: 'password is required.' });
    }

    let user;
    try {
        const [rows] = await pool.execute(
            `SELECT id, username, display_name, email, password_hash, is_incognito, online_status
             FROM users
             WHERE username = ? OR email = ?
             LIMIT 1`,
            [login.toLowerCase(), login.toLowerCase()]
        );
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        user = rows[0];
    } catch (err) {
        console.error('[Auth] Login fetch error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    let passwordMatch;
    try {
        passwordMatch = await bcrypt.compare(password, user.password_hash);
    } catch (err) {
        console.error('[Auth] bcrypt compare error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const accessToken  = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // Store hashed refresh token
    try {
        const tokenHash = await bcrypt.hash(refreshToken, 10);
        await pool.execute(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
            [user.id, tokenHash]
        );
    } catch (err) {
        console.error('[Auth] Refresh token store error:', err);
    }

    return res.status(200).json({
        message: 'Login successful.',
        accessToken,
        refreshToken,
        user: {
            id:            user.id,
            username:      user.username,
            display_name:  user.display_name,
            email:         user.email,
            is_incognito:  user.is_incognito === 1,
            online_status: user.online_status,
        },
    });
});

// ── POST /auth/refresh ───────────────────────────────────────────────────────

router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body ?? {};

    if (typeof refreshToken !== 'string' || refreshToken.trim().length === 0) {
        return res.status(400).json({ error: 'refreshToken is required.' });
    }

    // Verify the token signature and expiry
    let decoded;
    try {
        decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch {
        return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    const userId = decoded.sub;

    // Fetch all stored token hashes for this user and find a match
    let matchedRow = null;
    try {
        const [rows] = await pool.execute(
            `SELECT id, token_hash FROM refresh_tokens
             WHERE user_id = ? AND expires_at > NOW()`,
            [userId]
        );

        for (const row of rows) {
            const match = await bcrypt.compare(refreshToken, row.token_hash);
            if (match) {
                matchedRow = row;
                break;
            }
        }
    } catch (err) {
        console.error('[Auth] Refresh token lookup error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    if (!matchedRow) {
        return res.status(401).json({ error: 'Refresh token not recognised. Please log in again.' });
    }

    // Rotate: delete the used token and issue a new pair
    try {
        await pool.execute('DELETE FROM refresh_tokens WHERE id = ?', [matchedRow.id]);
    } catch (err) {
        console.error('[Auth] Refresh token delete error:', err);
    }

    let user;
    try {
        const [rows] = await pool.execute(
            'SELECT id, username FROM users WHERE id = ? LIMIT 1',
            [userId]
        );
        if (rows.length === 0) {
            return res.status(401).json({ error: 'User not found.' });
        }
        user = rows[0];
    } catch (err) {
        console.error('[Auth] Refresh user fetch error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }

    const newAccessToken  = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    try {
        const tokenHash = await bcrypt.hash(newRefreshToken, 10);
        await pool.execute(
            `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
             VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
            [user.id, tokenHash]
        );
    } catch (err) {
        console.error('[Auth] New refresh token store error:', err);
    }

    return res.status(200).json({
        accessToken:  newAccessToken,
        refreshToken: newRefreshToken,
    });
});

// ── POST /auth/logout ────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body ?? {};

    if (typeof refreshToken === 'string' && refreshToken.trim().length > 0) {
        try {
            const decoded = jwt.decode(refreshToken);
            if (decoded?.sub) {
                const [rows] = await pool.execute(
                    'SELECT id, token_hash FROM refresh_tokens WHERE user_id = ?',
                    [decoded.sub]
                );
                for (const row of rows) {
                    const match = await bcrypt.compare(refreshToken, row.token_hash);
                    if (match) {
                        await pool.execute('DELETE FROM refresh_tokens WHERE id = ?', [row.id]);
                        break;
                    }
                }
            }
        } catch (err) {
            console.error('[Auth] Logout token cleanup error:', err);
            // Non-fatal — proceed with 200
        }
    }

    return res.status(200).json({ message: 'Logged out successfully.' });
});

module.exports = router;
