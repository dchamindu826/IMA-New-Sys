const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../../middlewares/auth.middleware');

// Controllers ඔක්කොම එකපාර Import කරගමු
const { 
    index: studentIndex, classRoom, viewModule, viewZoom, viewYoutubeLive, 
    startExam, paperComplete, addUserAnswer, updateUserAnswer, getDownloadRecording,
    getStudentDashboard, getAvailableEnrollments, enrollWithSlip, studentAIChat,
    updatePassword, updateProfile
} = require('./student.controller');

// අනිත් Modules වල Controllers
const { handleBankEmail, verifySlipWithAI } = require('../payments/bankWebhook.controller');
// (homeController එක තියෙන තැනට point කරන්න. දැනට මම ../home/home.controller කියලා දැම්මා)
const { init, sendContact, start } = require('../public/homeController');

// --- 1. Slip Images වලට හරියටම Storage එක ---
const slipStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../../public/slipImages')); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const uploadSlipImg = multer({ storage: slipStorage });

// --- 2. Answers / Papers වලට Storage එක ---
const answerStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../../public/userAnswers')); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const uploadAnswer = multer({ storage: answerStorage });

// --- 3. User Profile Images වලට Storage එක ---
const userImgStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../../public/images')); 
    },
    filename: function (req, file, cb) {
        cb(null, 'user_' + Date.now() + path.extname(file.originalname));
    }
});
const uploadUserImg = multer({ storage: userImgStorage });

// ==========================================
// ====== PROFILE SETTINGS ROUTES ======
// ==========================================
router.post('/profile/update', protect, uploadUserImg.single('image'), updateProfile);
router.post('/profile/password', protect, updatePassword);

// ==========================================
// ====== STUDENT NEW DASHBOARD & ENROLLMENT ======
// ==========================================
router.get('/dashboard', protect, getStudentDashboard);
router.get('/available-enrollments', protect, getAvailableEnrollments); 
router.post('/enroll-with-slip', protect, uploadSlipImg.single('slipImage'), enrollWithSlip);

// ==========================================
// ====== STUDENT APP ROUTES (CLASSES/EXAMS) ======
// ==========================================
router.get('/classroom', protect, classRoom);
router.get('/module/:courseId', protect, viewModule);
router.post('/zoom', protect, viewZoom);
router.post('/youtube', protect, viewYoutubeLive);
router.get('/recording/download/:meetingId', protect, getDownloadRecording);

router.post('/exam/start', protect, startExam);
router.post('/exam/submit', protect, paperComplete);
router.post('/structured-paper/submit', protect, uploadAnswer.single('file'), addUserAnswer);
router.put('/structured-paper/update', protect, uploadAnswer.single('file'), updateUserAnswer);

// ==========================================
// ====== BANK WEBHOOK & AI ROUTES ======
// ==========================================
router.post('/bank/webhook', handleBankEmail);
router.post('/bank/ai-verify', protect, verifySlipWithAI);
router.post('/ai-chat', protect, studentAIChat); 

// ==========================================
// ====== HOME ROUTES ======
// ==========================================
router.get('/home/init', init);
router.post('/home/contact', sendContact);
router.get('/start', protect, start);

module.exports = router;