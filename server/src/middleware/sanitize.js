'use strict';

/**
 * sanitize.js
 * Input sanitization — strips HTML tags to prevent stored XSS.
 * React escapes text nodes by default so we only need to remove actual
 * HTML tags. We do NOT encode apostrophes, quotes or slashes because
 * that causes display corruption (e.g. "what&#x27;s up?" instead of "what's up?").
 */

/**
 * Strips HTML/XML tags from a string. Safe to call on any value.
 * @param {string} input
 * @returns {string}
 */
function stripHtml(input) {
    if (typeof input !== 'string') return input;
    return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Sanitizes message content — strips HTML tags but preserves all other
 * characters including apostrophes, quotes, slashes and newlines.
 * @param {string} content
 * @returns {string}
 */
function sanitizeMessageContent(content) {
    if (typeof content !== 'string') return '';
    return content.replace(/<[^>]*>/g, '').trim();
}

/**
 * Express middleware that strips HTML tags from all string body fields
 * except passwords (which are hashed and never rendered).
 */
function sanitizeBody(req, _res, next) {
    if (req.body && typeof req.body === 'object') {
        for (const [key, value] of Object.entries(req.body)) {
            if (typeof value === 'string' && key !== 'password') {
                req.body[key] = stripHtml(value);
            }
            // Arrays of primitives (e.g. memberIds) — sanitize string elements only
            if (Array.isArray(value)) {
                req.body[key] = value.map((v) => typeof v === 'string' ? stripHtml(v) : v);
            }
        }
    }
    next();
}

module.exports = { stripHtml, sanitizeMessageContent, sanitizeBody };
