const { PrismaClient } = require('@prisma/client');
const { clear } = require('node:console');
const prisma = new PrismaClient();

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// 1. GET CONTACTS (WhatsApp Inbox)
const getContacts = async (req, res) => {
    try {
        const userRole = (req.user.role || '').toLowerCase().trim();
        const userId = parseInt(req.user.id);
        const isAdmin = ['system admin', 'admin', 'director', 'manager', 'superadmin'].includes(userRole);

        let whereClause = {};

        if (!isAdmin) {
            whereClause.assigned_to = BigInt(userId);
        }

        const contactsList = await prisma.whatsapp_leads.findMany({
            where: whereClause,
            orderBy: { last_message_time: 'desc' }
        });
        
        const formatted = contactsList.map(c => ({
            ...c,
            id: c.id.toString(),
            name: c.customer_name || c.phone_number,
            phone_number: c.phone_number,
            unread_count: c.unread_count || 0
        }));

        res.status(200).json(safeJson(formatted));
    } catch (error) {
        console.error("Get Contacts Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const assignChats = async (req, res) => {
    try {
        const { contactIds, agentId } = req.body;
        if (!contactIds || !agentId) return res.status(400).json({ message: "Invalid data" });

        await prisma.whatsapp_leads.updateMany({
            where: { id: { in: contactIds.map(id => parseInt(id)) } }, 
            data: { assigned_to: BigInt(agentId), status: 'Assigned' }
        });

        res.status(200).json({ message: "Chats assigned successfully" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

const resetAssignments = async (req, res) => {
    try {
        const { batch_id } = req.body;
        let whereClause = { assigned_to: { not: null } };
        if (batch_id && batch_id !== 'All') whereClause.batch_id = parseInt(batch_id);

        await prisma.whatsapp_leads.updateMany({
            where: whereClause,
            data: { assigned_to: null, status: 'New' }
        });
        res.status(200).json({ message: "All assignments reset" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

const assignLeadsManual = async (req, res) => {
    try {
        const { agentId, count, assignType, batchId } = req.body; 
        let whereClause = { assigned_to: null, status: 'New' };
        if (batchId && batchId !== 'All') whereClause.batch_id = parseInt(batchId);

        const unassigned = await prisma.whatsapp_leads.findMany({
            where: whereClause,
            orderBy: { id: assignType === 'last' ? 'desc' : 'asc' },
            take: parseInt(count)
        });

        if (unassigned.length === 0) return res.status(404).json({ message: "No unassigned leads found." });

        const ids = unassigned.map(c => c.id);
        await prisma.whatsapp_leads.updateMany({
            where: { id: { in: ids } },
            data: { assigned_to: BigInt(agentId), status: 'Assigned' }
        });

        return res.status(200).json({ message: `Successfully assigned ${ids.length} leads to agent.` });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

// 2. GET STAFF LEADS (Call Campaign) - 100% Sync with WhatsApp Leads
const getStaffLeads = async (req, res) => {
    try {
        const staff_id = parseInt(req.user.id); 
        const userRole = (req.user.role || '').toLowerCase().trim();
        const isAdmin = ['system admin', 'admin', 'director', 'manager', 'superadmin'].includes(userRole);
        const { phase, agentId } = req.query;

        let whereClause = {};

        // 🔥 FIX: Removed { phase: null } because Prisma throws "Argument phase is missing" Error 🔥
        // We handle empty strings and common naming variations.
        if (phase === 'FREE_SEMINAR') {
            whereClause.OR = [
                { phase: 'FREE_SEMINAR' }, 
                { phase: 'Free Seminar' }, 
                { phase: 'FREE' }, 
                { phase: 'Free' },
                { phase: "" } // Empty strings instead of null
            ];
        } else if (phase === 'AFTER_SEMINAR') {
            whereClause.OR = [
                { phase: 'AFTER_SEMINAR' }, 
                { phase: 'After Seminar' }, 
                { phase: 'AFTER' }, 
                { phase: 'After' }
            ];
        }

        // Admin කෙනෙක් නෙමෙයි නම් තමන්ගේ ඒවා විතරයි.
        if (!isAdmin) {
            whereClause.assigned_to = BigInt(staff_id); 
        } else if (agentId && agentId !== 'All') { 
            whereClause.assigned_to = BigInt(agentId); 
        }

        // කෙලින්ම WhatsApp Leads ටේබල් එකෙන්ම ගන්නවා
        const myLeads = await prisma.whatsapp_leads.findMany({
            where: whereClause,
            orderBy: { last_message_time: 'desc' }
        });

        const leadsWithLogs = await Promise.all(myLeads.map(async (lead) => {
            const logs = await prisma.call_logs.findMany({
                where: { lead_id: lead.id },
                orderBy: { created_at: 'desc' }
            });

            let current_call_phase = 1;
            let isClosed = false;

            if (logs.length > 0) {
                const noAnswerCount = logs.filter(l => l.remark === 'No Answer').length;
                const hasAnsweredOrRejected = logs.some(l => l.remark === 'Answer' || l.remark === 'Reject');
                
                if (hasAnsweredOrRejected) {
                    isClosed = true;
                } else {
                    current_call_phase = Math.min(3, 1 + noAnswerCount);
                }
            }

            return { 
                id: lead.id.toString(),
                customer_name: lead.customer_name || 'Unknown',
                phone_number: lead.phone_number,
                current_call_phase: current_call_phase,
                last_log: logs[0] || null,
                isClosed: isClosed
            };
        }));

        // Answer හෝ Reject කරපු නැති (Active) ඒවා විතරක් යවනවා
        const activeLeads = leadsWithLogs.filter(l => !l.isClosed);

        return res.status(200).json(safeJson(activeLeads));
    } catch (error) {
        console.error("Get Staff Leads Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

// 3. UPDATE CALL LOG (Fixed Variable Names)
const updateCallLog = async (req, res) => {
    try {
        // 🔥 FIX: Frontend එකෙන් එන Variable නම් හරියටම ගත්තා 🔥
        const { lead_id, current_phase, remark, method, attempts, note } = req.body;
        const staff_id = parseInt(req.user.id); 

        await prisma.call_logs.create({
            data: {
                lead_id: BigInt(lead_id),
                staff_id: staff_id,
                phase: parseInt(current_phase) || 1,
                attempts: parseInt(attempts) || 1,
                remark: remark || "Pending",
                method: method || "WhatsApp",
                note: note || "",
                created_at: new Date()
            }
        });

        let isCompleted = false;
        if (remark === 'Reject' || remark === 'Answer' || (remark === 'No Answer' && parseInt(current_phase) >= 3)) {
            isCompleted = true;
        }

        return res.status(200).json({ message: 'Call log updated', isCompleted: isCompleted });

    } catch (error) {
        console.error("Update Call Log Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

const processAutoAssignment = async (batch_id, lead_id) => {
    try {
        const assignments = await prisma.batch_staff_assignments.findMany({
            where: { batch_id: BigInt(batch_id) },
            orderBy: { id: 'asc' } 
        });

        for (let assign of assignments) {
            if (assign.assigned_count < assign.quota) {
                await prisma.whatsapp_leads.update({
                    where: { id: BigInt(lead_id) },
                    data: { assigned_to: BigInt(assign.staff_id), status: 'Assigned' }
                });

                await prisma.batch_staff_assignments.update({
                    where: { id: assign.id },
                    data: { assigned_count: assign.assigned_count + 1 }
                });
                break;
            }
        }
    } catch (error) { console.error("Auto Assign Error:", error); }
};

module.exports = { getContacts, assignChats, resetAssignments, assignLeadsManual, processAutoAssignment, updateCallLog, getStaffLeads };