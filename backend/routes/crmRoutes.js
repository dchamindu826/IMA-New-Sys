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
const { getMessages, sendManualMessage, markContactRead } = require('../controllers/messageController'); 
const { getCrmConfig, saveCrmConfig, deleteTrainingFile, viewIngestedContent } = require('../controllers/crmSetupController');

// 🔥 අලුත් Lead Controller එක 🔥
const { getContacts, assignChats, assignLeadsManual, resetAssignments } = require('../controllers/leadController'); 

const crmStoragePath = path.join(__dirname, '../public/crm_files');
if (!fs.existsSync(crmStoragePath)) fs.mkdirSync(crmStoragePath, { recursive: true });

const crmStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, crmStoragePath),
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname.replace(/\s+/g, '_'))
});
const uploadCrm = multer({ storage: crmStorage });

// WhatsApp Webhook Routes
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleIncomingMessage);

// Message & Contact Routes
router.get('/messages/:leadId', protect, getMessages);
router.post('/messages/send', protect, sendManualMessage);
router.put('/contacts/:id/read', protect, markContactRead); 
router.get('/contacts', protect, getContacts);

// 🔥 Assignment Routes 🔥
router.put('/assign-chats', requireAdmin, assignChats);
router.post('/leads/bulk-assign', requireAdmin, assignLeadsManual);
router.put('/reset-assignments', requireAdmin, resetAssignments);

// Config Routes
router.get('/business/crm-config/:businessId', protect, getCrmConfig);
router.post('/business/crm/save', requireAdmin, uploadCrm.any(), saveCrmConfig);
router.post('/business/crm/delete-file', requireAdmin, deleteTrainingFile);
router.post('/business/crm/view-file', requireAdmin, viewIngestedContent);

module.exports = router;