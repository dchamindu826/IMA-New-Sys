const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// ==========================================
// 1. GET CALL CAMPAIGN LEADS (Staff & Manager Separation)
// ==========================================
const getStaffLeads = async (req, res) => {
    try {
        const staff_id = req.user.id; 
        const userRole = (req.user.role || '').toLowerCase().trim();
        const { phase, agentId } = req.query; // phase = 'FREE_SEMINAR' or 'AFTER_SEMINAR'

        let whereClause = { status: { not: 'CLOSED' } };

        // Phase Filter එක
        if (phase === 'FREE_SEMINAR') whereClause.leadType = 'Free Seminar';
        else if (phase === 'AFTER_SEMINAR') whereClause.leadType = 'After Seminar';

        // 🔥 Manager ද Staff ද කියලා බලලා Filter කරනවා 🔥
        const isAdmin = ['system admin', 'admin', 'director', 'manager', 'superadmin'].includes(userRole);
        if (!isAdmin) {
            whereClause.assigned_to = parseInt(staff_id); // Staff ට එයාගේ ඒවා විතරයි
        } else if (agentId) {
            whereClause.assigned_to = parseInt(agentId); // Admin ට Agent ව filter කරන්න පුළුවන්
        }

        const leads = await prisma.leads.findMany({
            where: whereClause,
            orderBy: { updated_at: 'desc' }
        });

        // අන්තිමට ගත්ත කෝල් එකේ විස්තර (Log එක) අරන් එනවා
        const leadsWithLogs = await Promise.all(leads.map(async (lead) => {
            const logs = await prisma.call_logs.findMany({
                where: { lead_id: lead.id },
                orderBy: { created_at: 'desc' },
                take: 1 
            });
            
            let current_call_phase = 1;
            if (lead.status === 'PHASE_2') current_call_phase = 2;
            if (lead.status === 'PHASE_3') current_call_phase = 3;

            return { 
                id: lead.id.toString(),
                customer_name: lead.fName + (lead.lName ? ` ${lead.lName}` : ''),
                phone_number: lead.phone,
                status: logs[0]?.remark || 'Pending',
                feedback: logs[0]?.note || '',
                current_call_phase: current_call_phase,
                assigned_to: lead.assigned_to?.toString()
            };
        }));

        return res.status(200).json(safeJson(leadsWithLogs));
    } catch (error) {
        console.error("Get Staff Leads Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 2. UPDATE CALL LOG & PHASE SHIFTING LOGIC
// ==========================================
const updateCallLog = async (req, res) => {
    try {
        const { lead_id, phase, call_method, attempts, status, feedback } = req.body;
        const staff_id = parseInt(req.user.id);

        // 1. Call Log එක සේව් කරනවා
        await prisma.call_logs.create({
            data: {
                lead_id: BigInt(lead_id),
                staff_id: staff_id,
                phase: parseInt(phase),
                attempts: parseInt(attempts),
                remark: status,
                method: call_method,
                note: feedback || "",
                created_at: new Date()
            }
        });

        // 2. Phase Shifting Logic (No Answer -> Phase 2 -> Phase 3 -> Closed)
        let nextStatus = `PHASE_${phase}`;
        let isCompleted = false;
        let phaseChanged = false;

        if (status === 'Reject' || status === 'Answer') {
            nextStatus = 'CLOSED'; // Answer කරත්, Reject කරත් එතනින් ඉවරයි
            isCompleted = true;
        } else if (status === 'No Answer') {
            if (parseInt(phase) < 3) {
                nextStatus = `PHASE_${parseInt(phase) + 1}`; // Phase 1 නම් 2 ට යනවා, 2 නම් 3 ට යනවා
                phaseChanged = true;
            } else {
                nextStatus = 'CLOSED'; // Phase 3 එකෙත් No Answer නම් ඉවරයි
                isCompleted = true;
            }
        }

        // Lead එක අප්ඩේට් කරනවා
        await prisma.leads.update({
            where: { id: BigInt(lead_id) },
            data: { status: nextStatus, updated_at: new Date() }
        });

        return res.status(200).json({ 
            message: 'Call log updated', 
            nextPhase: nextStatus, 
            isCompleted: isCompleted,
            phaseChanged: phaseChanged
        });

    } catch (error) {
        console.error("Update Call Log Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getStaffLeads,
    updateCallLog
};