const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
// 🔥 FIX: Middleware path updated
const { protect } = require('../../middlewares/auth.middleware');

const { 
    onlinePaymentSuccessNotify, courseConfirm, uploadSlip, myPayments,
    getPaymentsAdmin, getInstallmentPaymentsAdmin, 
    approvePayment, declinePayment, revertPayment, upgradeToFullPayment,
    getBotStats, getFinancialReports, financialDataChat, getApiSettings, saveApiSettings, getDropdownOptions,
    approvePostPay, freePayment, approveInstallment, deleteInstallment, enrollWithSlip
} = require('./payment.controller');

// 🔥 FIX: Slip Storage path updated '../../../public/slipImages'
const slipStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../../public/slipImages')); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const uploadSlipImg = multer({ storage: slipStorage });

// ==========================================
// 🎓 STUDENT ROUTES
// ==========================================
router.post('/payhere/notify', onlinePaymentSuccessNotify);
router.post('/course-confirm', protect, courseConfirm);
router.post('/slip/upload', protect, uploadSlipImg.single('slipImg'), uploadSlip); 
router.get('/my-payments', protect, myPayments);
router.post('/enroll-with-slip', protect, uploadSlipImg.single('slipImage'), enrollWithSlip);

// ==========================================
// 👑 ADMIN PAYMENT HUB ROUTES
// ==========================================
router.post('/admin/get-payments', protect, getPaymentsAdmin);
router.post('/admin/get-installments', protect, getInstallmentPaymentsAdmin);
router.post('/admin/approve', protect, approvePayment);
router.post('/admin/decline', protect, declinePayment);
router.post('/admin/revert', protect, revertPayment);
router.post('/admin/upgrade-to-full', protect, upgradeToFullPayment);
router.post('/admin/approve-post-pay', protect, approvePostPay);
router.post('/admin/free', protect, freePayment);
router.post('/admin/get-dropdowns', protect, getDropdownOptions);
router.get('/admin/api-settings', protect, getApiSettings);
router.post('/admin/api-settings/save', protect, saveApiSettings);
router.post('/admin/reports', protect, getFinancialReports);
router.post('/admin/reports/chat', protect, financialDataChat);
router.post('/admin/approve-installment', protect, approveInstallment);
router.post('/admin/delete-installment', protect, deleteInstallment);

module.exports = router;