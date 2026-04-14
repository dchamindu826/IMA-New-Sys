const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const prisma = new PrismaClient();

// Helper to convert BigInt to String
const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// ==========================================
// 1. DASHBOARDS & OVERVIEWS
// ==========================================

const index = async (req, res) => {
    try {
        const businesses = await prisma.businesses.findMany({ where: { status: 1 } });
        const batches = await prisma.batches.findMany({ where: { status: 1 } });
        const announcements = await prisma.announcements.findMany({ orderBy: { id: 'desc' } });
        const posts = await prisma.posts.findMany({ orderBy: { id: 'desc' } });

        return res.status(200).json(safeJson({
            menu: "AdminHome",
            businesses,
            batches,
            announcements,
            posts
        }));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getManagerOverview = async (req, res) => {
    try {
        // userId eka Number ekakata convert karanna BigInt ekka match wenna
        const userId = Number(req.user.id);

        const business = await prisma.businesses.findFirst({
            where: {
                OR: [
                    { head_manager_id: userId },
                    { ass_manager_id: userId }
                ]
            }
        });

        if (!business) {
            return res.status(200).json({ hasBusiness: false });
        }

        // 1. Business ekata adala okkoma Batches ganna
        const batches = await prisma.batches.findMany({
            where: { business_id: business.id }
        });
        const totalBatches = batches.length;
        const batchIds = batches.map(b => b.id);

        let totalStudents = 0;
        let totalRevenue = 0;
        let revenueData = [];

        if (batchIds.length > 0) {
            // 2. Batches walata adala Groups ganna
            const groups = await prisma.groups.findMany({
                where: { batch_id: { in: batchIds } }
            });
            const groupIds = groups.map(g => g.id);

            // 3. Groups walata adala Courses ganna
            let courseIds = [];
            let courses = [];
            if (groupIds.length > 0) {
                courses = await prisma.courses.findMany({
                    where: { group_id: { in: groupIds } }
                });
                courseIds = courses.map(c => c.id);
            }

            // 4. Real Students count eka calculate karanna (Course_user table eken)
            if (courseIds.length > 0) {
                const courseUsers = await prisma.course_user.findMany({
                    where: { course_id: { in: courseIds } }
                });
                // Ekama lamaya courses dekaka hitiyoth duplicate nowenna Set ekak use karanawa
                const uniqueStudents = new Set(courseUsers.map(cu => cu.user_id.toString()));
                totalStudents = uniqueStudents.size;

                // 5. Real Revenue eka calculate karanna (Payments table eken)
                const payments = await prisma.payments.findMany({
                    where: { 
                        course_id: { in: courseIds },
                        status: 1 // Successful payments witarak ganna
                    }
                });
                totalRevenue = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

                // 6. Chart ekata ona karana revenue data eka batch eken batch ekata hadanna
                for (let batch of batches) {
                    const bGroups = groups.filter(g => g.batch_id === batch.id).map(g => g.id);
                    const bCourses = courses.filter(c => bGroups.includes(c.group_id)).map(c => c.id);
                    const bPayments = payments.filter(p => bCourses.includes(p.course_id));
                    const bRevenue = bPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

                    revenueData.push({
                        name: batch.name,
                        revenue: bRevenue
                    });
                }
            } else {
                revenueData = batches.map(b => ({ name: b.name, revenue: 0 }));
            }
        }

        return res.status(200).json({
            hasBusiness: true,
            business: {
                id: business.id.toString(),
                name: business.name,
                logo: business.logo,
                category: business.category,
                streams: business.streams
            },
            stats: {
                totalBatches: totalBatches,
                totalStudents: totalStudents,
                totalRevenue: totalRevenue 
            },
            revenueData: revenueData.length > 0 ? revenueData : [{ name: "No Batches", revenue: 0 }]
        });

    } catch (error) {
        console.error("Manager Overview Fetch Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

const getCoordinatorOverview = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const user = await prisma.users.findUnique({ where: { id: parseInt(userId) } });
        if (!user || !user.batch_id) return res.status(404).json({ message: "No batch assigned" });

        const batch = await prisma.batches.findUnique({ where: { id: user.batch_id } });
        const business = batch ? await prisma.businesses.findUnique({ where: { id: batch.business_id } }) : null;

        const groups = await prisma.groups.findMany({ where: { batch_id: user.batch_id } });

        const today = new Date().toISOString().split('T')[0];
        const todayClasses = await prisma.class_schedules.findMany({
            where: { batch_id: user.batch_id, date: new Date(today) }
        });

        const myTasks = await prisma.daily_tasks.findMany({
            where: { staff_id: parseInt(userId), is_completed: false }
        });

        return res.status(200).json(safeJson({
            user,
            business,
            batch,
            groups,
            todayClasses,
            pendingTasksCount: myTasks.length
        }));

    } catch (error) {
        console.error("Coordinator Overview Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

// ==========================================
// 2. ANNOUNCEMENTS, POSTS & NOTIFICATIONS
// ==========================================

const sendFCMNotification = async (title, body, imageUrl, batch_id) => {
    try {
        const keyPath = path.join(__dirname, '../../../public/firebase_credentials.json');
        
        if (!fs.existsSync(keyPath)) {
            console.error("Firebase Credentials file not found at: ", keyPath);
            return;
        }

        const auth = new GoogleAuth({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
        });

        const client = await auth.getClient();
        const accessToken = await client.getAccessToken();

        const projectId = 'ima-campus'; 

        const payload = {
            message: {
                topic: 'ima_updates',
                notification: {
                    title: title,
                    body: body,
                },
                android: {
                    notification: {
                        image: imageUrl,
                        channel_id: 'default'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1,
                            'mutable-content': 1
                        }
                    },
                    fcm_options: {
                        image: imageUrl
                    }
                },
                data: {
                    screen: 'Home',
                    click_action: 'FLUTTER_NOTIFICATION_CLICK',
                    image_url: imageUrl || '',
                    batch_id: batch_id ? batch_id.toString() : 'all'
                }
            }
        };

        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) {
            console.error("FCM Send Error: ", data);
        } else {
            console.log("FCM Notification Sent Successfully", data);
        }
    } catch (error) {
        console.error("FCM Exception: ", error);
    }
};

const addAnnouncement = async (req, res) => {
    try {
        const { heading, message, batch, business } = req.body;
        const userId = req.user.id;

        const announcement = await prisma.announcements.create({
            data: {
                heading,
                message,
                batch_id: batch ? BigInt(batch) : null,
                business_id: business ? BigInt(business) : null,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Add Announcement',
                description: 'Announcement Added ' + heading,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Successfully Added!', announcement: safeJson(announcement) });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const updateAnnouncement = async (req, res) => {
    try {
        const { editAnnId, editHeading, editMessage, batch, business } = req.body;
        const userId = req.user.id;

        const announcement = await prisma.announcements.update({
            where: { id: BigInt(editAnnId) },
            data: {
                heading: editHeading,
                message: editMessage,
                batch_id: batch ? BigInt(batch) : null,
                business_id: business ? BigInt(business) : null,
                updated_at: new Date()
            }
        });

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Edit Announcement',
                description: 'Announcement Edited ' + editHeading,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Successfully Updated!', announcement: safeJson(announcement) });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const deleteAnnouncement = async (req, res) => {
    try {
        const { announcementId } = req.body;
        const userId = req.user.id;

        const announcement = await prisma.announcements.findUnique({ where: { id: BigInt(announcementId) } });

        if (!announcement) {
             return res.status(404).json({ message: "Announcement not found" });
        }

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Delete Announcement',
                description: 'Announcement Deleted ' + announcement.heading,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        await prisma.announcements.delete({ where: { id: BigInt(announcementId) } });

        return res.status(200).json({ message: 'Successfully Deleted!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const addPost = async (req, res) => {
    try {
        const { title, caption, batch, business } = req.body;
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ message: "Banner image is required" });
        }
        
        const imageName = req.file.filename;

        const post = await prisma.posts.create({
            data: {
                title,
                caption,
                image: imageName,
                batch_id: batch ? BigInt(batch) : null,
                business_id: business ? BigInt(business) : null,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Add Post',
                description: 'Post Added ' + caption,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        if (req.body.sendToMobile) {
            const imageUrl = imageName ? `https://test.imacampus.lk/posts/${imageName}` : null; 
            await sendFCMNotification(post.title, post.caption, imageUrl, post.batch_id);
        }

        return res.status(200).json({ message: 'Successfully Added!', post: safeJson(post) });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 3. BUSINESS MANAGEMENT
// ==========================================

const getBusinesses = async (req, res) => {
    try {
        const user = req.user;
        let businesses;

        // 🔥 FIX: මෙතන "System Admin", "Director" ඔක්කොම අල්ලගන්න හැදුවා 🔥
        if (user.role === "System Admin" || user.role === "Director" || user.role === "superadmin") {
            businesses = await prisma.businesses.findMany({
                orderBy: { id: 'desc' } // අලුත්ම ඒවා උඩින් පෙන්නන්න
            });
            
        } else if (user.role === "teacher") {
            const courseUsers = await prisma.course_user.findMany({ where: { user_id: BigInt(user.id) } });
            const courseIds = courseUsers.map(cu => cu.course_id);
            const courses = await prisma.courses.findMany({ where: { id: { in: courseIds } } });
            const groupIds = [...new Set(courses.map(c => c.group_id))];
            const groups = await prisma.groups.findMany({ where: { id: { in: groupIds } } });
            const batchIds = [...new Set(groups.map(g => g.batch_id))];
            const batches = await prisma.batches.findMany({ where: { id: { in: batchIds } } });
            const businessIds = [...new Set(batches.map(b => b.business_id))];
            
            businesses = await prisma.businesses.findMany({ 
                where: { id: { in: businessIds } },
                orderBy: { id: 'desc' }
            });
            
        } else {
            // Managers ලට
            businesses = await prisma.businesses.findMany({
                where: {
                    OR: [
                        { head_manager_id: parseInt(user.id) },
                        { ass_manager_id: parseInt(user.id) }
                    ]
                },
                orderBy: { id: 'desc' }
            });
        }

        return res.status(200).json(safeJson({ businesses }));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const addBusiness = async (req, res) => {
    try {
        // Frontend එකෙන් එන විදිහට අලුත් fields ටික (category, medium)
        const { name, description, category, businessType, medium, streams } = req.body;
        const userId = req.user.id;

        let imageName = '';
        if (req.file) {
            imageName = req.file.filename;
        }

        const finalCategory = category || businessType || 'Advance Level';
        const isEnglish = medium === 'English';

        const business = await prisma.businesses.create({
            data: {
                name,
                description: description || "",
                category: finalCategory,
                streams: (finalCategory === 'Advance Level' || finalCategory === 'AL') ? streams : null,
                isEnglish: isEnglish,
                logo: imageName,
                status: 1,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Add Business',
                description: 'New Business Added ' + name,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Successfully Added!', business: safeJson(business) });
    } catch (error) {
        console.error("Add Business Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

const editBusiness = async (req, res) => {
    try {
        const { businessId, name, description, category, businessType, medium, streams } = req.body;
        const userId = req.user.id;

        const finalCategory = category || businessType || 'Advance Level';
        const isEnglish = medium === 'English';

        const businessData = {
            name,
            description: description || "",
            category: finalCategory,
            streams: (finalCategory === 'Advance Level' || finalCategory === 'AL') ? streams : null,
            isEnglish: isEnglish,
            updated_at: new Date()
        };

        if (req.file) {
            businessData.logo = req.file.filename;
            const oldBusiness = await prisma.businesses.findUnique({ where: { id: BigInt(businessId) } });
            if (oldBusiness && oldBusiness.logo) {
                const oldImagePath = path.join(__dirname, '../public/icons/', oldBusiness.logo);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
        }

        const business = await prisma.businesses.update({
            where: { id: BigInt(businessId) },
            data: businessData
        });

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Edit Business',
                description: 'Business Edited ' + name,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Successfully Updated!', business: safeJson(business) });
    } catch (error) {
        console.error("Edit Business Error:", error);
        return res.status(500).json({ message: error.message });
    }
};


const changeBusinessStatus = async (req, res) => {
    try {
        const { business_id, status } = req.body; 
        const userId = req.user.id;

        const business = await prisma.businesses.update({
            where: { id: BigInt(business_id) },
            data: { status: parseInt(status) }
        });

        const actionText = status == 1 ? 'Activated Business' : 'Deactivate Business';
        
        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: actionText,
                description: `Business ${status == 1 ? 'Activated' : 'Deactivated'} ` + business.name,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: `Successfully ${status == 1 ? 'Enabled' : 'Disabled'}!` });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 4. BATCHES MANAGEMENT
// ==========================================

const getBatches = async (req, res) => {
    try {
        const { businessId } = req.params;
        const batches = await prisma.batches.findMany({
            where: { business_id: BigInt(businessId) },
            orderBy: { itemOrder: 'asc' }
        });

        if (batches.length === 0) return res.status(200).json(safeJson({ batches: [] }));

        const batchIds = batches.map(b => b.id);
        
        // අදාළ Batches වලට තියෙන Groups ඔක්කොම ගන්නවා
        const groups = await prisma.groups.findMany({
            where: { batch_id: { in: batchIds } },
            orderBy: { itemOrder: 'asc' }
        });
        
        const groupIds = groups.map(g => g.id);
        
        // අදාළ Groups වලට තියෙන Courses (Subjects) ඔක්කොම ගන්නවා
        const courses = await prisma.courses.findMany({
            where: { group_id: { in: groupIds } },
            orderBy: { itemOrder: 'asc' }
        });

        // Batches > Groups > Courses විදිහට Tree එක හදනවා
        const formattedBatches = batches.map(batch => {
            const batchGroups = groups.filter(g => g.batch_id.toString() === batch.id.toString()).map(group => {
                const groupCourses = courses.filter(c => c.group_id.toString() === group.id.toString());
                return { ...group, courses: groupCourses };
            });
            return { ...batch, groups: batchGroups };
        });

        return res.status(200).json(safeJson({ batches: formattedBatches }));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 🔥 2. අලුතෙන් එකතු කරන්න: Delete Business 🔥
const deleteBusiness = async (req, res) => {
    try {
        const { business_id } = req.body;
        const userId = req.user.id;

        const business = await prisma.businesses.findUnique({ where: { id: BigInt(business_id) } });

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Delete Business',
                description: 'Business Deleted ' + business?.name,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        await prisma.businesses.delete({ where: { id: BigInt(business_id) } });

        return res.status(200).json({ message: 'Successfully Deleted!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getManagerBatches = async (req, res) => {
    try {
        const userId = req.user.id;
        const business = await prisma.businesses.findFirst({
            where: { OR: [{ head_manager_id: parseInt(userId) }, { ass_manager_id: parseInt(userId) }] }
        });

        if (!business) return res.status(200).json([]);

        const batches = await prisma.batches.findMany({
            where: { business_id: business.id },
            select: { id: true, name: true, status: true }
        });
        
        const formattedBatches = batches.map(b => ({
            id: b.id.toString(), 
            name: b.name, 
            status: b.status
        }));

        return res.status(200).json(formattedBatches);
    } catch (error) {
        console.error("Batches Fetch Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

const getManagerFullBatches = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        let batches = [];

        // 1. Admin, Director කෙනෙක් නම් කිසිම ලොක් එකක් නැතුව සේරම Batches ගන්නවා
        if (['System Admin', 'superadmin', 'Director', 'Admin'].includes(userRole)) {
            batches = await prisma.batches.findMany();
        } else {
            // 2. Manager කෙනෙක් නම් එයාට අදාල Business එකේ Batches විතරක් ගන්නවා
            const managerBusinesses = await prisma.businesses.findMany({
                where: { OR: [{ head_manager_id: parseInt(userId) }, { ass_manager_id: parseInt(userId) }] }
            });

            if (managerBusinesses.length === 0) return res.status(200).json([]);

            const bIds = managerBusinesses.map(b => b.id);
            batches = await prisma.batches.findMany({
                where: { business_id: { in: bIds } }
            });
        }

        if (batches.length === 0) return res.status(200).json([]);

        const batchIds = batches.map(b => b.id);

        const groups = await prisma.groups.findMany({
            where: { batch_id: { in: batchIds } }
        });

        const groupIds = groups.map(g => g.id);

        const courses = await prisma.courses.findMany({
            where: { group_id: { in: groupIds } }
        });

        // 3. Frontend එකේ Filter එකට අහු වෙන්න Business Object එකත් Map කරනවා
        const allBusinesses = await prisma.businesses.findMany();

        const formattedBatches = batches.map(batch => {
            const batchBizId = batch.business_id ? batch.business_id.toString() : null;
            const businessObj = allBusinesses.find(b => b.id.toString() === batchBizId) || null;

            const batchGroups = groups.filter(g => g.batch_id.toString() === batch.id.toString()).map(group => {
                const groupCourses = courses.filter(c => c.group_id.toString() === group.id.toString());
                return { ...group, courses: groupCourses };
            });
            
            // Business object එක batch එක ඇතුලට දානවා
            return { ...batch, business: businessObj, groups: batchGroups };
        });

        return res.status(200).json(safeJson(formattedBatches));
        
    } catch (e) { 
        console.error("Batches Fetch Error:", e);
        return res.status(500).json({ message: "Server Error: " + e.message }); 
    }
};

const addBatch = async (req, res) => {
    try {
        // 'type' එකයි 'batchType' දෙකම handle කරනවා
        const { name, description, business_id, type, batchType, itemOrder, streams } = req.body;
        const userId = req.user.id;

        let imageName = '';
        if (req.file) { 
            imageName = req.file.filename;
        }

        const finalType = type || batchType || "1";

        const batch = await prisma.batches.create({
            data: {
                name,
                description: description || "",
                business_id: BigInt(business_id),
                type: parseInt(finalType),
                itemOrder: itemOrder ? parseInt(itemOrder) : 1,
                logo: imageName,
                streams: streams || null, 
                status: 1,
                canEnroll: 1,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Add Batch',
                description: 'New Batch Added ' + name,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Successfully Added!', batch: safeJson(batch) });
    } catch (error) {
        console.error("Add Batch Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

const updateBatch = async (req, res) => {
    try {
        const { batch_id, name, description, type, batchType, itemOrder, streams } = req.body;
        const finalType = type || batchType || "1";
        
        const data = { 
            name, 
            description: description || "", 
            type: parseInt(finalType), 
            streams: streams || null,
            itemOrder: itemOrder ? parseInt(itemOrder) : 1, 
            updated_at: new Date() 
        };
        
        if (req.file) data.logo = req.file.filename;

        await prisma.batches.update({ where: { id: BigInt(batch_id) }, data });
        return res.status(200).json({ message: 'Batch Updated!' });
    } catch (e) { 
        console.error("Update Batch Error:", e);
        return res.status(500).json({ message: e.message }); 
    }
};

const changeBatchStatus = async (req, res) => {
    try {
        const { batch_id, status } = req.body;
        await prisma.batches.update({ where: { id: BigInt(batch_id) }, data: { status: parseInt(status) } });
        return res.status(200).json({ message: 'Status Updated!' });
    } catch (e) { return res.status(500).json({ message: e.message }); }
};

const deleteBatch = async (req, res) => {
    try {
        const { batch_id } = req.body;
        await prisma.batches.delete({ where: { id: BigInt(batch_id) } });
        return res.status(200).json({ message: 'Batch Deleted!' });
    } catch (e) { return res.status(500).json({ message: e.message }); }
};

// ==========================================
// 5. PAYMENT GROUPS
// ==========================================

const addGroup = async (req, res) => {
    try {
        const { gName, pType, batch_id, itemOrder, discountRules } = req.body;
        const userId = req.user.id;

        const rulesString = discountRules && discountRules.length > 0 ? JSON.stringify(discountRules) : null;

        const group = await prisma.groups.create({
            data: {
                name: gName,
                type: parseInt(pType),
                batch_id: BigInt(batch_id),
                itemOrder: itemOrder ? parseInt(itemOrder) : 1,
                discount_rules: rulesString,
                status: 1,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Add Group',
                description: 'New Group Added ' + gName,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Successfully Added!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const updateGroup = async (req, res) => {
    try {
        const { group_id, gName, pType, itemOrder, discountRules } = req.body;
        const rulesString = discountRules && discountRules.length > 0 ? JSON.stringify(discountRules) : null;

        await prisma.groups.update({
            where: { id: BigInt(group_id) },
            data: {
                name: gName,
                type: parseInt(pType),
                itemOrder: itemOrder ? parseInt(itemOrder) : 1,
                discount_rules: rulesString,
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Successfully Updated!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const deleteGroup = async (req, res) => {
    try {
        const { group_id } = req.body;
        const userId = req.user.id;

        const group = await prisma.groups.findUnique({ where: { id: BigInt(group_id) } });
        if(!group) return res.status(404).json({ message: "Group not found" });

        const courses = await prisma.courses.findMany({ where: { group_id: BigInt(group_id) } });
        const courseIds = courses.map(c => c.id);

        if (courseIds.length > 0) {
            await prisma.payments.deleteMany({ where: { course_id: { in: courseIds } } });
            await prisma.course_user.deleteMany({ where: { course_id: { in: courseIds } } });
            await prisma.content_course.deleteMany({ where: { course_id: { in: courseIds } } });
            await prisma.courses.deleteMany({ where: { group_id: BigInt(group_id) } });
        }

        const options = await prisma.installment_options.findMany({ where: { group_id: BigInt(group_id) } });
        const optionIds = options.map(opt => opt.id);
        
        if (optionIds.length > 0) {
            await prisma.installment_amounts.deleteMany({ where: { installment_option_id: { in: optionIds } } });
            await prisma.installment_options.deleteMany({ where: { group_id: BigInt(group_id) } });
        }

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Delete Group',
                description: 'Group Deleted ' + group.name,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        await prisma.groups.delete({ where: { id: BigInt(group_id) } });

        return res.status(200).json({ message: 'Successfully Deleted!' });
    } catch(error) {
        return res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 6. COURSES (SUBJECTS)
// ==========================================

const addCourse = async (req, res) => {
    try {
        const { name, description, courseType, code, stream, itemOrder, groupPrices } = req.body;
        const userId = req.user.id;

        const prices = JSON.parse(groupPrices);

        if (!prices || prices.length === 0) return res.status(400).json({ message: "No groups selected" });

        const createdCourses = [];

        for (let item of prices) {
            let finalItemOrder = itemOrder ? parseInt(itemOrder) : null;

            if (!finalItemOrder) {
                const lastCourse = await prisma.courses.findFirst({
                    where: { group_id: BigInt(item.groupId) },
                    orderBy: { itemOrder: 'desc' }
                });
                finalItemOrder = lastCourse && lastCourse.itemOrder ? (lastCourse.itemOrder + 1) : 1;
            }

            const course = await prisma.courses.create({
                data: {
                    group_id: BigInt(item.groupId),
                    name,
                    description,
                    type: parseInt(courseType) || 1, // Fallback
                    code,
                    stream: stream || null,
                    itemOrder: finalItemOrder,
                    price: parseFloat(item.price || 0),
                    status: 1,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });
            createdCourses.push(course);
        }

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Add Course',
                description: 'Subject Added to Groups: ' + name,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Successfully Added to Groups!', courses: safeJson(createdCourses) });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const updateCourse = async (req, res) => {
    try {
        const { course_id, name, description, courseType, code, theoryCourse, stream, reqDiscount, itemOrder, price, discountPrice } = req.body;
        
        await prisma.courses.update({
            where: { id: BigInt(course_id) },
            data: {
                name,
                description,
                type: parseInt(courseType) || 1,
                code,
                stream: stream || null,
                itemOrder: itemOrder ? parseInt(itemOrder) : undefined,
                price: parseFloat(price || 0),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Successfully Updated!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const changeCourseStatus = async (req, res) => {
    try {
        const { course_id, status } = req.body;
        const userId = req.user.id;

        const course = await prisma.courses.update({
            where: { id: BigInt(course_id) },
            data: { status: parseInt(status) }
        });

        const actionText = status == 1 ? 'Activate Course' : 'Deactivate Course';

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: actionText,
                description: `Course ${status == 1 ? 'Activated' : 'Deactivated'} ` + course.name,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: `Successfully ${status == 1 ? 'Enabled' : 'Disabled'}!` });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const deleteCourse = async (req, res) => {
    try {
        const { course_id } = req.body;
        const userId = req.user.id;

        const course = await prisma.courses.findUnique({ where: { id: BigInt(course_id) } });

        await prisma.course_user.deleteMany({ where: { course_id: BigInt(course_id) } });
        await prisma.content_course.deleteMany({ where: { course_id: BigInt(course_id) } });

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Delete Course',
                description: 'Course Deleted ' + course.name,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        await prisma.courses.delete({ where: { id: BigInt(course_id) } });

        return res.status(200).json({ message: 'Successfully Deleted!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// ==========================================
// 7. CONTENT GROUPS (LESSONS FOLDERS)
// ==========================================

const addContentGroup = async (req, res) => {
    try {
        console.log("📥 Backend එකට ආපු Data:", req.body); // <-- මේක Terminal/CMD එකේ බලන්න
        
        const { title, batch_id, course_code, order, type } = req.body;
        
        await prisma.content_groups.create({
            data: {
                title: title,
                batch_id: BigInt(batch_id),
                course_code: course_code,
                type: type ? parseInt(type) : 1, // Type එක අනිවාර්යයි
                itemOrder: order ? parseInt(order) : 1,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Lesson Group Created!' });
    } catch (error) {
        console.error("❌ Backend Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

const updateContentGroup = async (req, res) => {
    try {
        const { contentGroupId, title, order } = req.body;
        const userId = req.user.id;

        const contentGroup = await prisma.content_groups.update({
            where: { id: BigInt(contentGroupId) },
            data: {
                title,
                itemOrder: parseInt(order),
                updated_at: new Date()
            }
        });

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Edit Content Group',
                description: 'Content Group Edited ' + title,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Successfully Updated!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const deleteContentGroup = async (req, res) => {
    try {
        const { contentGroupId } = req.body;
        const userId = req.user.id;

        const contentGroup = await prisma.content_groups.findUnique({ where: { id: BigInt(contentGroupId) } });

        await prisma.contents.updateMany({
            where: { content_group_id: parseInt(contentGroupId) },
            data: { content_group_id: null }
        });

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Delete Content Group',
                description: 'Content Group Deleted ' + contentGroup.title,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        await prisma.content_groups.delete({ where: { id: BigInt(contentGroupId) } });

        return res.status(200).json({ message: 'Successfully Deleted!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getCourseContents = async (req, res) => {
    try {
        // courseId එකත් අරගන්නවා Content හොයන්න
        const { batchId, courseCode, courseId } = req.query; 
        
        // 1. Folders ටික ගන්නවා
        const lessonGroups = await prisma.content_groups.findMany({
            where: { batch_id: BigInt(batchId), course_code: courseCode },
            orderBy: { itemOrder: 'asc' }
        });

        // 2. අදාල Subject එකට assign කරලා තියෙන Content ටික හොයනවා
        const mappedContents = await prisma.content_course.findMany({
            where: { course_id: BigInt(courseId) }
        });

        const contentIds = mappedContents.map(mc => mc.content_id);

        let contents = [];
        if (contentIds.length > 0) {
            // අදාළ Content වල විස්තර (Title, link, type) Database එකෙන් ගන්නවා
            contents = await prisma.contents.findMany({
                where: { id: { in: contentIds } },
                orderBy: { id: 'desc' } // අලුත්ම ඒවා උඩින් පෙන්වන්න
            });
        }

        // 3. Folders සහ Contents දෙකම React එකට යවනවා
        return res.status(200).json(safeJson({ 
            lessonGroups, 
            contents       // <--- මේක තමයි කලින් මඟහැරිලා තිබුණේ!
        }));
    } catch (e) {
        console.error("Fetch Contents Error:", e);
        return res.status(500).json({ message: "Server Error" });
    }
};
// ==========================================
// 8. CONTENTS (Classes, Recordings, Docs)
// ==========================================

const addClass = async (req, res) => {
    try {
        const { title, date, startTime, endTime, link, isFree, selectedCourses } = req.body;
        const userId = req.user.id;

        const content = await prisma.contents.create({
            data: {
                title,
                date: date ? new Date(date) : null,
                startTime,
                endTime,
                link,
                type: 1, 
                isFree: isFree ? true : false,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        if (selectedCourses && Array.isArray(selectedCourses)) {
            for (let courseId of selectedCourses) {
                const order = await prisma.content_course.findFirst({
                    where: { course_id: BigInt(courseId), type: 1 },
                    orderBy: { itemOrder: 'desc' }
                });
                
                const itemOrder = order ? (parseInt(order.itemOrder) + 1).toString() : "1";

                await prisma.content_course.create({
                    data: {
                        content_id: content.id,
                        course_id: BigInt(courseId),
                        type: 1,
                        itemOrder: itemOrder,
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                });
            }
        }

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Add Class',
                description: 'Class Added ' + title,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Class Added Successfully!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const addRecording = async (req, res) => {
    try {
        const { title, link, zoomMeetingId, date, isFree, selectedCourses } = req.body;
        const userId = req.user.id;

        const content = await prisma.contents.create({
            data: {
                title,
                date: date ? new Date(date) : null,
                link,
                zoomMeetingId,
                type: 2, 
                isFree: isFree ? true : false,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        if (selectedCourses && Array.isArray(selectedCourses)) {
            for (let courseId of selectedCourses) {
                const order = await prisma.content_course.findFirst({
                    where: { course_id: BigInt(courseId), type: 2 },
                    orderBy: { itemOrder: 'desc' }
                });
                
                const itemOrder = order ? (parseInt(order.itemOrder) + 1).toString() : "1";

                await prisma.content_course.create({
                    data: {
                        content_id: content.id,
                        course_id: BigInt(courseId),
                        type: 2,
                        itemOrder: itemOrder,
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                });
            }
        }

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Add Recording',
                description: 'Recording Added ' + title,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Recording Added Successfully!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const addDocument = async (req, res) => {
    try {
        const { title, classMonth, isFree, selectedCourses } = req.body;
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ message: "Document file is required" });
        }

        const fileName = req.file.filename;

        let formattedDate = null;
        if (classMonth) {
            const d = new Date(classMonth);
            formattedDate = new Date(d.getFullYear(), d.getMonth(), 1);
        }

        const content = await prisma.contents.create({
            data: {
                title,
                fileName,
                type: 3,
                isFree: isFree ? true : false,
                date: formattedDate,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        if (selectedCourses && Array.isArray(selectedCourses)) {
            for (let courseId of selectedCourses) {
                const order = await prisma.content_course.findFirst({
                    where: { course_id: BigInt(courseId), type: 3 },
                    orderBy: { itemOrder: 'desc' }
                });
                
                const itemOrder = order ? (parseInt(order.itemOrder) + 1).toString() : "1";

                await prisma.content_course.create({
                    data: {
                        content_id: content.id,
                        course_id: BigInt(courseId),
                        type: 3,
                        itemOrder: itemOrder,
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                });
            }
        }

        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Add Document',
                description: 'Document Added ' + title,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        return res.status(200).json({ message: 'Document Added Successfully!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const addContentMassAssign = async (req, res) => {
    try {
        const { type, title, link, date, startTime, endTime, isFree, selectedCourses, contentGroupId } = req.body;

        let typeInt = 1;
        if (type === 'recording') typeInt = 2;
        else if (type === 'document') typeInt = 3;
        else if (type === 'sPaper') typeInt = 4;
        else if (type === 'paper') typeInt = 5;

        const fileName = req.file ? req.file.filename : null;

        const content = await prisma.contents.create({
            data: {
                title, 
                link: link || null, 
                fileName: fileName,
                type: typeInt, 
                date: date ? new Date(date) : null,
                startTime: startTime || null, 
                endTime: endTime || null, 
                isFree: Boolean(isFree),
                content_group_id: contentGroupId ? parseInt(contentGroupId) : null,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        const coursesArray = typeof selectedCourses === 'string' ? JSON.parse(selectedCourses) : selectedCourses;

        if (coursesArray && coursesArray.length > 0) {
            for (let courseId of coursesArray) {
                const order = await prisma.content_course.findFirst({
                    where: { course_id: BigInt(courseId), type: typeInt },
                    orderBy: { itemOrder: 'desc' }
                });
                
                const itemOrder = order && order.itemOrder ? (parseInt(order.itemOrder) + 1).toString() : "1";

                await prisma.content_course.create({
                    data: {
                        content_id: content.id,
                        course_id: BigInt(courseId),
                        type: typeInt,
                        itemOrder: itemOrder,
                        created_at: new Date(),
                        updated_at: new Date()
                    }
                });
            }
        }

        return res.status(200).json({ message: "Content Successfully Published!" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server Error" });
    }
};

const deleteContent = async (req, res) => {
    try {
        const { content_id } = req.body;
        const userId = req.user.id;

        const content = await prisma.contents.findUnique({ where: { id: BigInt(content_id) } });
        if(!content) return res.status(404).json({ message: "Content not found" });

        if ((content.type === 3 || content.type === 4 || content.type === 5) && content.fileName) {
            path.join(__dirname, '../../../public/documents/', content.fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await prisma.content_course.deleteMany({ where: { content_id: BigInt(content_id) } });
        
        await prisma.audit_trails.create({
            data: {
                user_id: BigInt(userId),
                action: 'Delete Content',
                description: 'Content Deleted ' + content.title,
                created_at: new Date(),
                updated_at: new Date()
            }
        });

        await prisma.contents.delete({ where: { id: BigInt(content_id) } });

        return res.status(200).json({ message: 'Successfully Deleted!' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getBatchSchedule = async (req, res) => {
    try {
        const { batchId, year, month } = req.query;
        
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const dummySchedules = [
            { id: 1, title: "Theory Live Class", date: `${year}-${String(month).padStart(2, '0')}-10`, startTime: "18:00", endTime: "20:00", type: "Live" },
            { id: 2, title: "Monthly Past Paper", date: `${year}-${String(month).padStart(2, '0')}-15`, startTime: "14:00", endTime: "17:00", type: "Exam" },
            { id: 3, title: "Revision Session", date: `${year}-${String(month).padStart(2, '0')}-28`, startTime: "19:00", endTime: "21:00", type: "Live" }
        ];

        return res.status(200).json(dummySchedules);
    } catch (error) {
        return res.status(500).json({ message: "Server Error" });
    }
};

// ==========================================
// 9. CRM SETTINGS & KNOWLEDGE BASE
// ==========================================

const getBusinessCrm = async (req, res) => {
    try {
        const { businessId } = req.params;
        const campaigns = await prisma.crm_campaigns.findMany({ where: { business_id: BigInt(businessId) } });
        return res.status(200).json(safeJson(campaigns));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const saveBusinessCrm = async (req, res) => {
    try {
        const { businessId, freeSeminarData, afterSeminarData } = req.body;

        const phases = [
            { phase: "FREE_SEMINAR", data: freeSeminarData },
            { phase: "AFTER_SEMINAR", data: afterSeminarData }
        ];

        for (const item of phases) {
            const existing = await prisma.crm_campaigns.findFirst({
                where: { business_id: BigInt(businessId), phase: item.phase }
            });

            const payload = {
                business_id: BigInt(businessId),
                phase: item.phase,
                meta_phone_id: item.data.meta_phone_id,
                meta_wa_id: item.data.meta_wa_id,
                meta_access_token: item.data.meta_access_token,
                gemini_keys: item.data.gemini_keys,
                is_gemini_active: item.data.is_gemini_active,
                is_auto_reply_active: item.data.is_auto_reply_active
            };

            let campaignId;

            if (existing) {
                await prisma.crm_campaigns.update({ where: { id: existing.id }, data: payload });
                campaignId = existing.id;
                await prisma.auto_replies.deleteMany({ where: { campaign_id: campaignId } });
            } else {
                const newCamp = await prisma.crm_campaigns.create({ data: payload });
                campaignId = newCamp.id;
            }

            if (item.data.auto_replies && item.data.auto_replies.length > 0) {
                const repliesToInsert = item.data.auto_replies.map(r => ({
                    campaign_id: campaignId,
                    sequence_order: parseInt(r.sequence_order),
                    message_text: r.message_text || "",
                    media_url: r.media_url || null,
                    media_type: r.media_type || "text"
                }));
                await prisma.auto_replies.createMany({ data: repliesToInsert });
            }
        }

        return res.status(200).json({ message: "CRM Settings Saved Successfully!" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};


// ==========================================
// 10. KNOWLEDGE BASE & CRM MEDIA (Missing Functions)
// ==========================================

const uploadCrmMedia = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });
        return res.status(200).json({ file_name: req.file.filename });
    } catch (e) { return res.status(500).json({ message: e.message }); }
};

const getKnowledgeBase = async (req, res) => {
    try {
        const { businessId, phase } = req.query;
        const docs = await prisma.crm_documents.findMany({ 
            where: { business_id: BigInt(businessId), phase: phase }, 
            orderBy: { id: 'desc' } 
        });
        return res.status(200).json(safeJson(docs));
    } catch(e) { return res.status(500).json({message: e.message}); }
};

const addKnowledgeBase = async (req, res) => {
    try {
        const { businessId, phase, textContent, originalName } = req.body;
        const doc = await prisma.crm_documents.create({
            data: { 
                business_id: BigInt(businessId), 
                phase: phase, 
                file_name: req.file ? req.file.filename : originalName, 
                content: textContent || "Extracted Content Data...", 
                created_at: new Date() 
            }
        });
        return res.status(200).json({ message: "Ingestion Successful", doc: safeJson(doc) });
    } catch(e) { return res.status(500).json({message: e.message}); }
};

const deleteKnowledgeBase = async (req, res) => {
    try {
        const { docId } = req.params;
        await prisma.crm_documents.delete({ where: { id: parseInt(docId) } });
        return res.status(200).json({ message: "Deleted successfully" });
    } catch(e) { return res.status(500).json({message: e.message}); }
};

const getAllBusinessesForAdmin = async (req, res) => {
    try {
        const businesses = await prisma.businesses.findMany({
            orderBy: { created_at: 'desc' }
        });
        
        // BigInt error එක හදන්න
        const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));
        
        res.status(200).json({ data: safeJson(businesses) });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server Error" });
    }
};

// --- 🔥 NEW: Get Staff Progress & Campaign Stats 🔥 ---
const getStaffProgress = async (req, res) => {
    try {
        const { phase, time, startDate, endDate } = req.query;

        // 1. Date Filtering Logic
        let dateCondition = {};
        if (time === 'today') {
            const start = new Date(); start.setHours(0, 0, 0, 0);
            const end = new Date(); end.setHours(23, 59, 59, 999);
            dateCondition = { created_at: { gte: start, lte: end } };
        } else if (time === 'custom' && startDate && endDate) {
            dateCondition = { created_at: { gte: new Date(startDate), lte: new Date(`${endDate}T23:59:59`) } };
        }

        // 2. Phase Filtering Logic 
        let phaseCondition = {};
        if (phase && phase !== 'All') {
            phaseCondition = { status: `PHASE_${phase}` }; // schema.prisma eke hetiyata status eka 'PHASE_1' wage enne
        }

        // 3. GET SUMMARY DATA (Fixed Table Names to match schema.prisma)
        const totalMessages = await prisma.chat_logs.count({ where: dateCondition }); 
        const totalLeads = await prisma.leads.count({ where: { ...dateCondition, ...phaseCondition } }); 
        const activeStaff = await prisma.users.count({ where: { role: { in: ['Staff', 'Coordinator'] }, status: 1 } }); 

        // 4. GET STAFF CALL PROGRESS
        const staffMembers = await prisma.users.findMany({
            where: { role: { in: ['Staff', 'Coordinator'] } },
            select: { id: true, fName: true, lName: true }
        });

        let agentStats = [];
        let overallPending = 0;

        for (let staff of staffMembers) {
            const staffIdInt = Number(staff.id); // BigInt eka Int ekata convert karanawa relation eka nisa

            const assignedLeads = await prisma.leads.count({
                where: { assigned_to: staffIdInt, ...phaseCondition, ...dateCondition }
            });

            if (assignedLeads === 0) continue;

            const answered = await prisma.leads.count({
                where: { assigned_to: staffIdInt, cStatus: { in: ['Answer', 'ANSWERED', 'Answered'] }, ...phaseCondition, ...dateCondition }
            });
            
            const noAnswer = await prisma.leads.count({
                where: { assigned_to: staffIdInt, cStatus: { in: ['No Answer', 'NO_ANSWER', 'No answer'] }, ...phaseCondition, ...dateCondition }
            });
            
            const reject = await prisma.leads.count({
                where: { assigned_to: staffIdInt, cStatus: { in: ['Reject', 'REJECTED', 'Rejected'] }, ...phaseCondition, ...dateCondition }
            });

            const totalCovered = answered + noAnswer + reject;
            const toCover = assignedLeads > totalCovered ? (assignedLeads - totalCovered) : 0;
            
            overallPending += toCover;

            agentStats.push({
                agentName: `${staff.fName} ${staff.lName}`,
                totalAllocated: assignedLeads,
                answered: answered,
                noAnswer: noAnswer,
                reject: reject,
                toCover: toCover
            });
        }

        return res.status(200).json({
            summary: { totalMessages, totalLeads, activeStaff, totalPending: overallPending },
            agents: agentStats
        });

    } catch (error) {
        console.error("Fetch Staff Progress Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};


// ==========================================
// EXPORTS
// ==========================================

module.exports = {
    index, getManagerOverview, getCoordinatorOverview,
    sendFCMNotification, addAnnouncement, updateAnnouncement, deleteAnnouncement, addPost,
    getBusinesses, addBusiness, editBusiness, changeBusinessStatus,
    getBatches, getManagerBatches, getManagerFullBatches, addBatch, updateBatch, changeBatchStatus, deleteBatch,
    addGroup, updateGroup, deleteGroup,
    addCourse, updateCourse, changeCourseStatus, deleteCourse,
    addContentGroup, updateContentGroup, deleteContentGroup, getCourseContents,
    addClass, addRecording, addDocument, addContentMassAssign, deleteContent, getBatchSchedule,
    getBusinessCrm, saveBusinessCrm, uploadCrmMedia, getKnowledgeBase, addKnowledgeBase, deleteKnowledgeBase, getAllBusinessesForAdmin,
    getBatches, deleteBusiness, getStaffProgress
};