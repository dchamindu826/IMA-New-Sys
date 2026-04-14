const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { protect } = require('../../middlewares/auth.middleware');

// Local Mobile Controllers - (නම් ටික පින්තූරෙට අනුව හරියටම හැදුවා)
const authCtrl = require('./authController');
const homeCtrl = require('./homeController');
const profileCtrl = require('./profileController');
const courseCtrl = require('./courseController');
const liveCtrl = require('./liveController');
const mobilePaymentCtrl = require('./paymentController'); 
const enrollCtrl = require('./enrollmentController');
const downloadCtrl = require('./downloadController');

// External Controllers
const mainPaymentCtrl = require('../payments/payment.controller');

const safe = (fn, name) => {
    return async (req, res, next) => {
        if (typeof fn !== 'function') {
            console.error(`🚨 Backend Error: Function '${name}' is undefined! Check if it's exported.`);
            return res.status(500).json({ message: `Developer Error: '${name}' is not exported from the controller.` });
        }
        try { await fn(req, res, next); } 
        catch (err) { return res.status(500).json({ message: err.message || "Internal Server Error" }); }
    };
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let destPath = file.fieldname === 'slipImg' 
            ? path.join(__dirname, '../../../public/slips') 
            : path.join(__dirname, '../../../public/userImages'); 

        if (!fs.existsSync(destPath)) { fs.mkdirSync(destPath, { recursive: true }); }
        cb(null, destPath);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '_' + file.originalname.replace(/\s+/g, '_'));
    }
});
const upload = multer({ storage: storage });

router.post('/auth/login', safe(authCtrl.loginUser || authCtrl.login, 'loginUser'));
router.post('/auth/register', safe(authCtrl.createUser || authCtrl.register, 'createUser'));

router.get('/home', protect, safe(homeCtrl.getHomeData, 'getHomeData')); 
router.get('/init', protect, safe(homeCtrl.getHomeData, 'getHomeData')); 
router.post('/updateProfile', protect, safe(profileCtrl.updateProfile, 'updateProfile'));
router.post('/updateProfilePic', protect, upload.single('profileImg'), safe(profileCtrl.updateProfilePic, 'updateProfilePic'));

router.get('/classRoom', protect, safe(courseCtrl.getClassRoom, 'getClassRoom'));
router.get('/viewModule/:courseId', protect, safe(courseCtrl.viewModule, 'viewModule'));
router.get('/getAllUpcomingLives', protect, safe(liveCtrl.getAllUpcomingLives, 'getAllUpcomingLives'));

const myPaymentsFn = mobilePaymentCtrl.myPayments || mobilePaymentCtrl.getMyPayments || mainPaymentCtrl.myPayments || mainPaymentCtrl.getMyPayments;
const uploadSlipFn = mobilePaymentCtrl.uploadSlip || mainPaymentCtrl.uploadSlip;
const enrollWithSlipFn = mobilePaymentCtrl.enrollWithSlip || mainPaymentCtrl.enrollWithSlip;
const courseConfirmFn = mobilePaymentCtrl.courseConfirm || mainPaymentCtrl.courseConfirm || enrollCtrl.courseConfirm;

router.get('/myPayments', protect, safe(myPaymentsFn, 'myPayments')); 
router.post('/uploadSlip', protect, upload.single('slipImg'), safe(uploadSlipFn, 'uploadSlip'));
router.post('/enrollWithSlip', protect, upload.single('slipImg'), safe(enrollWithSlipFn, 'enrollWithSlip'));
router.post('/courseConfirm', protect, safe(courseConfirmFn, 'courseConfirm'));
router.post('/paymentTypeSelect', protect, safe(enrollCtrl.paymentTypeSelect, 'paymentTypeSelect'));

router.get('/getDownloadRecording/:zoomId', protect, safe(downloadCtrl.getDownloadRecording, 'getDownloadRecording'));

module.exports = router;