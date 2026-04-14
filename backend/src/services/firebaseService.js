const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 🔥 FIX: Credentials file path updated 🔥
const serviceAccountPath = path.join(__dirname, '../../public/firebase_credentials.json');

if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Firebase Admin Initialized Successfully!");
} else {
    console.error("⚠️ Firebase credentials file NOT FOUND at: ", serviceAccountPath);
    console.error("⚠️ Push notifications will not work until you upload firebase_credentials.json to the public folder.");
}

const sendPushNotification = async (title, body, imageUrl, targetTopic) => {
    if (!admin.apps.length) return false; 
    
    try {
        const message = {
            notification: { title: title, body: body },
            topic: targetTopic 
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