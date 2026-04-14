const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth.middleware');

// පරණ නම (commonController) තියෙනවා නම් ඒක මෙහෙම දෙන්න:
const { addNewLead } = require('./commonController');

router.post('/lead/add', protect, addNewLead);

module.exports = router;