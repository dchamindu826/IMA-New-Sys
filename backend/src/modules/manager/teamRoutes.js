const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth.middleware');

// Api wada karapu Functions tika gannawa
const { getStaffLeads, updateCallLog, claimLead } = require('../crm/callCampaign.controller');

// Routes Map Kireema
router.get('/staff-leads', protect, getStaffLeads);
router.post('/update-call-log', protect, updateCallLog);
router.post('/claim-lead', protect, claimLead);

router.get('/agents', protect, async (req, res) => {
    try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        // Role එක Staff හරි Agent හරි වෙන අය ගන්නවා
        const agents = await prisma.users.findMany({
            where: { role: { in: ['Staff', 'Agent', 'Manager', 'Admin'] } },
            select: { id: true, name: true, phone: true, role: true }
        });
        const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        res.status(200).json(safeJson(agents));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;