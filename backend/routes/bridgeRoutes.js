const express = require('express');
const router = express.Router();
const { checkStudentLms, updatePassword, updateEnrollmentPlan } = require('../controllers/bridgeController'); // ඔයා එවපු controller එක

router.get('/student/:phone', checkStudentLms);
router.post('/update-password', updatePassword);
router.post('/update-enrollment', updateEnrollmentPlan);

module.exports = router;