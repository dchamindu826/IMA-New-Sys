
const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth.middleware');

const { getStaffLeads, updateCallLog, claimLead } = require('./callCampaign.controller');

router.get('/staff-leads', protect, getStaffLeads);
router.post('/update-call-log', protect, updateCallLog);
router.post('/claim-lead', protect, claimLead);

module.exports = router;