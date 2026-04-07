const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ==========================================
// පරණ Functions (Leads)
// ==========================================
const getLeads = async (req, res) => {
    try {
        const { user_id, role } = req.query;
        let whereClause = {};

        // Staff නම් එයාලට Assign වෙච්ච ඒවා විතරයි පේන්නේ
        if (role === 'Staff' || role === 'Coordinator') {
            whereClause = { assigned_to: BigInt(user_id) };
        }

        const leads = await prisma.whatsapp_leads.findMany({
            where: whereClause,
            orderBy: { last_message_time: 'desc' }
        });

        // BigInt serialize කිරීම (Json වලට හරවන්න)
        const serializedLeads = JSON.parse(JSON.stringify(leads, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        return res.status(200).json(serializedLeads);
    } catch (error) {
        return res.status(500).json({ message: "Server Error" });
    }
};

const bulkAssignLeads = async (req, res) => {
    try {
        const { assignType, count, agentId } = req.body;

        const unassignedLeads = await prisma.whatsapp_leads.findMany({
            where: { status: "New", assigned_to: null },
            orderBy: { created_at: assignType === 'first' ? 'asc' : 'desc' },
            take: parseInt(count)
        });

        if (unassignedLeads.length === 0) {
            return res.status(400).json({ message: "No unassigned leads found." });
        }

        const leadIds = unassignedLeads.map(l => l.id);

        await prisma.whatsapp_leads.updateMany({
            where: { id: { in: leadIds } },
            data: { assigned_to: BigInt(agentId), status: "Assigned" }
        });

        return res.status(200).json({ message: "Assigned Successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Server Error" });
    }
};

// ==========================================
// 🔥 අලුත් Functions (CRM Contacts / Inbox) 🔥
// ==========================================

const getContacts = async (req, res) => {
    try {
        let whereClause = {};
        
        // 🔴 FIX: Database එකේ තියෙන්නේ 'whatsapp_leads' නේද? 
        // ඒ නිසා අපි 'prisma.whatsapp_leads' පාවිච්චි කරනවා.
        const contacts = await prisma.whatsapp_leads.findMany({
            where: whereClause,
            orderBy: { last_message_time: 'desc' }
        });

        // BigInt අවුල හදන්න Json.parse දානවා
        const serializedContacts = JSON.parse(JSON.stringify(contacts, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        return res.status(200).json(serializedContacts);
    } catch (error) {
        console.error("Error fetching contacts:", error);
        return res.status(500).json({ message: "Failed to fetch contacts" });
    }
};

const markAllRead = async (req, res) => {
    try {
        let whereClause = {};
        
        await prisma.whatsapp_leads.updateMany({
            where: whereClause,
            data: { unread_count: 0 }
        });

        return res.status(200).json({ message: "Marked all as read" });
    } catch (error) {
        console.error("Error marking as read:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

const addContact = async (req, res) => { return res.status(200).json({ message: "Contact Added" }); };
const bulkAddContacts = async (req, res) => { return res.status(200).json({ message: "Bulk Contacts Added" }); };
const updateContact = async (req, res) => { return res.status(200).json({ message: "Contact Updated" }); };

module.exports = { 
    getLeads, 
    bulkAssignLeads, 
    getContacts, 
    markAllRead,
    addContact,
    bulkAddContacts,
    updateContact
};