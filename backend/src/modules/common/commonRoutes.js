const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth.middleware');

// ඔයාගේ common controller එකේ නම commonController.js ද නැත්තම් common.controller.js ද කියලා බලලා ඒක මෙතනට දෙන්න
const { addNewLead } = require('./commoncontroller');

router.post('/lead/add', protect, addNewLead);

module.exports = router;