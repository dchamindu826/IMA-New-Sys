const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Type String එක Number එකකට හරවන Function එක (Frontend එකේ තියෙන විදිහටම)
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

// ==========================================
// 1. ADD FOLDER (Content Group) - PERFECT ORDER LOGIC
// ==========================================
const addContentGroup = async (req, res) => {
    try {
        const { title, type, order, batch_id, course_code } = req.body;
        const itemOrder = parseInt(order) || 1;
        const folderType = parseInt(type);
        
        // Frontend එකෙන් එන safe code එක ගන්නවා
        const safeCourseCode = course_code === 'NULL' ? null : course_code;

        // 🔥 100% නිවැරදි Validation: එකම Batch එකේ, එකම Type එකේ (Live/Rec), එකම Subject එකේ (Course Code) Order එක තියෙනවද බලනවා.
        const existingOrder = await prisma.content_groups.findFirst({
            where: {
                batch_id: BigInt(batch_id),
                type: folderType,
                itemOrder: itemOrder,
                // code එක null නම් null විදිහටත්, නැත්නම් අදාල code එකටත් check කරනවා
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

// ==========================================
// 2. ADD CONTENT & MASS ASSIGN
// ==========================================
const addContentMassAssign = async (req, res) => {
    try {
        const { type, contentGroupId, title, link, zoomMeetingId, date, startTime, endTime, paperTime, questionCount, isFree, selectedCourses } = req.body;
        
        const contentTypeInt = getTypeInt(type);
        const coursesArray = selectedCourses ? JSON.parse(selectedCourses) : []; // Mass assign කරන courses වල IDs

        // File එකක් ඇවිත් තියෙනවද බලනවා (Documents, Papers වලට)
        const fileName = req.file ? req.file.filename : null;

        // 1. අලුත් Content එක DB එකට දානවා
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

        // 2. Mass Assign කරනවා (අදාළ Courses ටිකට මේ Content එක ලින්ක් කරනවා)
        if (coursesArray.length > 0) {
            const contentCourseData = coursesArray.map(courseId => ({
                content_id: newContent.id,
                course_id: BigInt(courseId),
                type: contentTypeInt,
                itemOrder: "0", // Content එකේ default order එක
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

// Toggle Business Status
const toggleBusinessStatus = async (req, res) => {
    try {
        const { business_id, status } = req.body;
        await prisma.businesses.update({
            where: { id: BigInt(business_id) },
            data: { status: parseInt(status) }
        });
        res.status(200).json({ message: "Status Updated" });
    } catch (e) {
        res.status(500).json({ error: "Update failed" });
    }
};

// Toggle Batch Status
const toggleBatchStatus = async (req, res) => {
    try {
        const { batch_id, status } = req.body;
        await prisma.batches.update({
            where: { id: BigInt(batch_id) },
            data: { status: parseInt(status) }
        });
        res.status(200).json({ message: "Status Updated" });
    } catch (e) {
        res.status(500).json({ error: "Update failed" });
    }
};

// ==========================================
// 3. CREATE & UPDATE PAYMENT GROUP (FIXED)
// ==========================================
const createGroup = async (req, res) => {
    try {
        const { batch_id, name, paymentType, itemOrder, discountRules } = req.body;
        const newGroup = await prisma.groups.create({
            data: {
                batch_id: BigInt(batch_id),
                name: name,
                type: paymentType === 'Monthly' ? 1 : 2, // 1=Monthly, 2=Full
                itemOrder: parseInt(itemOrder) || 1,
                discount_rules: discountRules,
                created_at: new Date()
            }
        });
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
        res.status(200).json({ message: "Group Updated Successfully", data: safeJson(updatedGroup) });
    } catch (error) {
        console.error("Update Group Error:", error);
        res.status(500).json({ error: "Failed to update group" });
    }
};

// ==========================================
// UPDATE CONTENT 
// ==========================================
const updateContentMassAssign = async (req, res) => {
    try {
        const { content_id, type, contentGroupId, title, link, zoomMeetingId, date, startTime, endTime, paperTime, questionCount, isFree } = req.body;
        
        const contentTypeInt = getTypeInt(type);

        // Update කරන්න ඕනේ Data ටික ලෑස්ති කරගන්නවා
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

        // අලුතෙන් File එකක් Upload කරලා තියෙනවා නම් විතරක් fileName එක Update කරනවා
        if (req.file) {
            updateData.fileName = req.file.filename;
        }

        // Database එක Update කරනවා
        const updatedContent = await prisma.contents.update({
            where: { id: BigInt(content_id) },
            data: updateData
        });

        // Safe JSON පාවිච්චි කරලා BigInt errors නැතිව යවනවා
        const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

        res.status(200).json({ message: "Content Updated Successfully!", data: safeJson(updatedContent) });
    } catch (error) {
        console.error("Content Update Error:", error);
        res.status(500).json({ error: "Failed to update content" });
    }
};

const { sendPushNotification } = require('../services/firebaseService'); // උඩින්ම Import කරගන්න

const createAdminPost = async (req, res) => {
    try {
        const { title, description, businessId, batchId } = req.body;
        
        // 🔥 FIX 1: ෆොටෝ එකක් නැත්නම් 'default.png' හරි හිස් එකක් හරි යවනවා (DB එකේ null තියන්න බැරි නිසා) 🔥
        const imageName = req.file ? req.file.filename : 'default.png'; 

        const bId = (businessId && businessId !== 'all' && businessId !== 'null') ? BigInt(businessId) : null;
        const btId = (batchId && batchId !== 'all' && batchId !== 'null') ? BigInt(batchId) : null;

        // 1. Database එකේ Post එක සේව් කිරීම
        const newPost = await prisma.posts.create({
            data: {
                title: title,
                caption: description, // 🔥 FIX 2: description වෙනුවට 'caption' කියලා යැව්වා (Database එකේ තියෙන්නේ එහෙමයි) 🔥
                image: imageName,
                business_id: bId,
                batch_id: btId,
                created_at: new Date()
            }
        });

        // 2. කාටද යවන්නේ කියලා තීරණය කිරීම (Topic Routing)
        let targetTopic = 'all_users'; 
        if (btId) {
            targetTopic = `batch_${btId}`; 
        } else if (bId) {
            targetTopic = `business_${bId}`; 
        }

        // 3. Notification එක යැවීම (Error ආවත් Post එක සේව් වෙන්න Try-Catch එක)
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

// ==========================================
// GET BATCHES FULL (With Access Control)
// ==========================================
const getBatchesFull = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        let batches = [];

        // 1. Admin කෙනෙක් නම් මුළු System එකේම තියෙන ඒවා ගන්නවා
        if (['System Admin', 'superadmin', 'Director', 'Admin'].includes(userRole)) {
            batches = await prisma.batches.findMany({
                where: { status: 1 },
                include: {
                    business: true, // Business එකේ නම සහ විස්තර
                    groups: { include: { courses: true } } // ඒ batch එකේ subjects
                }
            });
        } 
        // 2. Manager කෙනෙක් නම් එයාට අදාල Business එකේ ඒවා විතරයි
        else if (['Manager', 'Ass Manager'].includes(userRole)) {
            batches = await prisma.batches.findMany({
                where: {
                    business: {
                        OR: [
                            { head_manager_id: parseInt(userId) },
                            { ass_manager_id: parseInt(userId) }
                        ]
                    },
                    status: 1
                },
                include: {
                    business: true,
                    groups: { include: { courses: true } }
                }
            });
        }

        // JSON එකට හරවලා යවනවා (BigInt ප්‍රශ්න එන්නේ නැති වෙන්න)
        const safeData = JSON.parse(JSON.stringify(batches, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        return res.status(200).json(safeData);
    } catch (error) {
        console.error("Batches Fetch Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

// අන්තිමට module.exports එකට getBatchesFull එකතු කරන්න අමතක කරන්න එපා:
module.exports = {
    addContentGroup, addContentMassAssign, createGroup, updateGroup, updateContentMassAssign, createAdminPost, getBatchesFull
};
