const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const moment = require('moment'); 

const getAllUpcomingLives = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. ළමයා Enrol වෙලා ඉන්න Courses ටික ගන්නවා
        const courseUsers = await prisma.course_user.findMany({ where: { user_id: BigInt(userId) } });
        const courseIds = courseUsers.map(cu => cu.course_id);

        if (courseIds.length === 0) {
            return res.status(200).json({ liveClasses: [] });
        }

        // 2. ඒ Courses වලට අදාලව 'contents' table එකේ තියෙන දේවල් වල IDs ගන්නවා (type = 1 කියන්නේ Live)
        const contentLinks = await prisma.content_course.findMany({ 
            where: { course_id: { in: courseIds }, type: 1 } 
        });
        const contentIds = [...new Set(contentLinks.map(l => l.content_id))];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 3. 'contents' table එකෙන් අදින් පස්සේ තියෙන Live Classes ටික ගන්නවා
        const liveClasses = await prisma.contents.findMany({
            where: {
                id: { in: contentIds },
                type: 1, // Live Classes
                date: { gte: today }
            },
            orderBy: { date: 'asc' }
        });

        const courses = await prisma.courses.findMany({ where: { id: { in: courseIds } } });

        // App එකට ඕනේ විදිහට Map කරනවා
        const formattedLives = liveClasses.map(live => {
            const relatedLink = contentLinks.find(l => l.content_id === live.id);
            const relatedCourse = courses.find(c => c.id === relatedLink?.course_id);

            return {
                id: live.id.toString(),
                title: live.title,
                courseName: relatedCourse ? relatedCourse.name : "Live Class",
                date: live.date ? moment(live.date).format('YYYY-MM-DD') : '',
                startTime: live.startTime || "TBA",
                endTime: live.endTime || "TBA",
                link: live.link,
                status: 1, 
                paidStatus: 1 
            };
        });

        res.status(200).json({ liveClasses: formattedLives });
    } catch (error) {
        console.error("Live Classes Error:", error);
        res.status(500).json({ message: "Failed to load live classes" });
    }
};

module.exports = { getAllUpcomingLives };