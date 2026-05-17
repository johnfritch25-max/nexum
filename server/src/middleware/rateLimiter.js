'use strict';

/**
 * rateLimiter.js
 * In-process sliding-window rate limiter middleware.
 *
 * Uses a Map keyed by IP address. Each entry holds an array of request
 * timestamps. On every request, timestamps older than the window are pruned
 * before the count is checked — this gives a true sliding window rather than
 * a fixed bucket that resets all at once.
 *
 * For a multi-node deployment, replace this with express-rate-limit +
 * rate-limit-redis so the counter is shared across instances.
 */

/**
 * Creates a rate-limiter middleware.
 *
 * @param {object} options
 * @param {number} options.windowMs      - Time window in milliseconds.
 * @param {number} options.max           - Max requests allowed per window per IP.
 * @param {string} [options.message]     - Error message returned when limited.
 * @returns {import('express').RequestHandler}
 */
function createRateLimiter({ windowMs, max, message = 'Too many requests. Please try again later.' }) {
    /** @type {Map<string, number[]>} IP → array of request timestamps */
    const store = new Map();

    // Periodically sweep the store to prevent unbounded memory growth.
    // Any IP whose most recent request is older than the window is removed.
    const sweepInterval = setInterval(() => {
        const cutoff = Date.now() - windowMs;
        for (const [ip, timestamps] of store.entries()) {
            if (timestamps[timestamps.length - 1] < cutoff) {
                store.delete(ip);
            }
        }
    }, windowMs);

    // Allow the Node.js process to exit even if this interval is still active
    sweepInterval.unref();

    return function rateLimiterMiddleware(req, res, next) {
        const ip  = req.ip || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        const windowStart = now - windowMs;

        let timestamps = store.get(ip) ?? [];

        // Prune timestamps outside the current window
        timestamps = timestamps.filter((t) => t > windowStart);

        if (timestamps.length >= max) {
            const retryAfterSec = Math.ceil(windowMs / 1000);
            res.setHeader('Retry-After', String(retryAfterSec));
            return res.status(429).json({ error: message });
        }

        timestamps.push(now);
        store.set(ip, timestamps);
        next();
    };
}

// ── Pre-configured limiters ──────────────────────────────────────────────────

/**
 * Strict limiter for auth endpoints.
 * 10 attempts per 15 minutes per IP.
 */
const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max:      10,
    message:  'Too many authentication attempts. Please wait 15 minutes before trying again.',
});

/**
 * General API limiter for all other routes.
 * 200 requests per minute per IP.
 */
const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max:      200,
    message:  'Request rate limit exceeded. Please slow down.',
});

module.exports = { createRateLimiter, authLimiter, apiLimiter };
