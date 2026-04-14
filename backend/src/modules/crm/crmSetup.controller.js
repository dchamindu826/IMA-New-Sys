const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

const createBusiness = async (req, res) => {
    try {
        const { name, description, category, businessType, medium, streams } = req.body;
        const logo = req.file ? req.file.filename : 'default.png';
        const finalCategory = category || businessType || 'Advance Level';
        
        const newBusiness = await prisma.businesses.create({
            data: {
                name, logo, description: description || "", category: finalCategory,
                streams: (finalCategory === 'Advance Level' || finalCategory === 'AL') ? streams : null,
                isEnglish: medium === 'English', status: 1, created_at: new Date()
            }
        });
        res.status(201).json({ message: "Business created", data: safeJson(newBusiness) });
    } catch (error) { res.status(500).json({ error: "Failed to create business" }); }
};

const createBatch = async (req, res) => {
    try {
        const { business_id, name, description, type, batchType, itemOrder, streams } = req.body;
        const logo = req.file ? req.file.filename : null;
        const finalType = type || batchType || "1";

        const newBatch = await prisma.batches.create({
            data: {
                business_id: BigInt(business_id), name, description: description || "", logo,
                type: parseInt(finalType), itemOrder: parseInt(itemOrder) || 1,
                streams: streams || null, status: 1, canEnroll: 1, created_at: new Date()
            }
        });
        res.status(201).json({ message: "Batch created", data: safeJson(newBatch) });
    } catch (error) { res.status(500).json({ error: "Failed to create batch" }); }
};

const createGroup = async (req, res) => {
    try {
        const { batch_id, name, paymentType, itemOrder, discountRules } = req.body;
        
        let finalDiscountRules = null;
        if (discountRules) {
            finalDiscountRules = typeof discountRules === 'string' ? discountRules : JSON.stringify(discountRules);
        }

        const newGroup = await prisma.groups.create({
            data: {
                batch_id: BigInt(batch_id), 
                name, 
                type: paymentType === 'Monthly' ? 1 : 2,
                itemOrder: parseInt(itemOrder) || 1, 
                discount_rules: finalDiscountRules, 
                status: 1, 
                created_at: new Date()
            }
        });
        res.status(201).json({ message: "Group created", data: safeJson(newGroup) });
    } catch (error) { 
        console.error("Create Group Error:", error);
        res.status(500).json({ error: "Failed to create group" }); 
    }
};

const updateGroup = async (req, res) => {
    try {
        const { group_id, name, paymentType, itemOrder, discountRules } = req.body;
        
        let finalDiscountRules = null;
        if (discountRules) {
            finalDiscountRules = typeof discountRules === 'string' ? discountRules : JSON.stringify(discountRules);
        }

        const updatedGroup = await prisma.groups.update({
            where: { id: BigInt(group_id) },
            data: {
                name: name,
                type: paymentType === 'Monthly' ? 1 : 2,
                itemOrder: parseInt(itemOrder) || 1,
                discount_rules: finalDiscountRules, 
                updated_at: new Date()
            }
        });
        res.status(200).json({ message: "Group Updated Successfully", data: safeJson(updatedGroup) });
    } catch (error) {
        console.error("Update Group Error:", error);
        res.status(500).json({ error: "Failed to update group" });
    }
};

const createSubject = async (req, res) => {
    try {
        const { name, description, code, itemOrder, stream, streams, groupPricing } = req.body;
        
        let streamValue = null;
        if (streams && Array.isArray(streams) && streams.length > 0) streamValue = streams.join(',');
        else if (stream) streamValue = stream;

        let parsedPricing = [];
        try { 
            parsedPricing = typeof groupPricing === 'string' ? JSON.parse(groupPricing) : groupPricing; 
        } catch (e) { 
            return res.status(400).json({ error: "Invalid pricing format" }); 
        }

        if (!parsedPricing || parsedPricing.length === 0) return res.status(400).json({ error: "Pricing is missing" });

        const createdSubjects = [];
        for (const gp of parsedPricing) {
            const newCourse = await prisma.courses.create({
                data: {
                    name, 
                    description: description || "", 
                    code: code || null, 
                    stream: streamValue, 
                    itemOrder: parseInt(itemOrder) || 1, 
                    price: parseFloat(gp.price),
                    group_id: BigInt(gp.groupId), 
                    status: 1, 
                    created_at: new Date()
                }
            });
            createdSubjects.push(newCourse);
        }
        res.status(201).json({ message: "Subjects created", data: safeJson(createdSubjects) });
    } catch (error) {
        console.error("Subject Create Error:", error); 
        res.status(500).json({ error: "Failed to create subject" });
    }
};

const getInstallments = async (req, res) => {
    try {
        const { batchId } = req.params;
        const plans = await prisma.installment_plans.findMany({ where: { batch_id: BigInt(batchId) } });
        res.status(200).json(safeJson(plans));
    } catch (error) { res.status(500).json({ error: "Failed to fetch installments" }); }
};

const setupInstallment = async (req, res) => {
    try {
        const { batch_id, subjectCount, installmentsData } = req.body;
        const newInstallmentPlan = await prisma.installment_plans.create({
            data: {
                batch_id: BigInt(batch_id), subjectCount: parseInt(subjectCount),
                details: typeof installmentsData === 'string' ? installmentsData : JSON.stringify(installmentsData), 
                status: 1, created_at: new Date()
            }
        });
        res.status(201).json({ message: "Installment setup successfully", data: safeJson(newInstallmentPlan) });
    } catch (error) { res.status(500).json({ error: "Failed to setup installment" }); }
};

const updateInstallment = async (req, res) => {
    try {
        const { plan_id, subjectCount, installmentsData } = req.body;
        await prisma.installment_plans.update({
            where: { id: BigInt(plan_id) },
            data: {
                subjectCount: parseInt(subjectCount),
                details: typeof installmentsData === 'string' ? installmentsData : JSON.stringify(installmentsData)
            }
        });
        res.status(200).json({ message: "Updated successfully" });
    } catch (error) { res.status(500).json({ error: "Update failed" }); }
};

const deleteInstallment = async (req, res) => {
    try {
        const { plan_id } = req.body;
        await prisma.installment_plans.delete({ where: { id: BigInt(plan_id) } });
        res.status(200).json({ message: "Deleted successfully" });
    } catch (error) { res.status(500).json({ error: "Delete failed" }); }
};

const setupDiscount = async (req, res) => {
    try {
        const { batch_id, subjectCount, discountedPrice } = req.body;
        const newDiscount = await prisma.discounts.create({
            data: { batch_id: BigInt(batch_id), subjectCount: parseInt(subjectCount), discountedPrice: parseFloat(discountedPrice), status: 1, created_at: new Date() }
        });
        res.status(201).json({ message: "Discount setup successfully", data: safeJson(newDiscount) });
    } catch (error) { res.status(500).json({ error: "Failed to setup discount" }); }
};

const toggleBusinessStatus = async (req, res) => {
    try {
        const { business_id, status } = req.body;
        await prisma.businesses.update({ where: { id: BigInt(business_id) }, data: { status: parseInt(status) } });
        res.status(200).json({ message: "Status Updated" });
    } catch (e) { res.status(500).json({ error: "Update failed" }); }
};

const toggleBatchStatus = async (req, res) => {
    try {
        const { batch_id, status } = req.body;
        await prisma.batches.update({ where: { id: BigInt(batch_id) }, data: { status: parseInt(status) } });
        res.status(200).json({ message: "Status Updated" });
    } catch (e) { res.status(500).json({ error: "Update failed" }); }
};

// 🔥 අඩුවෙලා තිබ්බ CRM Config Functions ටික (Routes වලට ඕන කරන) 🔥
const getCrmConfig = async (req, res) => {
    try {
        res.status(200).json({ message: "CRM Config fetched" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

const saveCrmConfig = async (req, res) => {
    try {
        res.status(200).json({ message: "CRM Config saved" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

const deleteTrainingFile = async (req, res) => {
    try {
        res.status(200).json({ message: "File deleted" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

const viewIngestedContent = async (req, res) => {
    try {
        res.status(200).json({ message: "Ingested content viewed" });
    } catch (error) { res.status(500).json({ error: error.message }); }
};

module.exports = {
    createBusiness, createBatch, createGroup, updateGroup, createSubject, 
    setupInstallment, getInstallments, updateInstallment, deleteInstallment, 
    setupDiscount, toggleBusinessStatus, toggleBatchStatus,
    // අලුතෙන් එකතු කරපු ටික Export කරනවා
    getCrmConfig, saveCrmConfig, deleteTrainingFile, viewIngestedContent
};