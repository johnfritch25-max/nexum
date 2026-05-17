'use strict';

/**
 * db.js
 * MySQL connection pool using mysql2/promise.
 * All queries throughout the server import this singleton pool.
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host:               process.env.DB_HOST     || '127.0.0.1',
    port:               parseInt(process.env.DB_PORT || '3306', 10),
    database:           process.env.DB_NAME     || 'messenger_db',
    user:               process.env.DB_USER     || 'messenger_user',
    password:           process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit:    20,
    queueLimit:         0,
    dateStrings:        false,
    timezone:           'Z',
});

/**
 * Verify the pool can reach the database on startup.
 * Throws if the connection cannot be established so the process
 * exits early with a clear error rather than failing silently later.
 */
async function verifyConnection() {
    const connection = await pool.getConnection();
    console.log('[DB] MySQL connection pool established successfully.');
    connection.release();
}

module.exports = { pool, verifyConnection };
