const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// 1. Middleware එක Import කරන විදිහ
const { protect } = require('../../middleware/authMiddleware');

// 2. Controllers ටික Import කරන විදිහ (අගට .js එකතු කරලා තියෙන්නේ)
const { login, register } = require('../../controllers/mobile/authController.js');
const { getHomeData } = require('../../controllers/mobile/homeController.js');
const { updateProfile, updateProfilePic } = require('../../controllers/mobile/profileController.js');
const { getClassRoom, viewModule } = require('../../controllers/mobile/courseController.js');
const { getAllUpcomingLives } = require('../../controllers/mobile/liveController.js');
const { getMyPayments, uploadSlip } = require('../../controllers/mobile/paymentController.js');
const { courseConfirm, paymentTypeSelect } = require('../../controllers/mobile/enrollmentController.js');
const { getDownloadRecording } = require('../../controllers/mobile/downloadController.js');

// Multer Storage - Images Upload කරන්න (Profile + Slips)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === 'slipImg') {
            cb(null, path.join(__dirname, '../../../public/slips')); // Slips යන තැන
        } else {
            cb(null, path.join(__dirname, '../../../public/userImages')); // Profile Photos යන තැන
        }
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '_' + file.originalname.replace(/\s+/g, '_'));
    }
});
const upload = multer({ storage: storage });

// --- 1. AUTHENTICATION ---
router.post('/auth/login', login);
router.post('/auth/register', register);

// --- 2. HOME & PROFILE ---
router.get('/home', protect, getHomeData); 
router.get('/init', protect, getHomeData); 
router.post('/updateProfile', protect, updateProfile);
router.post('/updateProfilePic', protect, upload.single('profileImg'), updateProfilePic);

// --- 3. COURSES & CLASSROOM ---
router.get('/classRoom', protect, getClassRoom);
router.get('/viewModule/:courseId', protect, viewModule);

// --- 4. LIVE CLASSES ---
router.get('/getAllUpcomingLives', protect, getAllUpcomingLives);

// --- 5. PAYMENTS ---
router.get('/myPayments', protect, getMyPayments);
router.post('/uploadSlip', protect, upload.single('slipImg'), uploadSlip);

// --- 6. COURSE ENROLLMENT ---
router.post('/courseConfirm', protect, courseConfirm);
router.post('/paymentTypeSelect', protect, paymentTypeSelect);

// --- 7. OFFLINE DOWNLOADS ---
router.get('/getDownloadRecording/:zoomId', protect, getDownloadRecording);

module.exports = router;