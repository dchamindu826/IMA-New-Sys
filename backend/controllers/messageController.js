const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

const getMessages = async (req, res) => {
    try {
        const leadId = req.params.leadId;
        const lead = await prisma.whatsapp_leads.findUnique({ where: { id: parseInt(leadId) } });
        if (!lead) return res.status(404).json({ message: "Contact not found" });

        const messages = await prisma.chat_logs.findMany({
            where: { phone: lead.phone_number },
            orderBy: { created_at: 'asc' }
        });

        return res.status(200).json(safeJson(messages));
    } catch (error) {
        console.error("Error fetching messages:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

const markContactRead = async (req, res) => {
    try {
        const leadId = req.params.id;
        await prisma.whatsapp_leads.update({
            where: { id: parseInt(leadId) },
            data: { unread_count: 0 }
        });
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: "Server Error" });
    }
};

// 🔥 WhatsApp එකට ඇත්තටම මැසේජ් එක යවන Function එක 🔥
const sendManualMessage = async (req, res) => {
    try {
        const { contactId, to, text, type, mediaUrl, agentName, replyToMessageId } = req.body;
        
        // 1. Lead එක සහ CRM Config ගන්නවා
        const lead = await prisma.whatsapp_leads.findUnique({ where: { id: parseInt(contactId) } });
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        const crmConfig = await prisma.crm_configs.findFirst({
            where: { business_id: lead.owner_id }
        });

        if (!crmConfig || !crmConfig.meta_token) {
            return res.status(400).json({ message: "Meta API config missing" });
        }

        // 2. Meta එකට යවන Payload එක හදනවා
        let metaPayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: to,
        };

        // 🔥 Reply එකක් නම් (Frontend එකෙන් replyToMessageId එවුවොත් ඒක context එකට දානවා) 🔥
        if (replyToMessageId) {
            metaPayload.context = { message_id: replyToMessageId };
        }

        // Media Types වෙන් කරනවා
        if (type === 'image' && mediaUrl) {
            metaPayload.type = "image";
            metaPayload.image = { link: mediaUrl, caption: text || "" };
        } else if (type === 'video' && mediaUrl) {
            metaPayload.type = "video";
            metaPayload.video = { link: mediaUrl, caption: text || "" };
        } else if (type === 'audio' && mediaUrl) {
            metaPayload.type = "audio";
            metaPayload.audio = { link: mediaUrl };
        } else if (type === 'document' && mediaUrl) {
            metaPayload.type = "document";
            metaPayload.document = { link: mediaUrl, caption: text || "", filename: "Document" };
        } else {
            metaPayload.type = "text";
            metaPayload.text = { body: text || mediaUrl };
        }

        // 3. Meta API එකට යවනවා
        const response = await axios.post(
            `https://graph.facebook.com/v18.0/${crmConfig.meta_phone_id}/messages`,
            metaPayload,
            { headers: { Authorization: `Bearer ${crmConfig.meta_token}` } }
        );

        // 🔥 WhatsApp එකෙන් එන අලුත් ID එක සේව් කරනවා 🔥
        const waMsgId = response.data.messages?.[0]?.id;

        // 4. DB එකේ Save කරනවා
        const newMsg = await prisma.chat_logs.create({
            data: {
                phone: to,
                sender_type: "STAFF",
                message: text || mediaUrl,
                is_read: true,
                wa_msg_id: waMsgId // 🔥 යවපු මැසේජ් එකේ ID එක DB එකට දානවා 🔥
            }
        });
        
        return res.status(200).json(safeJson(newMsg));
    } catch (error) {
        console.error("Meta Send Error:", error.response?.data || error.message);
        return res.status(500).json({ message: "Failed to send message to WhatsApp" });
    }
};

module.exports = { getMessages, markContactRead, sendManualMessage };