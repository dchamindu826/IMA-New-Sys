const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../../middlewares/auth.middleware');

const { createUser, loginUser, logoutUser } = require('./auth.controller');

// User Profile Image upload config
const userImgStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../../public/userImages'));
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const uploadUserImg = multer({ storage: userImgStorage });

// --- Auth Routes ---
router.post('/register', uploadUserImg.single('profileImg'), createUser);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser); // Logout route එකත් මෙතනට දැම්මා

module.exports = router;