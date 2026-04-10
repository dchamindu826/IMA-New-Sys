const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// 💡 මෙතන getBatchesFull එකතු කරා 💡
const { addContentGroup, addContentMassAssign, updateContentMassAssign, createGroup, updateGroup, createAdminPost, getBatchesFull } = require('../controllers/contentHubController');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/documents/'); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '_' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const postStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/posts/'); 
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

router.post('/course-setup/group', createGroup);
router.put('/admin/group/update', updateGroup);

router.post('/post/create', uploadPost.single('image'), createAdminPost);

// 💡 අලුත් Route එක (Batches ගන්න) 💡
// (මෙතන protect middleware එක දාලා තියෙනවා නම් ඒකත් import කරලා දාන්න, නැත්නම් මේ විදිහටම දාන්න)
router.get('/batches-full', getBatchesFull); 

module.exports = router;