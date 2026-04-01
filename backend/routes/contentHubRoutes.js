const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const { addContentGroup, addContentMassAssign, updateContentMassAssign, createGroup, updateGroup, createAdminPost } = require('../controllers/contentHubController');

// 1. Documents/Papers වලට Storage එක
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/documents/'); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 2. 🔥 අලුත් Storage එක Posts/Announcements වල Images වලට 🔥
const postStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/posts/'); // posts ෆෝල්ඩර් එකට යන්නේ
    },
    filename: (req, file, cb) => {
        cb(null, 'post_' + Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const uploadPost = multer({ storage: postStorage });

// --- API Endpoints ---
router.post('/content-group/add', addContentGroup);
router.post('/contents/mass-assign', upload.single('file'), addContentMassAssign);
router.put('/contents/update', upload.single('file'), updateContentMassAssign);

// Discount groups
router.post('/course-setup/group', createGroup);
router.put('/admin/group/update', updateGroup);

// 🔥 Admin Posts / Notifications Route එක 🔥
router.post('/post/create', uploadPost.single('image'), createAdminPost);

module.exports = router;