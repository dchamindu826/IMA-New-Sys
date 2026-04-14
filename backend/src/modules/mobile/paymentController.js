const { PrismaClient } = require('@prisma/client');
BigInt.prototype.toJSON = function() { return this.toString() } 

const prisma = new PrismaClient();

const getMyPayments = async (req, res) => {
    try {
        const userId = req.user.id;
        const payments = await prisma.payments.findMany({
            where: { student_id: BigInt(userId) },
            orderBy: { created_at: 'desc' }
        });
        res.status(200).json({ oldPayments: payments, installmentPayments: [] });
    } catch (error) {
        res.status(500).json({ message: "Failed to load payments" });
    }
};

const uploadSlip = async (req, res) => {
    try {
        const { mainPaymentId, remark } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Slip image is required" });
        }
        const slipName = req.file.filename;

        // Payment ID එකක් ආවෙම නැත්නම්
        if (!mainPaymentId || mainPaymentId === '0' || mainPaymentId === 'undefined' || mainPaymentId === 'null') {
            console.log("No valid Payment ID provided. Slip saved to folder.");
            return res.status(200).json({ message: "Slip saved successfully, pending enrollment sync.", slipImage: slipName });
        }

        const pid = BigInt(mainPaymentId);

        // 🟢 අනිවාර්යයයි: ID එක Database එකේ තියෙනවද බලනවා (Crash වෙන එක නවත්තන්න)
        const existingPayment = await prisma.payments.findUnique({
            where: { id: pid }
        });

        if (!existingPayment) {
            console.log(`Payment ID ${pid} not found in DB! Slip ${slipName} was saved anyway.`);
            return res.status(200).json({ message: "Slip saved, but waiting for payment sync.", slipImage: slipName });
        }

        // 🟢 Payment එක තියෙනවා නම් විතරක් Update කරනවා
        await prisma.payments.update({
            where: { id: pid },
            data: {
                slipFileName: slipName,
                description: remark || "Uploaded via App",
                validated: false
            }
        });

        res.status(200).json({ message: "Slip uploaded and linked successfully!", slipImage: slipName });
    } catch (error) {
        console.error("Slip Upload Error:", error);
        res.status(500).json({ message: "Failed to upload slip" });
    }
};

module.exports = { getMyPayments, uploadSlip };