const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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

            // 🔥 FIX: Safe JSON Parsing (DB එකේ වැරදි Data තිබ්බත් මේක Crash වෙන්නේ නෑ) 🔥
            let parsedGemini = ['', '', '', '', ''];
            let parsedReplies = [{text:''}, {text:''}, {text:''}];
            
            try { if (c.gemini_keys) parsedGemini = JSON.parse(c.gemini_keys); } catch(e) { console.log("Gemini parse error bypassed"); }
            try { if (c.auto_replies) parsedReplies = JSON.parse(c.auto_replies); } catch(e) { console.log("Replies parse error bypassed"); }

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
        console.error("Fetch CRM Error:", error); // Terminal එකේ Error එක හරියටම බලාගන්න පුළුවන්
        res.status(500).json({ error: "Failed to fetch CRM config" });
    }
};

// 2. Save CRM Configurations & Files
const saveCrmConfig = async (req, res) => {
    try {
        const { businessId, configData } = req.body;
        const config = JSON.parse(configData);
        const bId = BigInt(businessId);

        const phases = ['FREE_SEMINAR', 'AFTER_SEMINAR'];
        
        for (const phase of phases) {
            const data = config[phase];
            const updatedReplies = [...data.replies];

            // Attach files to auto replies if uploaded
            for (let i = 0; i < 3; i++) {
                if (req.files && req.files[`replyFile_${phase}_${i}`]) {
                    updatedReplies[i].fileName = req.files[`replyFile_${phase}_${i}`][0].filename;
                }
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
                handoff_limit: data.handoffLimit
            };

            if (existing) {
                await prisma.crm_configs.update({ where: { id: existing.id }, data: dbData });
            } else {
                await prisma.crm_configs.create({ data: { business_id: bId, phase, ...dbData } });
            }

            // Save new Training Files
            if (req.files) {
                const trainingKeys = Object.keys(req.files).filter(k => k.startsWith(`trainedFiles_${phase}`));
                for (const key of trainingKeys) {
                    const filesArr = req.files[key];
                    for (const file of filesArr) {
                        await prisma.crm_training_files.create({
                            data: {
                                business_id: bId,
                                phase: phase,
                                file_name: file.filename,
                                original_name: file.originalname,
                                size: (file.size / 1024).toFixed(2) + ' KB',
                                type: file.mimetype
                            }
                        });
                    }
                }
            }
        }

        res.status(200).json({ message: "CRM Configuration saved successfully!" });
    } catch (error) {
        console.error("Save CRM Error:", error);
        res.status(500).json({ error: "Failed to save CRM config" });
    }
};

// 3. Delete a Training File
const deleteTrainingFile = async (req, res) => {
    try {
        const { businessId, phase, fileName } = req.body;
        // Delete from DB (Optional: also delete from local storage using fs.unlink)
        await prisma.crm_training_files.deleteMany({
            where: { business_id: BigInt(businessId), phase: phase, original_name: fileName }
        });
        res.status(200).json({ message: "File deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to delete file" });
    }
};

module.exports = { getCrmConfig, saveCrmConfig, deleteTrainingFile };