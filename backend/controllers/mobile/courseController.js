const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// BigInt සේෆ් විදියට JSON කරන්න
const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// 1. My Classroom එකේ Data ගන්න (Enrolled Courses) - (මේක ඔයාගේ පරණ කෝඩ් එකමයි)
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

// 2. Course එකක් ඇතුළට ගියාම Videos / PDFs ගන්න (View Module - 100% Fixed for Mobile Sync)
const viewModule = async (req, res) => {
    try {
        const user = req.user;
        const { courseId } = req.params;

        if (!courseId || courseId === 'undefined') {
            return res.status(400).json({ message: "Invalid Course ID provided." });
        }

        const course = await prisma.courses.findUnique({ where: { id: BigInt(courseId) } });
        let courseDetails = course ? { ...course } : null;

        if (courseDetails && courseDetails.group_id) {
            courseDetails.group = await prisma.groups.findUnique({ where: { id: courseDetails.group_id } });
            if (courseDetails.group && courseDetails.group.batch_id) {
                courseDetails.group.batch = await prisma.batches.findUnique({ where: { id: courseDetails.group.batch_id } });
                if (courseDetails.group.batch && courseDetails.group.batch.business_id) {
                    courseDetails.group.batch.business = await prisma.businesses.findUnique({ where: { id: courseDetails.group.batch.business_id } });
                }
            }
        }

        // Course එකට අදාල Contents හොයනවා
        const contentCourseLinks = await prisma.content_course.findMany({
            where: { course_id: BigInt(courseId) }
        });
        const contentIds = [...new Set(contentCourseLinks.map(link => link.content_id))];

        const getContents = async (type) => {
            if (contentIds.length === 0) return [];
            return await prisma.contents.findMany({
                where: { type: type, id: { in: contentIds } },
                orderBy: { date: 'asc' }
            });
        };
        
        const liveClasses = await getContents(1);
        const recordings = await getContents(2);
        const documents = await getContents(3);
        const papers = await getContents(4);
        const sPapers = await getContents(5);

        const allContents = [...liveClasses, ...recordings, ...documents, ...papers, ...sPapers];
        const usedFolderIds = [...new Set(allContents.map(c => c.content_group_id).filter(id => id != null))];

        let safeCode = courseDetails?.code || `SUB_${courseDetails?.id}`;
        let batchId = courseDetails?.group?.batch_id || BigInt(0);

        // Folders ටික අදිනවා
        const lessonGroups = await prisma.content_groups.findMany({
            where: {
                OR: [
                    { batch_id: batchId, course_code: safeCode },
                    { id: { in: usedFolderIds.map(id => BigInt(id)) } }
                ]
            },
            orderBy: { itemOrder: 'asc' }
        });

        // Paid Status Check කිරීම
        let paidStatus = 0;
        const payment = await prisma.payments.findFirst({ 
            where: { course_id: BigInt(courseId), student_id: BigInt(user.id), status: { notIn: [-2, -3] } }, 
            orderBy: { id: 'desc' } 
        });
        
        if (payment) {
            paidStatus = payment.status;

            const hasGracePeriod = payment.post_pay_date && new Date(payment.post_pay_date) >= new Date();
            if (hasGracePeriod) paidStatus = 1;

            if ((payment.isInstallment === 1 || payment.isInstallment === true) && paidStatus === 1) {
                let mainPaymentId = payment.id;
                if (payment.isLinked && payment.linked) mainPaymentId = BigInt(payment.linked);
                
                const overdueInstallment = await prisma.installments.findFirst({
                    where: { payment_id: mainPaymentId, status: 0 } 
                });

                if (overdueInstallment && overdueInstallment.due_date) {
                    const dueDate = new Date(overdueInstallment.due_date);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    
                    if (dueDate < today && !hasGracePeriod) {
                        paidStatus = 0; 
                    }
                }
            }
        }

        return res.status(200).json(safeJson({ 
            liveClasses, recordings, documents, papers, sPapers, lessonGroups,
            paidStatus, course: courseDetails 
        }));

    } catch (error) {
        console.error("Mobile View Module Error:", error);
        return res.status(500).json({ message: "Content Sync Error: " + error.message });
    }
};

module.exports = { getClassRoom, viewModule };