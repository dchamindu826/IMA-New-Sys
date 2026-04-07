// backend/routes/crmRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { protect } = require('../middleware/authMiddleware');
let adminOnly;
try { adminOnly = require('../middleware/authMiddleware').adminOnly; } catch(e) {}
const requireAdmin = adminOnly || protect; 

// Controllers
const { verifyWebhook, handleIncomingMessage } = require('../controllers/whatsappWebhookController');
const { getMessages, sendManualMessage } = require('../controllers/messageController');
const { getCrmConfig, saveCrmConfig, deleteTrainingFile } = require('../controllers/crmSetupController');
const { getContacts } = require('../controllers/leadController'); // 🔥 මෙන්න මේක අලුතින් දැම්මා 🔥

const crmStoragePath = path.join(__dirname, '../public/crm_files');
if (!fs.existsSync(crmStoragePath)) fs.mkdirSync(crmStoragePath, { recursive: true });

const crmStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, crmStoragePath),
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname.replace(/\s+/g, '_'))
});
const uploadCrm = multer({ storage: crmStorage });

// Routes
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleIncomingMessage);
router.get('/messages/:leadId', protect, getMessages);
router.post('/messages/send', protect, sendManualMessage);
router.get('/business/crm-config/:businessId', protect, getCrmConfig);
router.post('/business/crm/save', requireAdmin, uploadCrm.any(), saveCrmConfig);
router.post('/business/crm/delete-file', requireAdmin, deleteTrainingFile);

// 🔥 මේක තමයි 404 ආපු Route එක 🔥
router.get('/contacts', protect, getContacts);

module.exports = router;