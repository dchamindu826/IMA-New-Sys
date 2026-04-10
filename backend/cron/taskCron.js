const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const startTaskCron = () => {
    // හැම විනාඩියකට සැරයක්ම චෙක් කරනවා
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            
            // Deadline එක පැනපු, තාම කම්ප්ලීට් කරපු නැති, තාම ලොක් වෙලා නැති ටාස්ක් හොයනවා
            const overdueTasks = await prisma.daily_tasks.updateMany({
                where: {
                    deadline_date: { lt: now }, // `deadline` වෙනුවට `deadline_date` වෙන්නත් පුළුවන්, schema එක අනුව
                    is_completed: false,
                    is_locked: false,
                    manager_status: "PENDING"
                },
                data: {
                    is_locked: true
                    // 💡 මෙතනින් `updated_at: new Date()` අයින් කළා. 💡
                }
            });

            if (overdueTasks.count > 0) {
                console.log(`🔒 Auto-Locked ${overdueTasks.count} overdue tasks at ${now.toISOString()}`);
            }
        } catch (error) {
            console.error("[CRON-JOB] Error locking tasks:", error);
        }
    });

    console.log("⏱️ Task Auto-Lock Cron Job Started!");
};

module.exports = startTaskCron;