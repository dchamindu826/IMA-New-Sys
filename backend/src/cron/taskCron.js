const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const startTaskCron = () => {
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            
            const overdueTasks = await prisma.daily_tasks.updateMany({
                where: {
                    deadline_date: { lt: now }, 
                    is_completed: false,
                    is_locked: false,
                    manager_status: "PENDING"
                },
                data: {
                    is_locked: true
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