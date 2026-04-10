const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// 1. GET ALL CONTACTS
const getContacts = async (req, res) => {
    try {
        const leads = await prisma.whatsapp_leads.findMany({
            orderBy: { last_message_time: 'desc' }
        });

        // Frontend එක බලාපොරොත්තු වෙන විදිහට Map කරනවා
        const formatted = leads.map(c => ({
            ...c,
            _id: c.id,
            phoneNumber: c.phone_number,
            name: c.customer_name,
            ownerId: c.owner_id,
            assignedTo: c.assigned_to ? Number(c.assigned_to) : null,
            callStatus: c.status,
            lastMessageTime: c.last_message_time,
            unreadCount: c.unread_count
        }));

        res.status(200).json(safeJson(formatted));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// 2. ASSIGN SELECTED CHATS (තෝරලා Assign කිරීම)
const assignChats = async (req, res) => {
    try {
        const { contactIds, agentId } = req.body;
        await prisma.whatsapp_leads.updateMany({
            where: { id: { in: contactIds.map(id => parseInt(id)) } },
            data: { assigned_to: parseInt(agentId), status: 'PHASE_1' }
        });
        res.status(200).json({ message: "Contacts assigned successfully!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// 3. BULK ASSIGN (Manager Action - ප්‍රමාණයක් දීලා Assign කිරීම)
const assignLeadsManual = async (req, res) => {
    try {
        const { batch_id, staff_id, qty, order } = req.body; 
        
        // Assign නොකරපු Leads ගන්නවා
        const unassignedLeads = await prisma.whatsapp_leads.findMany({
            where: {
                batch_id: parseInt(batch_id),
                assigned_to: null,
                status: 'New'
            },
            orderBy: { created_at: order === 'last' ? 'desc' : 'asc' },
            take: parseInt(qty)
        });

        if (unassignedLeads.length === 0) {
            return res.status(404).json({ message: "No unassigned leads found for this batch." });
        }

        const leadIds = unassignedLeads.map(lead => lead.id);

        // ඒ ටික Staff ට Assign කරනවා
        await prisma.whatsapp_leads.updateMany({
            where: { id: { in: leadIds } },
            data: { 
                assigned_to: parseInt(staff_id),
                status: 'PHASE_1' 
            }
        });

        res.status(200).json({ 
            message: `Successfully assigned ${leadIds.length} leads.`,
            assigned_count: leadIds.length 
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// 4. RESET ASSIGNMENTS
const resetAssignments = async (req, res) => {
    try {
        const { batch_id } = req.body;
        await prisma.whatsapp_leads.updateMany({
            where: { batch_id: parseInt(batch_id) },
            data: { assigned_to: null, status: 'New' }
        });
        res.status(200).json({ message: "All contacts unassigned successfully!" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getContacts, assignChats, assignLeadsManual, resetAssignments };