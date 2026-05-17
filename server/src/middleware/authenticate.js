'use strict';

/**
 * authenticate.js
 * Express middleware that verifies a Bearer JWT on protected routes.
 *
 * Attaches the decoded payload to req.user:
 *   { sub: number (userId), username: string, iat: number, exp: number }
 *
 * Usage:
 *   const authenticate = require('./middleware/authenticate');
 *   router.get('/protected', authenticate, handler);
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header with Bearer token is required.' });
    }

    const token = authHeader.slice(7); // strip "Bearer "

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token has expired. Please log in again.' });
        }
        return res.status(401).json({ error: 'Invalid token.' });
    }
}

module.exports = authenticate;
