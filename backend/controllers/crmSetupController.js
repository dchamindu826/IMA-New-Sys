const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const axios = require('axios');

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// 1. Fetch CRM Configurations
const getCrmConfig = async (req, res) => {
    try {
        const { businessId } = req.params;
        const configs = await prisma.crm_configs.findMany({ where: { business_id: BigInt(businessId) } });
        const files = await prisma.crm_training_files.findMany({ where: { business_id: BigInt(businessId) } });

        const result = {
            FREE_SEMINAR: { isActive: false, isAiBotActive: false, isAutoReplyActive: false, batchId: '', metaPhoneId: '', metaWabaId: '', metaToken: '', geminiKeys: ['', '', '', '', ''], replies: [{text:''}, {text:''}, {text:''}], trainedFiles: [], handoffLimit: 5 },
            AFTER_SEMINAR: { isActive: false, isAiBotActive: false, isAutoReplyActive: false, batchId: '', metaPhoneId: '', metaWabaId: '', metaToken: '', geminiKeys: ['', '', '', '', ''], replies: [{text:''}, {text:''}, {text:''}], trainedFiles: [], handoffLimit: 5 }
        };

        configs.forEach(c => {
            const phase = c.phase;
            let parsedGemini = ['', '', '', '', ''];
            let parsedReplies = [{text:''}, {text:''}, {text:''}];
            
            try { if (c.gemini_keys) parsedGemini = JSON.parse(c.gemini_keys); } catch(e) {}
            try { if (c.auto_replies) parsedReplies = JSON.parse(c.auto_replies); } catch(e) {}

            result[phase] = {
                isAiBotActive: c.is_ai_active || false,
                isAutoReplyActive: c.is_auto_reply_active || false,
                isActive: c.is_ai_active || c.is_auto_reply_active || false,
                batchId: c.batch_id ? c.batch_id.toString() : '',
                metaPhoneId: c.meta_phone_id || '',
                metaWabaId: c.meta_waba_id || '',
                metaToken: c.meta_token || '',
                geminiKeys: parsedGemini,
                replies: parsedReplies,
                handoffLimit: c.handoff_limit || 5,
                trainedFiles: files.filter(f => f.phase === phase).map(f => ({ name: f.original_name, size: f.size, type: f.type, url: `http://72.62.249.211:5000/storage/crm_files/${f.file_name}` }))
            };
        });

        res.status(200).json(safeJson(result));
    } catch (error) {
        console.error("Fetch CRM Error:", error); 
        res.status(500).json({ error: "Failed to fetch CRM config" });
    }
};

// 🔥 අලුත් Function එක: PDF කියවන්නත් Key Rotation පාවිච්චි කිරීම 🔥
const extractTextWithGemini = async (fileBase64, mimeType, keysArray) => {
    const shuffledKeys = keysArray.sort(() => 0.5 - Math.random());
    const prompt = "You are an expert data extractor. Extract ALL text, tables, and information from this document accurately exactly as it is. If it is a timetable, format the dates, times, and subjects clearly in Sinhala/English. Output ONLY the extracted data without any markdown code blocks.";

    for (let i = 0; i < shuffledKeys.length; i++) {
        const geminiKey = shuffledKeys[i];
        try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
            const response = await axios.post(geminiUrl, {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: fileBase64 } }
                    ]
                }]
            }, { headers: { "Content-Type": "application/json" } });

            return response.data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error(`❌ Gemini OCR Error with Key ${i + 1} (Will try next):`, error.response?.data?.error?.message || error.message);
        }
    }
    return null; // ඔක්කොම Keys ටික Limit පැන්නොත් විතරක් null දෙනවා
};

// 2. Save CRM Configurations & Ingest Data via Gemini OCR
const saveCrmConfig = async (req, res) => {
    try {
        const { businessId, configData } = req.body;
        const config = JSON.parse(configData);
        const bId = BigInt(businessId);

        let uploadedFiles = [];
        if (Array.isArray(req.files)) {
            uploadedFiles = req.files;
        } else if (req.files && typeof req.files === 'object') {
            Object.values(req.files).forEach(arr => uploadedFiles.push(...arr));
        }

        const phases = ['FREE_SEMINAR', 'AFTER_SEMINAR'];
        
        for (const phase of phases) {
            const data = config[phase];
            const updatedReplies = [...data.replies];

            for (let i = 0; i < 3; i++) {
                const replyFile = uploadedFiles.find(f => f.fieldname === `replyFile_${phase}_${i}`);
                if (replyFile) updatedReplies[i].fileName = replyFile.filename;
            }

            const existing = await prisma.crm_configs.findFirst({ where: { business_id: bId, phase } });
            
            const dbData = {
                is_ai_active: data.isAiBotActive,
                is_auto_reply_active: data.isAutoReplyActive,
                batch_id: data.batchId ? BigInt(data.batchId) : null,
                meta_phone_id: data.metaPhoneId,
                meta_waba_id: data.metaWabaId,
                meta_token: data.metaToken,
                gemini_keys: JSON.stringify(data.geminiKeys),
                auto_replies: JSON.stringify(updatedReplies),
                handoff_limit: parseInt(data.handoffLimit) || 5
            };

            if (existing) {
                await prisma.crm_configs.update({ where: { id: existing.id }, data: dbData });
            } else {
                await prisma.crm_configs.create({ data: { business_id: bId, phase, ...dbData } });
            }

            // ===============================================
            // 🔥 TEXT EXTRACTION USING GEMINI VISION OCR (WITH KEY ROTATION) 🔥
            // ===============================================
            const phaseTrainingFiles = uploadedFiles.filter(f => f.fieldname === `trainedFiles_${phase}`);
            
            const validKeys = data.geminiKeys.filter(k => k && k.trim().length > 10);

            for (const file of phaseTrainingFiles) {
                await prisma.crm_training_files.create({
                    data: { business_id: bId, phase: phase, file_name: file.filename, original_name: file.originalname, size: (file.size / 1024).toFixed(2) + ' KB', type: file.mimetype }
                });

                try {
                    let extractedText = "";
                    
                    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
                        if (validKeys.length === 0) {
                            extractedText = "⚠️ Error: No valid Gemini API Key found to read this PDF/Image.";
                        } else {
                            const fileBase64 = fs.readFileSync(file.path, { encoding: 'base64' });
                            
                            // 🔥 අලුත් Key Rotation Function එකට කෝල් කිරීම 🔥
                            const resultText = await extractTextWithGemini(fileBase64, file.mimetype, validKeys);
                            
                            if (resultText) {
                                extractedText = resultText;
                            } else {
                                extractedText = "⚠️ Error: Gemini API limits reached on ALL keys. Please wait a few minutes and try saving again.";
                            }
                        }
                    } else if (file.mimetype === 'text/plain') {
                        extractedText = fs.readFileSync(file.path, 'utf8'); 
                    }

                    if (extractedText && extractedText.trim().length > 0) {
                        await prisma.crm_documents.create({
                            data: { business_id: bId, phase: phase, file_name: file.originalname, content: extractedText }
                        });
                        console.log(`✅ Gemini AI Ingested Successfully: ${file.originalname}`);
                    } else {
                        await prisma.crm_documents.create({
                            data: { business_id: bId, phase: phase, file_name: file.originalname, content: `⚠️ Error: Extraction returned empty text.` }
                        });
                    }
                } catch (extractErr) {
                    console.error(`❌ Failed to extract text via Gemini from ${file.originalname}:`, extractErr.message);
                    await prisma.crm_documents.create({
                        data: { business_id: bId, phase: phase, file_name: file.originalname, content: `⚠️ System Error: Unable to read file.` }
                    });
                }
            }
        }
        res.status(200).json({ message: "CRM Configuration saved and Data Ingested using Gemini!" });
    } catch (error) { 
        console.error("Save CRM Error:", error);
        res.status(500).json({ error: "Failed to save CRM config" }); 
    }
};

// 3. Delete a Training File
const deleteTrainingFile = async (req, res) => {
    try {
        const { businessId, phase, fileName } = req.body;
        await prisma.crm_training_files.deleteMany({ where: { business_id: BigInt(businessId), phase: phase, original_name: fileName } });
        await prisma.crm_documents.deleteMany({ where: { business_id: BigInt(businessId), phase: phase, file_name: fileName } });
        res.status(200).json({ message: "File and knowledge deleted successfully" });
    } catch (error) { res.status(500).json({ error: "Failed to delete file" }); }
};

// 4. GET INGESTED CONTENT FOR VIEWING
const viewIngestedContent = async (req, res) => {
    try {
        const { businessId, phase, fileName } = req.body;
        const document = await prisma.crm_documents.findFirst({
            where: { business_id: BigInt(businessId), phase: phase, file_name: fileName }
        });
        
        if (!document) return res.status(404).json({ error: "No extracted text found for this file." });
        res.status(200).json({ content: document.content });
    } catch (error) { res.status(500).json({ error: "Failed to load content" }); }
};

module.exports = { getCrmConfig, saveCrmConfig, deleteTrainingFile, viewIngestedContent };