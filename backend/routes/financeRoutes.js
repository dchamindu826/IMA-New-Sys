const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// අලුත් controller එකත් මෙතනට import කරන්න
const { getFinanceOverview, getPendingReviews, getVerificationLogs, getAllPaymentsForAdmin } = require('../controllers/financeController');

router.get('/admin/finance/overview', protect, getFinanceOverview);
router.get('/admin/finance/pending-reviews', protect, getPendingReviews);
router.get('/admin/finance/logs', protect, getVerificationLogs);

// 🔥 මෙන්න අලුත් Route එක!
router.get('/admin/get-payments', protect, getAllPaymentsForAdmin);

module.exports = router;