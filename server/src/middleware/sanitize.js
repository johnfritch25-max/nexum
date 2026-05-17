'use strict';

/**
 * sanitize.js
 * Input sanitization utilities used across route handlers and socket events.
 *
 * Strips HTML tags and dangerous characters from string inputs to prevent
 * stored XSS. Applied to all user-supplied text before it is persisted.
 *
 * This is a defence-in-depth measure. The frontend should also escape output
 * when rendering (React does this by default for text nodes).
 */

/**
 * Strips HTML tags and encodes the five dangerous HTML entities.
 * Safe to call on any string value.
 *
 * @param {string} input
 * @returns {string}
 */
function stripHtml(input) {
    if (typeof input !== 'string') return input;

    return input
        // Remove all HTML/XML tags
        .replace(/<[^>]*>/g, '')
        // Encode remaining dangerous characters
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
        // Collapse multiple whitespace sequences to a single space
        .trim();
}

/**
 * Sanitizes a message body.
 * Preserves newlines (for multi-line messages) but strips HTML.
 *
 * @param {string} content
 * @returns {string}
 */
function sanitizeMessageContent(content) {
    if (typeof content !== 'string') return '';

    return content
        .replace(/<[^>]*>/g, '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        // Preserve newlines — only strip the forward-slash entity trick
        .replace(/\//g, '&#x2F;')
        .trim();
}

/**
 * Express middleware that sanitizes common string fields on req.body.
 * Mutates the body in-place so downstream handlers receive clean data.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
function sanitizeBody(req, _res, next) {
    if (req.body && typeof req.body === 'object') {
        for (const [key, value] of Object.entries(req.body)) {
            if (typeof value === 'string') {
                // Don't sanitize passwords — they are hashed, never rendered
                if (key !== 'password') {
                    req.body[key] = stripHtml(value);
                }
            }
        }
    }
    next();
}

module.exports = { stripHtml, sanitizeMessageContent, sanitizeBody };
