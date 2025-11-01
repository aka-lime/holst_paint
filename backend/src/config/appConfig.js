const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const SESSIONS_FILE = process.env.SESSIONS_FILE || path.join(DATA_DIR, 'sessions.json');
const STROKE_LIMIT = parseInt(process.env.STROKE_LIMIT || '300', 10);
const HISTORY_LIMIT = parseInt(process.env.HISTORY_LIMIT || '1000', 10);

module.exports = {
    DATA_DIR,
    SESSIONS_FILE,
    STROKE_LIMIT,
    HISTORY_LIMIT
};
