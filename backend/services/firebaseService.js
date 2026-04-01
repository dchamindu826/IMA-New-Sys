const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ෆයිල් එක තියෙන්නේ backend/ ෆෝල්ඩර් එකේ කියලා හරියටම දෙනවා
const serviceAccountPath = path.join(__dirname, '../firebase_credentials.json');

// ෆයිල් එක තියෙනවද කියලා බලලා විතරක් Firebase On කරනවා (Crash වෙන්නේ නෑ)
if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Firebase Admin Initialized Successfully!");
} else {
    console.error("⚠️ Firebase credentials file NOT FOUND at: ", serviceAccountPath);
    console.error("⚠️ Push notifications will not work until you upload firebase_credentials.json to the backend folder.");
}

// targetTopic කියන එකට අදාළ අයට විතරක් යවනවා
const sendPushNotification = async (title, body, imageUrl, targetTopic) => {
    if (!admin.apps.length) return false; // Firebase on වෙලා නැත්නම් යවන්නේ නෑ
    
    try {
        const message = {
            notification: {
                title: title,
                body: body,
            },
            topic: targetTopic // උදා: 'all_users', 'business_5', 'batch_12'
        };
        
        if (imageUrl) {
            message.notification.image = imageUrl;
        }

        const response = await admin.messaging().send(message);
        console.log(`✅ Sent notification to ${targetTopic}:`, response);
        return true;
    } catch (error) {
        console.error('❌ Error sending Firebase notification:', error);
        return false;
    }
};

module.exports = { sendPushNotification };