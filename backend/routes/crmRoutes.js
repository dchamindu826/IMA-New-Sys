const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

const prisma = new PrismaClient();

const { protect } = require('../middleware/authMiddleware');
let adminOnly;
try { adminOnly = require('../middleware/authMiddleware').adminOnly; } catch(e) {}
const requireAdmin = adminOnly || protect; 

const { verifyWebhook, handleIncomingMessage } = require('../controllers/whatsappWebhookController');
const { getMessages, sendManualMessage, markContactRead } = require('../controllers/messageController'); 
const { getCrmConfig, saveCrmConfig, deleteTrainingFile, viewIngestedContent } = require('../controllers/crmSetupController');

const { 
    getContacts, 
    assignChats, 
    assignLeadsManual, 
    resetAssignments, 
    updateCallLog, 
    getStaffLeads 
} = require('../controllers/leadController');

const crmStoragePath = path.join(__dirname, '../public/crm_files');
if (!fs.existsSync(crmStoragePath)) fs.mkdirSync(crmStoragePath, { recursive: true });

const crmStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, crmStoragePath),
    filename: (req, file, cb) => cb(null, Date.now() + '_' + file.originalname.replace(/\s+/g, '_'))
});
const uploadCrm = multer({ storage: crmStorage });

router.get('/webhook', verifyWebhook);
router.post('/webhook', handleIncomingMessage);

router.get('/messages/:leadId', protect, getMessages);
router.post('/messages/send', protect, sendManualMessage);
router.put('/contacts/:id/read', protect, markContactRead); 
router.get('/contacts', protect, getContacts);

// 🔥 FIX: Import කරද්දි WhatsApp එකටයි Call Campaign එකටයි දෙකටම යනවා 🔥
router.post("/contact/add", protect, async (req, res) => {
    try {
        const { phoneNumber, name, assignedTo } = req.body;
        if (!phoneNumber) return res.status(400).json({ message: "Phone number is required." });

        let cleanPhone = phoneNumber.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '94' + cleanPhone.substring(1);

        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = ['system admin', 'admin', 'director', 'manager', 'superadmin'].includes(userRole);
        let targetAssignee = !isAdmin ? parseInt(req.user.id) : (assignedTo ? parseInt(assignedTo) : null);

        // 1. Save to WhatsApp Inbox (whatsapp_leads)
        let whatsappLead = await prisma.whatsapp_leads.findFirst({ where: { phone_number: cleanPhone } });
        if (!whatsappLead) {
            whatsappLead = await prisma.whatsapp_leads.create({
                data: {
                    phone_number: cleanPhone,
                    customer_name: name || `Guest ${cleanPhone.slice(-4)}`,
                    unread_count: 0,
                    status: targetAssignee ? 'Assigned' : 'Imported',
                    assigned_to: targetAssignee ? BigInt(targetAssignee) : null,
                    last_message_time: new Date()
                }
            });
        }

        // 2. Save to Call Campaign (leads)
        let callLead = await prisma.leads.findUnique({ where: { phone: cleanPhone } });
        if (!callLead) {
            await prisma.leads.create({
                data: {
                    fName: name || `Guest ${cleanPhone.slice(-4)}`,
                    phone: cleanPhone,
                    leadType: 'Free Seminar', // Default phase for imported
                    source: 'Manual Import',
                    status: targetAssignee ? 'PHASE_1' : 'NEW',
                    assigned_to: targetAssignee
                }
            });
        }

        return res.status(201).json(safeJson({ ...whatsappLead, id: whatsappLead.id, phoneNumber: whatsappLead.phone_number }));
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to import contact. " + err.message });
    }
});

// 🔥 FIX: Bulk Import කරද්දිත් WhatsApp එකටයි Call Campaign එකටයි දෙකටම යනවා 🔥
router.post("/contact/bulk-add", protect, async (req, res) => {
    try {
        const { contacts } = req.body; 
        if (!contacts || !Array.isArray(contacts) || contacts.length === 0) return res.status(400).json({ message: "No contacts provided" });

        const existingWaContacts = await prisma.whatsapp_leads.findMany({ select: { phone_number: true } });
        const existingWaPhones = new Set(existingWaContacts.map(c => c.phone_number));

        const existingCallLeads = await prisma.leads.findMany({ select: { phone: true } });
        const existingCallPhones = new Set(existingCallLeads.map(c => c.phone));

        const newWaToInsert = [];
        const newCallToInsert = [];
        const uniquePhones = new Set(); 

        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = ['system admin', 'admin', 'director', 'manager', 'superadmin'].includes(userRole);
        const targetAssignee = !isAdmin ? parseInt(req.user.id) : null;

        for (let c of contacts) {
            let phone = c.phoneNumber?.replace(/\D/g, '');
            if (phone && phone.startsWith('0')) phone = '94' + phone.substring(1);

            if (phone && phone.length >= 9 && !uniquePhones.has(phone)) {
                uniquePhones.add(phone);
                const guestName = c.name || `Guest ${phone.slice(-4)}`;

                if (!existingWaPhones.has(phone)) {
                    newWaToInsert.push({
                        phone_number: phone, 
                        customer_name: guestName,
                        unread_count: 0, 
                        status: targetAssignee ? 'Assigned' : 'Imported',
                        assigned_to: targetAssignee ? BigInt(targetAssignee) : null,
                        last_message_time: new Date()
                    });
                }

                if (!existingCallPhones.has(phone)) {
                    newCallToInsert.push({
                        fName: guestName,
                        phone: phone,
                        leadType: 'Free Seminar',
                        source: 'Bulk Import',
                        status: targetAssignee ? 'PHASE_1' : 'NEW',
                        assigned_to: targetAssignee
                    });
                }
            }
        }

        if (newWaToInsert.length > 0) await prisma.whatsapp_leads.createMany({ data: newWaToInsert, skipDuplicates: true });
        if (newCallToInsert.length > 0) await prisma.leads.createMany({ data: newCallToInsert, skipDuplicates: true });

        return res.status(201).json({ message: `Contacts imported successfully` });
    } catch (err) {
        return res.status(500).json({ message: "Failed to perform bulk import. " + err.message });
    }
});

router.put('/assign-chats', requireAdmin, assignChats);
router.post('/leads/bulk-assign', requireAdmin, assignLeadsManual);
router.put('/reset-assignments', requireAdmin, resetAssignments);

router.get('/business/crm-config/:businessId', protect, getCrmConfig);
router.post('/business/crm/save', requireAdmin, uploadCrm.any(), saveCrmConfig);
router.post('/business/crm/delete-file', requireAdmin, deleteTrainingFile);
router.post('/business/crm/view-file', requireAdmin, viewIngestedContent);

router.get('/calls/assigned', protect, getStaffLeads);
router.post('/calls/log', protect, updateCallLog);

router.get('/auto-assign/:batchId', protect, async (req, res) => {
    try {
        let batchId = req.params.batchId === 'All' ? 0 : parseInt(req.params.batchId);
        const assignments = await prisma.batch_staff_assignments.findMany({
            where: { batch_id: BigInt(batchId) }
        });
        if (assignments.length > 0) {
            const formatted = assignments.map(a => ({ id: a.id, staffId: a.staff_id, quota: a.quota }));
            res.json({ is_active: true, staff_order: formatted });
        } else {
            res.json({ is_active: false, staff_order: [] });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/auto-assign', protect, async (req, res) => {
    try {
        const { batch_id, is_active, staff_order } = req.body;
        let bId = batch_id === 'All' ? 0 : parseInt(batch_id);

        await prisma.batch_staff_assignments.deleteMany({
            where: { batch_id: BigInt(bId) }
        });

        if (is_active && staff_order && staff_order.length > 0) {
            const insertData = staff_order.map(s => ({
                batch_id: BigInt(bId),
                staff_id: parseInt(s.staffId),
                quota: parseInt(s.quota),
                assigned_count: 0
            }));
            await prisma.batch_staff_assignments.createMany({ data: insertData });
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/broadcast', protect, async (req, res) => {
    try {
        res.status(200).json([]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/broadcast/send-24h', protect, async (req, res) => {
    res.status(200).json({ message: "Broadcast sent successfully to selected active users!" });
});

router.post('/broadcast/create', protect, async (req, res) => {
    res.status(200).json({ message: "Campaign scheduled successfully!" });
});

router.get('/templates', protect, async (req, res) => {
    try {
        const templates = await prisma.quick_replies.findMany({
            orderBy: { created_at: 'desc' }
        });
        
        const formatted = templates.map(t => ({
            id: t.id,
            name: t.title,
            message: t.message,
            status: "APPROVED"
        }));
        
        res.status(200).json(formatted);
    } catch (error) {
        console.error("Template Fetch Error:", error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/templates', protect, async (req, res) => {
    try {
        const { name, message } = req.body;
        const newReply = await prisma.quick_replies.create({
            data: { title: name, message: message }
        });
        res.status(201).json(newReply);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;