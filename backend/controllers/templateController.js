const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Meta එකෙන් Templates අදිනවා
const getTemplates = async (req, res) => {
    try {
        const businessId = req.query.businessId || req.user?.businessId || req.user?.owner_id;
        if (!businessId) return res.status(400).json({ message: "Business ID required" });

        const config = await prisma.crm_configs.findFirst({ where: { business_id: Number(businessId) } });
        if (!config || !config.meta_waba_id || !config.meta_token) return res.status(200).json([]); // Config කරලා නැත්නම් හිස් ලිස්ට් එකක් යවනවා

        const metaRes = await axios.get(`https://graph.facebook.com/v18.0/${config.meta_waba_id}/message_templates`, {
            headers: { Authorization: `Bearer ${config.meta_token}` }
        });

        const formattedTemplates = metaRes.data.data.map(t => ({
            id: t.id,
            name: t.name,
            language: t.language,
            status: t.status,
            category: t.category,
            components: t.components
        }));

        res.status(200).json(formattedTemplates);
    } catch (err) {
        console.error("Meta Template Fetch Error:", err.response?.data || err.message);
        res.status(500).json({ message: "Failed to fetch templates from Meta" });
    }
};

// 2. අලුත් Template එකක් Meta එකට යවනවා
const createTemplate = async (req, res) => {
    try {
        const { name, category, language, headerType, headerText, headerUrl, bodyText, footerText, buttons, businessId } = req.body;
        
        const ownerId = businessId || req.user?.businessId || req.user?.owner_id;
        const config = await prisma.crm_configs.findFirst({ where: { business_id: Number(ownerId) } });

        if (!config || !config.meta_waba_id || !config.meta_token) {
            return res.status(400).json({ message: "Meta API is not configured." });
        }

        const components = [];
        
        if (headerType !== 'NONE') {
            let headerComp = { type: 'HEADER', format: headerType };
            if (headerType === 'TEXT') headerComp.text = headerText;
            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && headerUrl) {
                // Meta API requires an example for media templates during creation
                headerComp.example = { header_handle: [headerUrl] }; 
            }
            components.push(headerComp);
        }

        components.push({ type: 'BODY', text: bodyText });
        if (footerText) components.push({ type: 'FOOTER', text: footerText });

        if (buttons && buttons.length > 0) {
            components.push({
                type: 'BUTTONS',
                buttons: buttons.map(b => ({ type: b.type, text: b.text }))
            });
        }

        const payload = { name, category, language, components };

        const metaRes = await axios.post(`https://graph.facebook.com/v18.0/${config.meta_waba_id}/message_templates`, payload, {
            headers: { Authorization: `Bearer ${config.meta_token}` }
        });

        res.status(200).json(metaRes.data);
    } catch (err) {
        console.error("Meta Template Create Error:", err.response?.data || err.message);
        res.status(500).json({ message: "Failed to create template", error: err.response?.data });
    }
};

// 3. Template එකක් මකනවා
const deleteTemplate = async (req, res) => {
    try {
        const { name } = req.params;
        const businessId = req.query.businessId || req.user?.businessId || req.user?.owner_id;

        const config = await prisma.crm_configs.findFirst({ where: { business_id: Number(businessId) } });
        if (!config || !config.meta_waba_id) return res.status(400).json({ message: "Config not found" });

        await axios.delete(`https://graph.facebook.com/v18.0/${config.meta_waba_id}/message_templates?name=${name}`, {
            headers: { Authorization: `Bearer ${config.meta_token}` }
        });

        res.status(200).json({ message: "Deleted successfully" });
    } catch (err) {
        console.error("Meta Template Delete Error:", err.response?.data || err.message);
        res.status(500).json({ message: "Failed to delete template" });
    }
};

module.exports = { getTemplates, createTemplate, deleteTemplate };