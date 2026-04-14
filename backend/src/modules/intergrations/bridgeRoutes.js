const express = require('express');
const router = express.Router();

const bridgeController = require('./bridgeController'); 
const { protect } = require('../../middlewares/auth.middleware');

router.get('/config', protect, bridgeController.getConfig);
router.post('/sync', protect, bridgeController.syncData);

// 🔥 මේ අලුත් පේළිය එකතු කරන්න 🔥
router.get('/student/:phone', protect, bridgeController.checkStudentLms); 

module.exports = router;