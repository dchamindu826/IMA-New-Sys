const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const DUMMY_BANK_TRANSACTIONS = [
    { refNo: "10293847", date: "2026-03-27", amount: 50000, fromAcc: "00123456" },
    { refNo: "BOC-9988", date: "2026-03-27", amount: 15000, fromAcc: "00998877" }
];

const verifySlipImage = async (imagePath, expectedAmount) => {
    try {
        const genAI = new GoogleGenerativeAI("YOUR_GEMINI_API_KEY_HERE"); 
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 

        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString("base64");
        
        const imagePart = { inlineData: { data: base64Image, mimeType: 'image/jpeg' } };

        const prompt = `
            Analyze this bank deposit slip. 
            Find the Amount, Date, and Reference Number/Transaction ID.
            Return ONLY a valid JSON object.
            Format: {"amount": 5000, "date": "YYYY-MM-DD", "referenceNo": "123456", "isClear": true}
        `;

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const extractedData = JSON.parse(responseText);

        console.log("AI Extracted:", extractedData);

        if (parseFloat(extractedData.amount) !== parseFloat(expectedAmount)) {
            return { status: 'MISMATCHED', reason: 'Amount does not match system expectations.', data: extractedData };
        }

        const bankMatch = DUMMY_BANK_TRANSACTIONS.find(tx => 
            tx.refNo === extractedData.referenceNo || 
            (tx.amount === parseFloat(extractedData.amount) && tx.date === extractedData.date)
        );

        if (bankMatch && extractedData.isClear) {
            console.log("✅ Bank API & Slip Matched! Auto-Approving...");
            return { status: 'SUCCESS', message: 'Matched with Bank JSON', data: extractedData, approver: 9999 };
        } else {
            return { status: 'PENDING_MANUAL', reason: 'Slip amount is correct, but not found in Bank JSON yet.', data: extractedData };
        }

    } catch (error) {
        console.error("AI Error:", error.message);
        return { status: 'FAILED', error: error.message };
    }
};

module.exports = { verifySlipImage };