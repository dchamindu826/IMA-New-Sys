const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. My Payments Tab එක
const getMyPayments = async (req, res) => {
    try {
        const userId = req.user.id;

        // ඔයාගේ DB එකේ Payments Table එකෙන් ළමයාගේ Payments ටික ගන්න
        const payments = await prisma.payments.findMany({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' }
        });

        const oldPayments = payments.filter(p => p.status === 1 || p.status === -1);
        const installmentPayments = []; // ඔයාගේ DB එකේ Installments තියෙනවා නම් මෙතනට දාන්න

        res.status(200).json({ oldPayments, installmentPayments });
    } catch (error) {
        console.error("My Payments Error:", error);
        res.status(500).json({ message: "Failed to load payments" });
    }
};

// 2. Upload Bank Slip
const uploadSlip = async (req, res) => {
    try {
        const userId = req.user.id;
        const { mainPaymentId, remark } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Slip image is required" });
        }

        const slipName = req.file.filename;

        // Payment එක Update කරනවා Slip එකත් එක්ක (Status -1 = Pending Review)
        await prisma.payments.update({
            where: { id: Number(mainPaymentId) },
            data: {
                slip_image: slipName,
                status: -1, 
                remark: remark || "Uploaded via App"
            }
        });

        res.status(200).json({ message: "Slip uploaded successfully", slipImage: slipName });
    } catch (error) {
        console.error("Slip Upload Error:", error);
        res.status(500).json({ message: "Failed to upload slip" });
    }
};

module.exports = { getMyPayments, uploadSlip };