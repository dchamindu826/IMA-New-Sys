const express = require('express');
const router = express.Router();
// 🔥 FIX: Middleware path updated
const { protect } = require('../../middlewares/auth.middleware');

const { getFinanceOverview, getPendingReviews, getVerificationLogs, getAllPaymentsForAdmin } = require('./finance.controller');

router.get('/admin/finance/overview', protect, getFinanceOverview);
router.get('/admin/finance/pending-reviews', protect, getPendingReviews);
router.get('/admin/finance/logs', protect, getVerificationLogs);
router.get('/admin/get-payments', protect, getAllPaymentsForAdmin);

module.exports = router;