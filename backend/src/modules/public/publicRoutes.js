const express = require('express');
const router = express.Router();
// පරණ නම (publicController) තියෙනවා නම් ඒක මෙහෙම දෙන්න:
const { getLandingPageData } = require('./publicController');

router.get('/landing-data', getLandingPageData);

module.exports = router;