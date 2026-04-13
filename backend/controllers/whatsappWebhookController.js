const axios = require('axios');
const FormData = require('form-data');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CLOUD_NAME = "dyixoaldi";
const UPLOAD_PRESET = "Chat Bot System";

const getMediaUrlFromMeta = async (mediaId, accessToken) => {
    try {
        const response = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return response.data.url;
    } catch (err) { return null; }
};

const uploadMediaToCloudinary = async (mediaUrl, accessToken) => {
    try {
        const response = await axios.get(mediaUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
            responseType: 'arraybuffer' 
        });

        const formData = new FormData();
        const buffer = Buffer.from(response.data, 'binary');
        formData.append("file", buffer, { filename: "downloaded_media" });
        formData.append("upload_preset", UPLOAD_PRESET);

        const cloudRes = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, formData, {
            headers: { ...formData.getHeaders() }
        });
        return cloudRes.data.secure_url;
    } catch (error) { return null; }
};

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

const callGeminiApi = async (prompt, keysArray, isJson = false) => {
    let config = { temperature: 0.2 };
    if (isJson) config.response_mime_type = "application/json";

    const shuffledKeys = keysArray.sort(() => 0.5 - Math.random());

    for (let i = 0; i < shuffledKeys.length; i++) {
        const geminiKey = shuffledKeys[i];
        try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
            
            const response = await axios.post(geminiUrl, 
                { 
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: config,
                    safetySettings: [
                        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                },
                { headers: { "Content-Type": "application/json" } }
            );
            return response.data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error(`❌ Gemini API Error with Key ${i + 1}:`, error.message);
        }
    }
    return null; 
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

                    let replyContextId = null;
                    if (msgObj.context && msgObj.context.id) replyContextId = msgObj.context.id;

                    console.log(`📥 New Message from: ${senderPhone}`);

                    let crmConfig = await prisma.crm_configs.findFirst({ where: { meta_phone_id: metaPhoneId } });
                    if (!crmConfig) continue;

                    let msgText = "";
                    let incomingMediaUrl = null;

                    if (msgType === "text") msgText = msgObj.text.body;
                    else if (msgType === "button") msgText = msgObj.button.text;
                    else if (msgType === "interactive") msgText = msgObj.interactive.button_reply?.title || msgObj.interactive.list_reply?.title || "Interactive";
                    else if (["image", "video", "audio", "document", "sticker"].includes(msgType)) {
                        const mediaId = msgObj[msgType].id;
                        msgText = msgObj[msgType].caption || ""; 
                        const metaMediaUrl = await getMediaUrlFromMeta(mediaId, crmConfig.meta_token);
                        if (metaMediaUrl) incomingMediaUrl = await uploadMediaToCloudinary(metaMediaUrl, crmConfig.meta_token);
                    } else { msgText = `[Unsupported Format]`; }

                    msgText = msgText ? msgText.replace(/\0/g, '') : "";

                    const activeBatchId = crmConfig.batch_id ? Number(crmConfig.batch_id) : null;
                    const phaseName = crmConfig.phase === 'FREE_SEMINAR' ? 'FREE' : 'AFTER';

                    let contact = await prisma.whatsapp_leads.findUnique({ where: { phone_number: senderPhone } });

                    if (!contact) {
                        try {
                            contact = await prisma.whatsapp_leads.create({
                                data: { phone_number: senderPhone, owner_id: Number(crmConfig.business_id), customer_name: `Guest ${senderPhone.slice(-4)}`, unread_count: 1, phase: phaseName, status: 'New', batch_id: activeBatchId }
                            });

                            // 🔥 AUTO ASSIGN LOGIC 🔥
                            // අලුත් කෙනෙක් ආවම Queue එක බලලා Assign කරනවා
                            if (activeBatchId) {
                                const assignments = await prisma.batch_staff_assignments.findMany({
                                    where: { batch_id: BigInt(activeBatchId) },
                                    orderBy: { id: 'asc' }
                                });

                                for (let assign of assignments) {
                                    if (assign.assigned_count < assign.quota) {
                                        // 1. WhatsApp Inbox එකට Assign කරනවා
                                        await prisma.whatsapp_leads.update({
                                            where: { id: contact.id },
                                            data: { assigned_to: BigInt(assign.staff_id), status: 'Assigned' }
                                        });

                                        // 2. Call Campaign එකට (leads table) Lead එක දානවා
                                        try {
                                            await prisma.leads.create({
                                                data: {
                                                    phone: senderPhone,
                                                    fName: `Guest ${senderPhone.slice(-4)}`,
                                                    leadType: crmConfig.phase, // 'FREE_SEMINAR' etc.
                                                    batch_id: BigInt(activeBatchId),
                                                    business_id: BigInt(crmConfig.business_id),
                                                    assigned_to: assign.staff_id,
                                                    status: 'PHASE_1'
                                                }
                                            });
                                        } catch (leadErr) { console.error("Call Campaign Lead Create Error:", leadErr); }

                                        // 3. Quota එක අප්ඩේට් කරනවා
                                        await prisma.batch_staff_assignments.update({
                                            where: { id: assign.id },
                                            data: { assigned_count: assign.assigned_count + 1 }
                                        });
                                        console.log(`✅ Auto Assigned ${senderPhone} to Agent ID: ${assign.staff_id}`);
                                        break; 
                                    }
                                }
                            }

                        } catch (e) { console.error(e); }
                    } else {
                        contact = await prisma.whatsapp_leads.update({
                            where: { id: contact.id },
                            data: { owner_id: Number(crmConfig.business_id), last_message_time: new Date(), unread_count: (contact.unread_count || 0) + 1, batch_id: activeBatchId, status: contact.status === 'Closed' ? 'New' : contact.status }
                        });
                    }

                    try {
                        const finalMessageToSave = incomingMediaUrl ? `${incomingMediaUrl}\n\n${msgText}` : msgText;
                        await prisma.chat_logs.create({
                            data: { phone: senderPhone, sender_type: "USER", message: finalMessageToSave, is_read: false, wa_msg_id: msgId }
                        });
                    } catch (e) {}

                    // ==========================================
                    // 🤖 AI BOT LOGIC 
                    // ==========================================
                    if (crmConfig.is_ai_active && crmConfig.gemini_keys) {
                        console.log(`🧠 AI Bot Activated for ${senderPhone}...`);
                        
                        try {
                            let keys = [];
                            try {
                                const parsedKeys = JSON.parse(crmConfig.gemini_keys);
                                keys = Array.isArray(parsedKeys) ? parsedKeys.filter(k => k && k.trim().length > 10) : [];
                            } catch (e) {}

                            if (keys.length > 0) {
                                const maxAiReplies = crmConfig.handoff_limit || 5;
                                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                                const aiReplyCount = await prisma.chat_logs.count({
                                    where: { phone: senderPhone, sender_type: "AI_BOT", created_at: { gte: oneHourAgo } }
                                });

                                if (aiReplyCount >= maxAiReplies) {
                                    console.log(`🛑 AI Handoff Limit Reached`);
                                    const handoffMsg = "ඔබට තවදුරටත් ගැටලු ඇත්නම්, කරුණාකර රැඳී සිටින්න. අපගේ නියෝජිතයෙකු ඉතා ඉක්මනින් ඔබව සම්බන්ධ කරගනු ඇත.";
                                    await axios.post(`https://graph.facebook.com/v18.0/${metaPhoneId}/messages`, {
                                        messaging_product: "whatsapp", recipient_type: "individual", to: senderPhone, type: "text", text: { body: handoffMsg }
                                    }, { headers: { Authorization: `Bearer ${crmConfig.meta_token}` }});
                                    await prisma.chat_logs.create({ data: { phone: senderPhone, sender_type: "AI_BOT", message: handoffMsg, is_read: true } });
                                    continue; 
                                }

                                const cleanPhone = senderPhone.replace(/\D/g, '');
                                const last9Digits = cleanPhone.slice(-9);
                                const student = await prisma.users.findFirst({ where: { phone: { endsWith: last9Digits }, role: 'user' } });

                                let studentProfileContext = "User Status: New/Unregistered User. Treat them as a prospective student looking for class information.";
                                if (student) {
                                    const courseUsers = await prisma.course_user.findMany({ where: { user_id: student.id } });
                                    if (courseUsers.length > 0) {
                                        const courseIds = courseUsers.map(c => c.course_id);
                                        const courses = await prisma.courses.findMany({ where: { id: { in: courseIds } } });
                                        const courseNames = courses.map(c => c.name).join(", ");
                                        studentProfileContext = `User Status: Registered Student. Name: ${student.fName} ${student.lName}. Enrolled in: ${courseNames}. Mention their name and enrolled courses.`;
                                    } else {
                                        studentProfileContext = `User Status: Registered Student. Name: ${student.fName} ${student.lName}. Not enrolled in any courses yet. Mention their name.`;
                                    }
                                }

                                const kwPrompt = `Extract 5-10 highly specific ROOT NOUNS and Technical Terms from this question: "${msgText}". Output ONLY a strict JSON Array of strings: ["word1", "word2"]`;
                                const kwResText = await callGeminiApi(kwPrompt, keys, true); 
                                
                                let keywords = [];
                                try {
                                    if (kwResText) keywords = JSON.parse(kwResText.replace(/```json/g, '').replace(/```/g, '').trim());
                                } catch (e) {}

                                let docs = [];
                                if (keywords.length > 0) {
                                    const searchTerms = [];
                                    keywords.forEach(k => {
                                        searchTerms.push(k);
                                        searchTerms.push(...k.split(' ').filter(w => w.length > 2));
                                    });
                                    const uniqueTerms = [...new Set(searchTerms)].slice(0, 8);

                                    const orConditions = uniqueTerms.map(term => ({ content: { contains: term } }));
                                    docs = await prisma.crm_documents.findMany({
                                        where: { business_id: crmConfig.business_id, phase: phaseName, OR: orConditions.length > 0 ? orConditions : undefined },
                                        take: 10
                                    });
                                } 
                                
                                if (docs.length === 0) {
                                    docs = await prisma.crm_documents.findMany({
                                        where: { business_id: crmConfig.business_id, phase: phaseName },
                                        take: 10
                                    });
                                }

                                let ctxTexts = [...new Set(docs.map(d => d.content))]; 
                                const knowledgeBase = ctxTexts.join("\n\n---\n\n");

                                const recentChats = await prisma.chat_logs.findMany({
                                    where: { phone: senderPhone }, orderBy: { created_at: 'desc' }, take: 4
                                });
                                recentChats.reverse();
                                const conversationHistory = recentChats.map(c => `${c.sender_type === 'USER' ? 'User' : 'Assistant'}: ${c.message}`).join("\n");

                                const systemPrompt = `You are a highly professional, friendly, and helpful Customer Support AI Agent for an educational institute in Sri Lanka.
Your ONLY source of truth is the [KNOWLEDGE BASE] and [STUDENT PROFILE] provided below.

CRITICAL RULES FOR BEHAVIOR & TONE:
1. ALWAYS reply in natural, friendly Sinhala Unicode (සිංහල අකුරින්). 
2. TONE: Address the user affectionately ONLY AS "පුතේ" (Puthe) at the beginning of your response. NEVER use formal words like "මහතා", "මහත්මිය", "Mister", "Sir", or "Madam".
3. DO NOT USE ANY ASTERISKS (* or **) FOR BOLDING OR BULLET POINTS. Use standard dashes (-) or numbers (1, 2, 3) for lists. 
4. EMOJI RULE: You may use positive emojis like 📚, ✨, 😊. DO NOT USE sad, crying, or praying emojis (like 😔, 😢, 🙏) under ANY circumstances.

CRITICAL RULES FOR UNDERSTANDING SINGLISH:
5. Users will frequently type in Singlish (e.g., "kawada class tynne", "fee eka kiyada"). You MUST translate these internally to Sinhala to find the answers in the Knowledge Base.

CRITICAL RULES FOR ANSWERING:
6. STRICT KNOWLEDGE RULE: You must ONLY answer using the facts provided in the [KNOWLEDGE BASE]. 
7. 🔥 IF THE USER ASKS A GENERAL QUESTION (e.g., "when are the classes?", "kawadada class thiyenne"), you MUST summarize all the available classes, dates, and times from the [KNOWLEDGE BASE] neatly as a list.
8. If the exact answer is absolutely NOT in the knowledge base, you MUST say EXACTLY this string without adding any emojis at the end: "සමාවෙන්න පුතේ, ඒ පිළිබඳව මට හරියටම තොරතුරු ලබාදිය නොහැක. අපගේ නියෝජිතයෙකු ඉතා ඉක්මනින් ඔබට පිළිතුරු ලබා දෙනු ඇත." (Do not invent answers or add emojis).
9. Do not mention that you are reading from a knowledge base. Keep answers concise.

[STUDENT PROFILE]
${studentProfileContext}

[KNOWLEDGE BASE]
${knowledgeBase || "None available."}

--- RECENT CONVERSATION HISTORY ---
${conversationHistory}
--- END OF HISTORY ---

STUDENT'S CURRENT QUESTION:
${msgText}

Assistant:`;

                                let aiReplyText = await callGeminiApi(systemPrompt, keys, false); 
                                
                                if (!aiReplyText) {
                                    aiReplyText = "⚠️ සිස්ටම් එක කාර්යබහුලයි. කරුණාකර සුළු මොහොතකින් නැවත උත්සාහ කරන්න පුතේ.";
                                } else {
                                    aiReplyText = aiReplyText.replace(/\*\*/g, '').replace(/\* /g, '- ').replace(/ \*/g, ' -');
                                }

                                let replyPayload = {
                                    messaging_product: "whatsapp",
                                    recipient_type: "individual",
                                    to: senderPhone,
                                    type: "text",
                                    text: { body: aiReplyText }
                                };

                                const metaResponse = await axios.post(`https://graph.facebook.com/v18.0/${metaPhoneId}/messages`, replyPayload, { headers: { Authorization: `Bearer ${crmConfig.meta_token}` }});

                                await prisma.chat_logs.create({
                                    data: { phone: senderPhone, sender_type: "AI_BOT", message: aiReplyText, is_read: true, wa_msg_id: metaResponse.data?.messages?.[0]?.id }
                                });
                                
                                console.log(`✅ AI Bot Successfully replied to ${senderPhone}`);
                            }
                        } catch (aiError) { console.error("❌ AI Bot Logic Error:", aiError); }

                    } 
                    else if (crmConfig.is_auto_reply_active && crmConfig.auto_replies) {
                        const replies = JSON.parse(crmConfig.auto_replies);
                        const step = (contact.unread_count || 1) - 1;

                        if (replies[step] && (replies[step].text || replies[step].media_url)) {
                            try {
                                const rep = replies[step];
                                let replyPayload = { messaging_product: "whatsapp", recipient_type: "individual", to: senderPhone };

                                if (rep.media_url) {
                                    replyPayload.type = rep.media_type || "image"; 
                                    replyPayload[replyPayload.type] = { link: rep.media_url };
                                    if (rep.text && replyPayload.type !== 'audio') replyPayload[replyPayload.type].caption = rep.text;
                                } else {
                                    replyPayload.type = "text";
                                    replyPayload.text = { body: rep.text };
                                }

                                const response = await axios.post(`https://graph.facebook.com/v18.0/${metaPhoneId}/messages`, replyPayload, { headers: { Authorization: `Bearer ${crmConfig.meta_token}` }});
                                await prisma.chat_logs.create({
                                    data: { phone: senderPhone, sender_type: "AI_BOT", message: rep.text ? (rep.media_url ? `${rep.media_url}\n\n${rep.text}` : rep.text) : `${rep.media_url}`, is_read: true, wa_msg_id: response.data.messages?.[0]?.id }
                                });
                            } catch (metaErr) {}
                        }
                    }
                }
            }
        }
    } catch (err) {}
};

module.exports = { verifyWebhook, handleIncomingMessage };