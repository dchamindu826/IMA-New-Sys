const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const courseConfirm = async (req, res) => {
    try {
        const userId = req.user.id;
        const { businessID, courses, discountEnabled } = req.body;

        // මෙතනදි ඔයාගේ DB එකෙන් Courses වල ගණන් බලලා Total එක හදන්න ඕනේ. 
        // දැනට මම Dummy Amount එකක් දානවා.
        const totalAmount = 25000; 

        // අලුත් Payment Record එකක් Database එකේ හදනවා (Status 0 = Pending)
        const mainPayment = await prisma.payments.create({
            data: {
                user_id: userId,
                business_id: Number(businessID),
                amount: totalAmount,
                status: 0, 
                payment_month: new Date()
            }
        });

        // App එකට ඕනෙ කරන Data ටික යවනවා
        res.status(200).json({
            mainPayment: {
                id: mainPayment.id,
                amount: mainPayment.amount
            },
            isInstallmentAvailable: true // Installments දෙනවද නැද්ද කියන එක
        });
    } catch (error) {
        console.error("Course Confirm Error:", error);
        res.status(500).json({ message: "Failed to confirm course enrollment" });
    }
};

const paymentTypeSelect = async (req, res) => {
    try {
        const { mainPaymentId, paymentType, insOption, insFullAmount } = req.body;

        // මෙතනදි ළමයා Installment එකක් තේරුවොත් ඒකට අදාලව Installment Records ටික DB එකේ හදන්න ඕනේ.
        
        res.status(200).json({
            mainPaymentId: mainPaymentId,
            firstInstallmentId: mainPaymentId + 1000 // පළවෙනි වාරිකයේ ID එක (Dummy)
        });
    } catch (error) {
        console.error("Payment Type Select Error:", error);
        res.status(500).json({ message: "Failed to select payment type" });
    }
};

module.exports = { courseConfirm, paymentTypeSelect };