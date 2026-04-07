const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // Auth Middleware එක

// අපි කලින් හදපු teamController එකෙන් Functions ටික ගන්නවා
const { getAgents, getAgentStats } = require('../controllers/teamController');

// Routes ටික Map කරනවා
// මේවාට call වෙන්නේ /api/team/agents සහ /api/team/agent-stats විදිහටයි.
router.get('/agents', protect, getAgents);
router.get('/agent-stats', protect, getAgentStats);

module.exports = router;