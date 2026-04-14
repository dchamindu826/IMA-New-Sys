const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getTypeInt = (typeStr) => {
    switch(typeStr) {
        case 'live': return 1;
        case 'recording': return 2;
        case 'document': return 3;
        case 'sPaper': return 4;
        case 'paper': return 5;
        default: return parseInt(typeStr) || 1;
    }
};

const addContentGroup = async (req, res) => {
    try {
        const { title, type, order, batch_id, course_code } = req.body;
        const itemOrder = parseInt(order) || 1;
        const folderType = parseInt(type);
        const safeCourseCode = course_code === 'NULL' ? null : course_code;

        const existingOrder = await prisma.content_groups.findFirst({
            where: {
                batch_id: BigInt(batch_id),
                type: folderType,
                itemOrder: itemOrder,
                course_code: safeCourseCode 
            }
        });

        if (existingOrder) {
            return res.status(400).json({ error: `Order Number ${itemOrder} is already used in this specific section. Please use a different number.` });
        }

        const newFolder = await prisma.content_groups.create({
            data: {
                title,
                type: folderType,
                itemOrder,
                batch_id: BigInt(batch_id),
                course_code: safeCourseCode,
                created_at: new Date()
            }
        });

        res.status(201).json({ message: "Folder Created!", data: newFolder });
    } catch (error) {
        console.error("Folder Add Error:", error);
        res.status(500).json({ error: "Failed to create folder" });
    }
};

const addContentMassAssign = async (req, res) => {
    try {
        const { type, contentGroupId, title, link, zoomMeetingId, date, startTime, endTime, paperTime, questionCount, isFree, selectedCourses } = req.body;
        
        const contentTypeInt = getTypeInt(type);
        const coursesArray = selectedCourses ? JSON.parse(selectedCourses) : []; 
        const fileName = req.file ? req.file.filename : null;

        const newContent = await prisma.contents.create({
            data: {
                title,
                type: contentTypeInt,
                content_group_id: contentGroupId ? parseInt(contentGroupId) : null,
                link: link || null,
                zoomMeetingId: zoomMeetingId || null,
                fileName: fileName,
                date: date ? new Date(date) : null,
                startTime: startTime || null,
                endTime: endTime || null,
                paperTime: paperTime ? parseInt(paperTime) : null,
                questionCount: questionCount ? parseInt(questionCount) : null,
                isFree: isFree === '1' || isFree === 'true',
                created_at: new Date()
            }
        });

        if (coursesArray.length > 0) {
            const contentCourseData = coursesArray.map(courseId => ({
                content_id: newContent.id,
                course_id: BigInt(courseId),
                type: contentTypeInt,
                itemOrder: "0",
                created_at: new Date()
            }));

            await prisma.content_course.createMany({
                data: contentCourseData
            });
        }

        res.status(201).json({ message: "Content Assigned Successfully!", data: newContent });
    } catch (error) {
        console.error("Content Add Error:", error);
        res.status(500).json({ error: "Failed to add content" });
    }
};

const createGroup = async (req, res) => {
    try {
        const { batch_id, name, paymentType, itemOrder, discountRules } = req.body;
        const newGroup = await prisma.groups.create({
            data: {
                batch_id: BigInt(batch_id),
                name: name,
                type: paymentType === 'Monthly' ? 1 : 2,
                itemOrder: parseInt(itemOrder) || 1,
                discount_rules: discountRules,
                created_at: new Date()
            }
        });
        const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        res.status(201).json({ message: "Group Created Successfully", data: safeJson(newGroup) });
    } catch (error) {
        console.error("Create Group Error:", error);
        res.status(500).json({ error: "Failed to create group" });
    }
};

const updateGroup = async (req, res) => {
    try {
        const { group_id, name, paymentType, itemOrder, discountRules } = req.body;
        const updatedGroup = await prisma.groups.update({
            where: { id: BigInt(group_id) },
            data: {
                name: name,
                type: paymentType === 'Monthly' ? 1 : 2,
                itemOrder: parseInt(itemOrder) || 1,
                discount_rules: discountRules,
                updated_at: new Date()
            }
        });
        const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        res.status(200).json({ message: "Group Updated Successfully", data: safeJson(updatedGroup) });
    } catch (error) {
        console.error("Update Group Error:", error);
        res.status(500).json({ error: "Failed to update group" });
    }
};

const updateContentMassAssign = async (req, res) => {
    try {
        const { content_id, type, contentGroupId, title, link, zoomMeetingId, date, startTime, endTime, paperTime, questionCount, isFree } = req.body;
        
        const contentTypeInt = getTypeInt(type);

        let updateData = {
            title,
            type: contentTypeInt,
            content_group_id: contentGroupId ? parseInt(contentGroupId) : null,
            link: link || null,
            zoomMeetingId: zoomMeetingId || null,
            date: date ? new Date(date) : null,
            startTime: startTime || null,
            endTime: endTime || null,
            paperTime: paperTime ? parseInt(paperTime) : null,
            questionCount: questionCount ? parseInt(questionCount) : null,
            isFree: isFree === '1' || isFree === 'true',
            updated_at: new Date()
        };

        if (req.file) {
            updateData.fileName = req.file.filename;
        }

        const updatedContent = await prisma.contents.update({
            where: { id: BigInt(content_id) },
            data: updateData
        });

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

        res.status(200).json({ message: "Content Updated Successfully!", data: safeJson(updatedContent) });
    } catch (error) {
        console.error("Content Update Error:", error);
        res.status(500).json({ error: "Failed to update content" });
    }
};

const { sendPushNotification } = require('../../services/firebaseService');

const createAdminPost = async (req, res) => {
    try {
        const { title, description, businessId, batchId } = req.body;
        
        const imageName = req.file ? req.file.filename : 'default.png'; 

        const bId = (businessId && businessId !== 'all' && businessId !== 'null') ? BigInt(businessId) : null;
        const btId = (batchId && batchId !== 'all' && batchId !== 'null') ? BigInt(batchId) : null;

        const newPost = await prisma.posts.create({
            data: {
                title: title,
                caption: description, 
                image: imageName,
                business_id: bId,
                batch_id: btId,
                created_at: new Date()
            }
        });

        let targetTopic = 'all_users'; 
        if (btId) {
            targetTopic = `batch_${btId}`; 
        } else if (bId) {
            targetTopic = `business_${bId}`; 
        }

        const imageUrl = imageName !== 'default.png' ? `http://72.62.249.211:5000/storage/posts/${imageName}` : null;
        
        try {
            await sendPushNotification(title, description, imageUrl, targetTopic);
        } catch (pushErr) {
            console.log("Push Notification Failed, but Post was saved:", pushErr.message);
        }

        const safeJson = (data) => JSON.parse(JSON.stringify(data, (k, v) => typeof v === 'bigint' ? v.toString() : v));
        return res.status(201).json({ message: "Post created successfully!", data: safeJson(newPost) });

    } catch (error) {
        console.error("Post Create Error:", error);
        return res.status(500).json({ error: error.message });
    }
};

const getBatchesFull = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        let batches = [];

        if (['System Admin', 'superadmin', 'Director', 'Admin'].includes(userRole)) {
            batches = await prisma.batches.findMany();
        } 
        else if (['Manager', 'Ass Manager'].includes(userRole)) {
            const managerBusinesses = await prisma.businesses.findMany({
                where: {
                    OR: [
                        { head_manager_id: parseInt(userId) },
                        { ass_manager_id: parseInt(userId) }
                    ]
                }
            });
            const bIds = managerBusinesses.map(b => b.id);
            
            batches = await prisma.batches.findMany({
                where: { business_id: { in: bIds } }
            });
        }

        const allBusinesses = await prisma.businesses.findMany();
        const allGroups = await prisma.groups.findMany();
        const allCourses = await prisma.courses.findMany();

        const fullBatches = batches.map(batch => {
            const batchBizId = batch.business_id ? batch.business_id.toString() : null;
            const business = allBusinesses.find(b => b.id.toString() === batchBizId) || null;
            
            const groups = allGroups.filter(g => g.batch_id && g.batch_id.toString() === batch.id.toString()).map(group => {
                const courses = allCourses.filter(c => c.group_id && c.group_id.toString() === group.id.toString());
                return { ...group, courses };
            });

            return { ...batch, business, groups };
        });

        const safeData = JSON.parse(JSON.stringify(fullBatches, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        return res.status(200).json(safeData);
    } catch (error) {
        console.error("Batches Fetch Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

module.exports = {
    addContentGroup, addContentMassAssign, createGroup, updateGroup, updateContentMassAssign, createAdminPost, getBatchesFull
};