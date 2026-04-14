const express = require('express');
const router = express.Router();
// පරණ නම (homeController) තියෙනවා නම් ඒක මෙහෙම දෙන්න:
const { init, sendContact, start } = require('./homeController');

router.get('/init', init);
router.post('/contact', sendContact);
router.get('/start', start);

module.exports = router;