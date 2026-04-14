const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Get All Agents for a Business
const getAgents = async (req, res) => {
    try {
        // 🔴 FIX: owner_id එක අයින් කරලා නිකන්ම agent/Coordinator අයව අදිනවා
        const agents = await prisma.users.findMany({
            where: { role: { in: ['agent', 'Coordinator', 'Staff', 'Call Center'] } }
        });

        // Leads ගාණ සහ ආවරණය කරපු ගාණ හොයනවා
        const agentsWithCounts = await Promise.all(agents.map(async (agent) => {
            const totalAssigned = await prisma.whatsapp_leads.count({
                where: { assigned_to: agent.id }
            });

            const coveredCount = await prisma.whatsapp_leads.count({
                where: { 
                    assigned_to: agent.id,
                    status: { not: 'Pending' }
                }
            });
            
            return { 
                ...agent, 
                _id: agent.id.toString(), // BigInt error එක වලක්වන්න
                name: `${agent.fName} ${agent.lName}`,
                leadCount: totalAssigned || 0,
                coveredCount: coveredCount || 0,
                successRate: totalAssigned > 0 ? ((coveredCount / totalAssigned) * 100).toFixed(1) : 0
            };
        }));

        res.status(200).json(agentsWithCounts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
};

// 2. Get Agent Statistics (For Charts)
const getAgentStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        // Stats ලොජික් එක මෙතනට දාන්න පුළුවන්. දැනට dummy data යවමු UI එක load වෙන්න.
        res.status(200).json({
            summary: {
                totalInbound: 150,
                totalReplied: 120,
                rate: 80.0
            },
            agents: [
                { agentName: 'John Doe', uniqueNumbersReplied: 45, messagesSent: 120 }
            ]
        });

    } catch (err) {        console.error("Agent Stats Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
};

module.exports = { getAgents, getAgentStats };