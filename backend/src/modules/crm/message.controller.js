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

        const formattedMessages = messages.map(msg => {
            let parsedMsg = msg.message;
            let extraData = {};
            
            try {
                if (msg.message.startsWith('{') && msg.message.endsWith('}')) {
                    const parsed = JSON.parse(msg.message);
                    parsedMsg = parsed.text;
                    extraData = {
                        agentName: parsed.agentName,
                        mediaUrl: parsed.mediaUrl,
                        mediaType: parsed.type,
                        replyContext: parsed.replyContext
                    };
                }
            } catch (e) {}

            return {
                ...msg,
                message: parsedMsg,
                ...extraData 
            };
        });

        return res.status(200).json(safeJson(formattedMessages));
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
        const { contactId, to, text, type, mediaUrl, agentName, replyContext, replyToMessageId } = req.body;
        
        const lead = await prisma.whatsapp_leads.findUnique({ where: { id: parseInt(contactId) } });
        if (!lead) return res.status(404).json({ message: "Lead not found" });

        const crmConfig = await prisma.crm_configs.findFirst({
            where: { business_id: lead.owner_id }
        });

        if (!crmConfig || !crmConfig.meta_token) {
            return res.status(400).json({ message: "Meta API config missing" });
        }

        let metaPayload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: to,
        };

        if (replyToMessageId) {
            metaPayload.context = { message_id: replyToMessageId };
        }

        // 🔥 FIX 1: Quick Reply වල එන Media Type එක හරියටම Identify කරනවා 🔥
        let finalMediaType = type || 'text';
        if (mediaUrl) {
            if (mediaUrl.match(/\.(jpeg|jpg|gif|png)$/i) || mediaUrl.includes('image/upload')) finalMediaType = 'image';
            else if (mediaUrl.match(/\.(mp4|webm|ogg)$/i) || mediaUrl.includes('video/upload')) finalMediaType = 'video';
            else if (mediaUrl.match(/\.(mp3|wav|ogg)$/i) || mediaUrl.includes('video/upload')) finalMediaType = 'audio';
            else finalMediaType = 'document';
        }

        if (finalMediaType === 'image' && mediaUrl) {
            metaPayload.type = "image";
            metaPayload.image = { link: mediaUrl, caption: text || "" };
        } else if (finalMediaType === 'video' && mediaUrl) {
            metaPayload.type = "video";
            metaPayload.video = { link: mediaUrl, caption: text || "" };
        } else if (finalMediaType === 'audio' && mediaUrl) {
            metaPayload.type = "audio";
            metaPayload.audio = { link: mediaUrl };
        } else if (finalMediaType === 'document' && mediaUrl) {
            metaPayload.type = "document";
            metaPayload.document = { link: mediaUrl, caption: text || "", filename: "Document" };
        } else {
            metaPayload.type = "text";
            metaPayload.text = { body: text || mediaUrl };
        }

        const response = await axios.post(
            `https://graph.facebook.com/v18.0/${crmConfig.meta_phone_id}/messages`,
            metaPayload,
            { headers: { Authorization: `Bearer ${crmConfig.meta_token}` } }
        );

        const waMsgId = response.data.messages?.[0]?.id;

        // 🔥 FIX 2: User Role එකත් අරගෙන Agent Name එකත් එක්කම සේව් කරනවා 🔥
        const userRole = req.user.role || 'Staff'; // Token එකෙන් එන Role එක
        const finalAgentName = agentName ? `${agentName} - ${userRole}` : `Staff - ${userRole}`;

        const messageDataObj = {
            text: text || "",
            mediaUrl: mediaUrl || null,
            type: finalMediaType,
            agentName: finalAgentName, 
            replyContext: replyContext || null
        };

        const newMsg = await prisma.chat_logs.create({
            data: {
                phone: to,
                sender_type: "STAFF",
                message: JSON.stringify(messageDataObj), 
                is_read: true,
                wa_msg_id: waMsgId 
            }
        });
        
        const formattedNewMsg = {
            ...newMsg,
            message: messageDataObj.text,
            agentName: messageDataObj.agentName,
            mediaUrl: messageDataObj.mediaUrl,
            mediaType: messageDataObj.type,
            replyContext: messageDataObj.replyContext
        };

        return res.status(200).json(safeJson(formattedNewMsg));
    } catch (error) {
        console.error("Meta Send Error:", error.response?.data || error.message);
        return res.status(500).json({ message: "Failed to send message to WhatsApp" });
    }
};

module.exports = { getMessages, markContactRead, sendManualMessage };