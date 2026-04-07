const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Get Chat History for a Contact
const getMessages = async (req, res) => {
    try {
        const { leadId } = req.params;
        
        // Unread count එක 0 කරනවා (Agent චැට් එක ඕපන් කරපු නිසා)
        await prisma.contacts.update({
            where: { id: Number(leadId) },
            data: { unread_count: 0 }
        });

        const messages = await prisma.messages.findMany({
            where: { contact_id: Number(leadId) },
            orderBy: { created_at: 'asc' }
        });

        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ error: "Failed to load messages" });
    }
};

// 2. Send Manual Message from Dashboard
const sendManualMessage = async (req, res) => {
    try {
        const { contactId, to, text, type, mediaUrl, agentName } = req.body;
        const ownerId = req.user.businessId; // Middleware එකෙන් එන Business ID එක

        // Config එක ගන්නවා Token එක හොයාගන්න
        const config = await prisma.crm_configs.findFirst({
            where: { business_id: BigInt(ownerId) }
        });

        if (!config || !config.meta_token) {
            return res.status(400).json({ message: "Meta API is not configured." });
        }

        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: to,
        };

        if (type === 'image' && mediaUrl) {
            payload.type = "image";
            payload.image = { link: mediaUrl, caption: text };
        } else {
            payload.type = "text";
            payload.text = { body: text };
        }

        // Meta API එකට යවනවා
        const waRes = await axios.post(`https://graph.facebook.com/v18.0/${config.meta_phone_id}/messages`, payload, {
            headers: { Authorization: `Bearer ${config.meta_token}` }
        });

        // Database එකේ සේව් කරනවා
        const newMsg = await prisma.messages.create({
            data: {
                contact_id: Number(contactId),
                owner_id: Number(ownerId),
                text: text,
                sender: "me",
                direction: "outbound",
                type: type,
                media_url: mediaUrl,
                whatsapp_message_id: waRes.data.messages?.[0]?.id,
                agent_name: agentName
            }
        });

        res.status(200).json(newMsg);
    } catch (error) {
        console.error("❌ Send Msg Error:", error.response?.data || error.message);
        res.status(500).json({ message: "Failed to send message to Meta" });
    }
};

module.exports = { getMessages, sendManualMessage };