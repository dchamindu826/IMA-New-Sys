const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const verifyWebhook = (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token && mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
        res.status(200).send(challenge);
    } else {
        res.sendStatus(403);
    }
};

const handleIncomingMessage = async (req, res) => {
    res.status(200).send("EVENT_RECEIVED");

    try {
        const body = req.body;
        if (body.object !== "whatsapp_business_account") return;

        for (const entry of body.entry) {
            for (const change of entry.changes) {
                const value = change.value;

                if (value.statuses) continue;

                if (value.messages && value.messages.length > 0) {
                    const msgObj = value.messages[0];
                    const senderPhone = msgObj.from;
                    const metaPhoneId = value.metadata.phone_number_id; 
                    const msgType = msgObj.type;
                    const msgId = msgObj.id;

                    console.log(`📥 New Message from: ${senderPhone} to Phone ID: ${metaPhoneId}`);

                    // 1. CRM Config හොයනවා
                    let crmConfig;
                    try {
                        crmConfig = await prisma.crm_configs.findFirst({
                            where: { meta_phone_id: metaPhoneId }
                        });
                    } catch (dbError) {
                        console.error("DB Error while finding crm_config:", dbError.message);
                        continue;
                    }

                    if (!crmConfig) {
                        console.log(`❌ No CRM Config found for Phone ID: ${metaPhoneId}`);
                        continue;
                    }

                    let msgText = "";
                    if (msgType === "text") msgText = msgObj.text.body;
                    else if (msgType === "button") msgText = msgObj.button.text;
                    else if (msgType === "interactive") msgText = msgObj.interactive.button_reply?.title || "Interactive";
                    else msgText = `[Attached ${msgType}]`;

                    // 3. Contact සෙවීම හෝ සෑදීම (🔥 whatsapp_leads පාවිච්චි කරනවා 🔥)
                    let contact;
                    try {
                        contact = await prisma.whatsapp_leads.findFirst({ 
                            where: { phone_number: senderPhone, owner_id: Number(crmConfig.business_id) }
                        });
                    } catch (contactErr) {
                        console.error("DB Error finding lead:", contactErr.message);
                        continue;
                    }

                    const activeBatchId = crmConfig.batch_id ? Number(crmConfig.batch_id) : null;
                    const phaseName = crmConfig.phase === 'FREE_SEMINAR' ? 'FREE' : 'AFTER';

                    if (!contact) {
                        console.log(`👤 Creating new lead for: ${senderPhone}`);
                        // අලුත් Lead කෙනෙක්
                        contact = await prisma.whatsapp_leads.create({
                            data: {
                                phone_number: senderPhone,
                                owner_id: Number(crmConfig.business_id), 
                                customer_name: `Guest ${senderPhone.slice(-4)}`,
                                unread_count: 1,
                                phase: phaseName,
                                status: 'New', 
                                batch_id: activeBatchId 
                            }
                        });
                    } else {
                        console.log(`✅ Updating existing lead for: ${senderPhone}`);
                        // පරණ Lead කෙනෙක්
                        contact = await prisma.whatsapp_leads.update({
                            where: { id: contact.id },
                            data: {
                                last_message_time: new Date(),
                                unread_count: (contact.unread_count || 0) + 1,
                                batch_id: activeBatchId,
                                status: contact.status === 'Closed' ? 'New' : contact.status 
                            }
                        });
                    }

                    // 4. Message සේව් කිරීම (🔥 මේක chat_logs හරි messages හරි වෙන්න ඕනේ, ඔයාගේ schema එකේ messages කියලා එකක් නෑ. chat_logs එක තියෙනවා 🔥)
                    try {
                        await prisma.chat_logs.create({
                            data: {
                                phone: senderPhone,
                                sender_type: "USER",
                                message: msgText,
                                is_read: false
                            }
                        });
                    } catch (msgErr) {
                        console.error("DB Error saving message to chat_logs:", msgErr.message);
                    }

                    // 6. Auto Reply Logic
                    if (crmConfig.is_auto_reply_active && crmConfig.auto_replies) {
                        const replies = JSON.parse(crmConfig.auto_replies);
                        const step = (contact.unread_count || 1) - 1;

                        if (replies[step] && replies[step].text) {
                            try {
                                await axios.post(`https://graph.facebook.com/v18.0/${metaPhoneId}/messages`, {
                                    messaging_product: "whatsapp",
                                    to: senderPhone,
                                    type: "text",
                                    text: { body: replies[step].text }
                                }, { headers: { Authorization: `Bearer ${crmConfig.meta_token}` }});

                                // Auto reply එකත් chat_logs එකට සේව් කරනවා
                                await prisma.chat_logs.create({
                                    data: {
                                        phone: senderPhone,
                                        sender_type: "AI_BOT",
                                        message: replies[step].text,
                                        is_read: true
                                    }
                                });
                            } catch (metaErr) {
                                console.error("Meta API Reply Failed:", metaErr.response?.data || metaErr.message);
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error("❌ Webhook Error:", err.message);
    }
};

module.exports = { verifyWebhook, handleIncomingMessage };