const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// BigInt සේෆ් විදියට JSON කරන්න
const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

const getHomeData = async (req, res) => {
    try {
        const userId = req.user.id; 
        
        // 1. ළමයාගේ Courses ටික අදිනවා
        const enrolledCourses = await prisma.course_user.findMany({ where: { user_id: BigInt(userId) } });
        const courseIds = enrolledCourses.map(e => e.course_id);

        const courses = await prisma.courses.findMany({ where: { id: { in: courseIds } } });
        const groupIds = [...new Set(courses.map(c => c.group_id).filter(id => id != null))];
        const groups = await prisma.groups.findMany({ where: { id: { in: groupIds } } });
        const batchIds = [...new Set(groups.map(g => g.batch_id).filter(id => id != null))];
        const batches = await prisma.batches.findMany({ where: { id: { in: batchIds } } });
        const businessIds = [...new Set(batches.map(b => b.business_id).filter(id => id != null))];

        // 2. 🔥 POSTS අදින කෑල්ල (මේකෙන් තමයි Home Screen එකට Posts යන්නේ) 🔥
        const posts = await prisma.posts.findMany({
            where: { 
                OR: [
                    { business_id: null, batch_id: null }, 
                    { business_id: { in: businessIds } }, 
                    { batch_id: { in: batchIds } }
                ] 
            },
            orderBy: { created_at: 'desc' }, 
            take: 15
        });

        // 3. Alerts අදින කෑල්ල
        let alerts = [];
        const userInstallmentPayments = await prisma.payments.findMany({
            where: { student_id: BigInt(userId), isInstallment: true, status: { notIn: [-2, -3] } }
        });

        const unpaidInstallments = await prisma.installments.findMany({ where: { status: 0 } });
        const now = new Date();
        now.setHours(0,0,0,0);

        for (let payment of userInstallmentPayments) {
            let mainPaymentId = payment.id;
            if (payment.isLinked && payment.linked) mainPaymentId = BigInt(payment.linked);
            
            const nextInst = unpaidInstallments.find(i => i.payment_id === mainPaymentId);
            if (nextInst && nextInst.due_date) {
                const dueDate = new Date(nextInst.due_date);
                const timeDiff = dueDate.getTime() - now.getTime();
                const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                const hasGracePeriod = payment.post_pay_date && new Date(payment.post_pay_date) >= now;

                const course = courses.find(c => c.id === payment.course_id);
                const courseName = course ? course.name : "your subject";

                if (daysLeft <= 5 && daysLeft > 1) {
                    alerts.push({ type: 'warning', msg: `Reminder: Installment of LKR ${nextInst.amount} for ${courseName} is due in ${daysLeft} days.` });
                } else if (daysLeft === 1 || daysLeft === 0) {
                    alerts.push({ type: 'danger', msg: `URGENT: Installment of LKR ${nextInst.amount} for ${courseName} is due within 24 Hours! Access will be locked.` });
                } else if (daysLeft < 0 && !hasGracePeriod) {
                    alerts.push({ type: 'locked', msg: `LOCKED: Access to ${courseName} is disabled due to an unpaid installment. Please pay to unlock.` });
                }
            }
        }

        // 4. Upcoming Live අදින කෑල්ල
        const contentLinks = await prisma.content_course.findMany({ where: { course_id: { in: courseIds } } });
        const contentIds = [...new Set(contentLinks.map(l => l.content_id))];
        
        const upcomingLive = await prisma.contents.findFirst({
            where: { 
                id: { in: contentIds }, 
                type: 1, 
                date: { gte: new Date() } 
            },
            orderBy: { date: 'asc' }
        });

        let liveClassData = null;
        if (upcomingLive) {
            const relatedLink = contentLinks.find(l => l.content_id === upcomingLive.id);
            const relatedCourse = courses.find(c => c.id === relatedLink?.course_id);
            liveClassData = { ...upcomingLive, courseName: relatedCourse?.name || "Live Class" };
        }

        // 🔥 Data ටික යවනවා
        return res.status(200).json(safeJson({ 
            enrolledCount: courseIds.length, 
            posts: posts, 
            alerts: alerts, 
            upcomingLive: liveClassData 
        }));

    } catch (error) {
        console.error("Mobile Dashboard Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

module.exports = { getHomeData };