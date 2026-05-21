'use strict';
/**
 * socketState.js
 * Shared singleton that holds the Socket.io server instance and
 * the userId → socketId registry. Avoids circular require() between
 * index.js and route/handler files.
 */

let _io = null;
let _userSocketMap = null;

function setIo(io) { _io = io; }
function setUserSocketMap(map) { _userSocketMap = map; }
function getIo() { return _io; }
function getUserSocketMap() { return _userSocketMap; }

module.exports = { setIo, setUserSocketMap, getIo, getUserSocketMap };
