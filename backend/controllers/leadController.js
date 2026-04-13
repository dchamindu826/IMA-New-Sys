const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// ==========================================
// 1. GET CONTACTS (WhatsApp Inbox)
// ==========================================
const getContacts = async (req, res) => {
    try {
        const userRole = (req.user.role || '').toLowerCase().trim();
        const userId = parseInt(req.user.id);
        const isAdmin = ['system admin', 'admin', 'director', 'manager', 'superadmin'].includes(userRole);

        let whereClause = {};

        // Admin කෙනෙක් නෙමෙයි නම් තමන්ට Assign කරපු ඒවා විතරයි පෙන්වන්නේ
        if (!isAdmin) {
            whereClause.assigned_to = userId;
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

// ==========================================
// 2. ASSIGN SELECTED CHATS (WhatsApp Manual)
// ==========================================
const assignChats = async (req, res) => {
    try {
        const { contactIds, agentId } = req.body;
        if (!contactIds || !agentId) return res.status(400).json({ message: "Invalid data" });

        await prisma.whatsapp_leads.updateMany({
            where: { id: { in: contactIds.map(id => parseInt(id)) } }, // Ensure ID is int if using AutoIncrement
            data: { 
                assigned_to: parseInt(agentId),
                status: 'Assigned' 
            }
        });

        res.status(200).json({ message: "Chats assigned successfully" });
    } catch (error) {
        console.error("Assign Chats Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// 3. RESET ASSIGNMENTS (WhatsApp)
// ==========================================
const resetAssignments = async (req, res) => {
    try {
        const { batch_id } = req.body;
        let whereClause = { assigned_to: { not: null } };
        
        if (batch_id && batch_id !== 'All') {
            whereClause.batch_id = parseInt(batch_id);
        }

        await prisma.whatsapp_leads.updateMany({
            where: whereClause,
            data: { 
                assigned_to: null,
                status: 'New' 
            }
        });
        res.status(200).json({ message: "All assignments reset" });
    } catch (error) {
        console.error("Reset Assignments Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// 4. BULK ASSIGN (WhatsApp Manager Action)
// ==========================================
const assignLeadsManual = async (req, res) => {
    try {
        const { agentId, count, assignType, batchId } = req.body; 
        
        let whereClause = { 
            assigned_to: null,
            status: 'New'
        };

        if (batchId && batchId !== 'All') {
            whereClause.batch_id = parseInt(batchId);
        }

        const unassigned = await prisma.whatsapp_leads.findMany({
            where: whereClause,
            orderBy: { 
                id: assignType === 'last' ? 'desc' : 'asc' 
            },
            take: parseInt(count)
        });

        if (unassigned.length === 0) {
            return res.status(404).json({ message: "No unassigned leads found." });
        }

        const ids = unassigned.map(c => c.id);

        await prisma.whatsapp_leads.updateMany({
            where: { id: { in: ids } },
            data: { 
                assigned_to: parseInt(agentId),
                status: 'Assigned'
            }
        });

        return res.status(200).json({ 
            message: `Successfully assigned ${ids.length} leads to agent.`
        });

    } catch (error) {
        console.error("Manual Assign Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 5. UPDATE CALL CAMPAIGN STATUS (Phase Logic)
// ==========================================
const updateCallLog = async (req, res) => {
    try {
        const { lead_id, current_phase, remark, method, attempts, note } = req.body;
        const staff_id = parseInt(req.user.id); 

        // 1. Save the call log
        await prisma.call_logs.create({
            data: {
                lead_id: BigInt(lead_id),
                staff_id: staff_id,
                phase: parseInt(current_phase),
                attempts: parseInt(attempts),
                remark: remark,
                method: method,
                note: note || "",
                created_at: new Date()
            }
        });

        // 2. Logic for Phase Shifting in Call Campaign (`leads` table)
        let nextPhaseStr = `PHASE_${current_phase}`;
        let isCompleted = false;
        let phaseChanged = false;

        if (remark === 'No Answer') {
            if (parseInt(current_phase) === 1) {
                nextPhaseStr = "PHASE_2";
                phaseChanged = true;
            } else if (parseInt(current_phase) === 2) {
                nextPhaseStr = "PHASE_3";
                phaseChanged = true;
            } else if (parseInt(current_phase) >= 3) {
                nextPhaseStr = "CLOSED"; 
                isCompleted = true;
            }
        } else if (remark === 'Reject') {
            nextPhaseStr = "CLOSED";
            isCompleted = true;
        } else if (remark === 'Answer') {
            isCompleted = true; // Stay in phase but mark as resolved
        }

        // Update the Lead in DB (`leads` table NOT `whatsapp_leads`)
        await prisma.leads.update({
            where: { id: BigInt(lead_id) },
            data: { 
                status: nextPhaseStr,
                cStatus: remark // Keep track of the remark
            }
        });

        return res.status(200).json({ 
            message: 'Call log updated', 
            nextPhase: parseInt(current_phase) + 1, 
            isCompleted: isCompleted,
            phaseChanged: phaseChanged
        });

    } catch (error) {
        console.error("Update Call Log Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 6. GET STAFF CALL CAMPAIGN LEADS
// ==========================================
const getStaffLeads = async (req, res) => {
    try {
        const staff_id = req.user.id; 
        const { phase } = req.query; // e.g. "FREE_SEMINAR" or "AFTER_SEMINAR"

        // For Call Campaign, we use the `leads` table.
        const myLeads = await prisma.leads.findMany({
            where: {
                assigned_to: parseInt(staff_id),
                status: { not: 'CLOSED' },
                leadType: phase || "FREE_SEMINAR" // Assuming leadType maps to phase
            },
            orderBy: { updated_at: 'desc' }
        });

        // Get logs for each lead
        const leadsWithLogs = await Promise.all(myLeads.map(async (lead) => {
            const logs = await prisma.call_logs.findMany({
                where: { lead_id: lead.id },
                orderBy: { created_at: 'desc' },
                take: 1 
            });
            return { 
                ...lead, 
                id: lead.id.toString(),
                customer_name: lead.fName + (lead.lName ? ` ${lead.lName}` : ''),
                phone_number: lead.phone,
                current_call_phase: lead.status === 'PHASE_1' ? 1 : lead.status === 'PHASE_2' ? 2 : lead.status === 'PHASE_3' ? 3 : 1,
                last_log: logs[0] || null 
            };
        }));

        return res.status(200).json(safeJson(leadsWithLogs));

    } catch (error) {
        console.error("Get Staff Leads Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 7. AUTO ASSIGNMENT QUEUE LOGIC
// ==========================================
const processAutoAssignment = async (batch_id, lead_id) => {
    try {
        const assignments = await prisma.batch_staff_assignments.findMany({
            where: { batch_id: BigInt(batch_id) },
            orderBy: { id: 'asc' } 
        });

        for (let assign of assignments) {
            if (assign.assigned_count < assign.quota) {
                // Assign to Call Campaign Leads
                await prisma.leads.update({
                    where: { id: BigInt(lead_id) },
                    data: { 
                        assigned_to: assign.staff_id,
                        status: 'PHASE_1'
                    }
                });

                await prisma.batch_staff_assignments.update({
                    where: { id: assign.id },
                    data: { assigned_count: assign.assigned_count + 1 }
                });
                break;
            }
        }
    } catch (error) {
        console.error("Auto Assign Error:", error);
    }
};

module.exports = {
    getContacts,
    assignChats,
    resetAssignments,
    assignLeadsManual,
    processAutoAssignment,
    updateCallLog,
    getStaffLeads
};