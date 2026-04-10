const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. My Classroom එකේ Data ගන්න (Enrolled Courses)
const getClassRoom = async (req, res) => {
    try {
        const userId = req.user.id; // Token එකෙන් එන ID එක

        // ළමයා Enrol වෙලා ඉන්න Courses ටික ගන්නවා
        const courseUsers = await prisma.course_user.findMany({
            where: { user_id: userId },
            include: {
                course: {
                    include: {
                        group: {
                            include: {
                                batch: { include: { business: true } }
                            }
                        }
                    }
                }
            }
        });

        // App එක බලාපොරොත්තු වෙන Hierarchy එක හදනවා (Businesses -> Batches -> Groups -> Courses)
        let businessesMap = {};

        courseUsers.forEach(cu => {
            const course = cu.course;
            if (!course || !course.group || !course.group.batch || !course.group.batch.business) return;

            const biz = course.group.batch.business;
            const batch = course.group.batch;
            const group = course.group;

            if (!businessesMap[biz.id]) {
                businessesMap[biz.id] = { id: biz.id, name: biz.name, logo: biz.logo, category: biz.category, batches: [] };
            }

            let bBatch = businessesMap[biz.id].batches.find(b => b.id === batch.id);
            if (!bBatch) {
                bBatch = { id: batch.id, name: batch.name, logo: batch.logo, groups: [] };
                businessesMap[biz.id].batches.push(bBatch);
            }

            let bGroup = bBatch.groups.find(g => g.id === group.id);
            if (!bGroup) {
                bGroup = { id: group.id, name: group.name, courses: [] };
                bBatch.groups.push(bGroup);
            }

            bGroup.courses.push({
                id: course.id,
                name: course.name,
                description: course.description
            });
        });

        res.status(200).json({ businesses: Object.values(businessesMap) });

    } catch (error) {
        console.error("Classroom Error:", error);
        res.status(500).json({ message: "Failed to load classroom" });
    }
};

// 2. Course එකක් ඇතුළට ගියාම Videos / PDFs ගන්න (View Module)
const viewModule = async (req, res) => {
    try {
        const { courseId } = req.params;

        // මේවා Database එකෙන් අදාල Course එකට අදාලව ගන්න ඕනේ (දැනට Dummy Structure එකක් දාලා තියෙනවා ඔයාට DB Queries ගහගන්න ලේසි වෙන්න)
        const liveClasses = await prisma.live_classes.findMany({ where: { course_id: Number(courseId) } }) || [];
        const recordings = await prisma.recordings.findMany({ where: { course_id: Number(courseId) } }) || [];
        const documents = await prisma.documents.findMany({ where: { course_id: Number(courseId) } }) || [];
        const contentGroups = await prisma.content_groups.findMany({ where: { course_id: Number(courseId) } }) || [];

        // Paid Status Check (පෙන්නනවද නැද්ද කියලා)
        const paidStatus = 1; // 1 = Paid, 0 = Blocked, -1 = Pending

        res.status(200).json({
            paidStatus,
            liveClasses,
            recordings,
            documents,
            papers: [],
            sPapers: [],
            contentGroups
        });
    } catch (error) {
        console.error("View Module Error:", error);
        res.status(500).json({ message: "Failed to load course content" });
    }
};

module.exports = { getClassRoom, viewModule };