const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. Middleware
const { protect } = require('../../middleware/authMiddleware');

// 2. Mobile Controllers
const authCtrl = require('../../controllers/mobile/authController.js');
const homeCtrl = require('../../controllers/mobile/homeController.js');
const profileCtrl = require('../../controllers/mobile/profileController.js');
const courseCtrl = require('../../controllers/mobile/courseController.js');
const liveCtrl = require('../../controllers/mobile/liveController.js');
const mobilePaymentCtrl = require('../../controllers/mobile/paymentController.js'); 
const enrollCtrl = require('../../controllers/mobile/enrollmentController.js');
const downloadCtrl = require('../../controllers/mobile/downloadController.js');

// 3. Main Controllers 
const mainPaymentCtrl = require('../../controllers/paymentController.js');

// 🟢 CRASH PROOF WRAPPER 🟢
const safe = (fn, name) => {
    return async (req, res, next) => {
        if (typeof fn !== 'function') {
            console.error(`🚨 Backend Error: Function '${name}' is undefined! Check if it's exported.`);
            return res.status(500).json({ message: `Developer Error: '${name}' is not exported from the controller.` });
        }
        try {
            await fn(req, res, next);
        } catch (err) {
            console.error(`🔥 Runtime Error in '${name}':`, err);
            return res.status(500).json({ message: err.message || "Internal Server Error" });
        }
    };
};

// Multer Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let destPath = file.fieldname === 'slipImg' 
            ? path.join(__dirname, '../../public/slips') 
            : path.join(__dirname, '../../public/userImages'); 

        if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
        }
        cb(null, destPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '_' + file.originalname.replace(/\s+/g, '_'));
    }
});
const upload = multer({ storage: storage });


// --- 1. AUTHENTICATION ---
// 🔥 මෙන්න මේ නම් දෙක තමයි Controller එකට හරියටම මැච් වෙන්න හැදුවේ (loginUser සහ createUser) 🔥
router.post('/auth/login', safe(authCtrl.loginUser || authCtrl.login, 'loginUser'));
router.post('/auth/register', safe(authCtrl.createUser || authCtrl.register, 'createUser'));

// --- 2. HOME & PROFILE ---
router.get('/home', protect, safe(homeCtrl.getHomeData, 'getHomeData')); 
router.get('/init', protect, safe(homeCtrl.getHomeData, 'getHomeData')); 
router.post('/updateProfile', protect, safe(profileCtrl.updateProfile, 'updateProfile'));
router.post('/updateProfilePic', protect, upload.single('profileImg'), safe(profileCtrl.updateProfilePic, 'updateProfilePic'));

// --- 3. COURSES & CLASSROOM ---
router.get('/classRoom', protect, safe(courseCtrl.getClassRoom, 'getClassRoom'));
router.get('/viewModule/:courseId', protect, safe(courseCtrl.viewModule, 'viewModule'));

// --- 4. LIVE CLASSES ---
router.get('/getAllUpcomingLives', protect, safe(liveCtrl.getAllUpcomingLives, 'getAllUpcomingLives'));

// --- 5. PAYMENTS & ENROLLMENTS ---
const myPaymentsFn = mobilePaymentCtrl.myPayments || mobilePaymentCtrl.getMyPayments || mainPaymentCtrl.myPayments || mainPaymentCtrl.getMyPayments;
const uploadSlipFn = mobilePaymentCtrl.uploadSlip || mainPaymentCtrl.uploadSlip;
const enrollWithSlipFn = mobilePaymentCtrl.enrollWithSlip || mainPaymentCtrl.enrollWithSlip;
const courseConfirmFn = mobilePaymentCtrl.courseConfirm || mainPaymentCtrl.courseConfirm || enrollCtrl.courseConfirm;

router.get('/myPayments', protect, safe(myPaymentsFn, 'myPayments')); 
router.post('/uploadSlip', protect, upload.single('slipImg'), safe(uploadSlipFn, 'uploadSlip'));
router.post('/enrollWithSlip', protect, upload.single('slipImg'), safe(enrollWithSlipFn, 'enrollWithSlip'));
router.post('/courseConfirm', protect, safe(courseConfirmFn, 'courseConfirm'));
router.post('/paymentTypeSelect', protect, safe(enrollCtrl.paymentTypeSelect, 'paymentTypeSelect'));

// --- 6. OFFLINE DOWNLOADS ---
router.get('/getDownloadRecording/:zoomId', protect, safe(downloadCtrl.getDownloadRecording, 'getDownloadRecording'));

module.exports = router;