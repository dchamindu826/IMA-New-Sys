const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// 1. Task එකක් හදනවා (Manager Action)
const createTask = async (req, res) => {
    try {
        const { staff_id, batch_id, task_type, description, start_time, deadline } = req.body;
        
        const newTask = await prisma.daily_tasks.create({
            data: {
                staff_id: parseInt(staff_id),
                batch_id: BigInt(batch_id),
                task_type,
                description,
                start_time: start_time ? new Date(start_time) : null,
                deadline: new Date(deadline),
                unlock_status: 'NONE'
            }
        });

        return res.status(201).json({ message: "Task assigned to staff successfully", task: safeJson(newTask) });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 2. Task එක Complete කරනවා & Content Hub එකට Data දානවා (Staff Action)
const completeTask = async (req, res) => {
    try {
        const { task_id, contentTitle, taskType, link, zoomId } = req.body;
        
        // Frontend එකෙන් එන Content Data ටික JSON Object එකක් කරලා Save කරනවා
        let proofData = {
            title: contentTitle,
            type: taskType,
            link: link || null,
            zoomId: zoomId || null
        };

        if (req.file) {
            proofData.link = `http://72.62.249.211:5000/documents/${req.file.filename}`;
        }

        const updatedTask = await prisma.daily_tasks.update({
            where: { id: parseInt(task_id) },
            data: {
                submitted_proof: JSON.stringify(proofData), 
                is_completed: true,
                manager_status: 'WAITING_APPROVAL',
                submitted_at: new Date() 
            }
        });

        return res.status(200).json({ message: "Task completed!", task: safeJson(updatedTask) });
    } catch (error) {
        return res.status(500).json({ message: "Server Error: " + error.message });
    }
};

// 3. Lock වුණු Task එකක් Unlock කරන්න හේතුවක් එක්ක Request එකක් දානවා (Staff Action)
const requestUnlock = async (req, res) => {
    try {
        const { task_id, reason } = req.body;

        await prisma.daily_tasks.update({
            where: { id: parseInt(task_id) },
            data: { 
                unlock_status: 'REQUESTED',
                unlock_reason: reason
            }
        });

        return res.status(200).json({ message: "Unlock request sent to manager with your reason." });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 4. Unlock Request එක Approve කරලා අලුත් Deadline එකක් දෙනවා (Manager Action)
const approveUnlock = async (req, res) => {
    try {
        const { task_id, new_deadline } = req.body;

        await prisma.daily_tasks.update({
            where: { id: parseInt(task_id) },
            data: {
                is_locked: false,
                unlock_status: 'APPROVED',
                deadline: new Date(new_deadline) 
            }
        });

        return res.status(200).json({ message: "Task unlocked and deadline extended." });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// 5. Staff එකේ කෙනාගේ Dashboard එකට Tasks ටික අරන් යනවා (FILTERS එක්ක)
const getMyTasks = async (req, res) => {
    try {
        const userRole = req.user.role;
        const userId = req.user.id;
        const { staffId, batchId } = req.query; // Filters
        
        const todayStr = new Date().toISOString().split('T')[0];
        let whereCondition = {};

        if (['System Admin', 'Director', 'Admin', 'Manager', 'Ass Manager'].includes(userRole)) {
            if (staffId && staffId !== 'all') {
                whereCondition.staff_id = parseInt(staffId);
            }
            if (batchId && batchId !== 'all') {
                whereCondition.batch_id = BigInt(batchId.toString());
            }
        } else {
            whereCondition.staff_id = parseInt(userId);
        }

        const allTasks = await prisma.daily_tasks.findMany({
            where: whereCondition,
            orderBy: { created_at: 'desc' }
        });
        
        return res.status(200).json(safeJson({ tasks: allTasks, today: todayStr }));
    } catch (error) {
        console.error("Fetch MyTasks Error:", error);
        return res.status(500).json({ message: error.message });
    }
};

// 6. දවසට අදාල Tasks ටික ගන්න
const getDailyTasks = async (req, res) => {
    try {
        const { batchId, date } = req.query; 
        
        if (!date) return res.status(400).json({ message: "Date is required" });

        const startOfDay = new Date(`${date}T00:00:00.000Z`);
        const endOfDay = new Date(`${date}T23:59:59.999Z`);

        let whereClause = {
            deadline_date: { gte: startOfDay, lte: endOfDay } 
        };
        
        if (batchId && batchId !== 'all') {
            whereClause.batch_id = BigInt(batchId.toString());
        }

        const tasks = await prisma.daily_tasks.findMany({
            where: whereClause,
            orderBy: { deadline_date: 'asc' } 
        });

        return res.status(200).json(safeJson(tasks));
    } catch (error) {
        console.error("Task Fetch Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

// 7. අලුත් Task එකක් දාන්න
const createDailyTask = async (req, res) => {
    try {
        const { staff_id, batch_id, task_type, description, deadline } = req.body;

        const newTask = await prisma.daily_tasks.create({
            data: {
                staff_id: parseInt(staff_id || req.user.id), 
                batch_id: BigInt(batch_id),
                task_type: task_type,
                description: description,
                deadline: new Date(deadline), 
                is_completed: false,
                is_locked: false,
                unlock_status: "NONE"
            }
        });

        return res.status(200).json({ message: "Task created successfully" });
    } catch (error) {
        console.error("Task Create Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

// 8. Subjects සහ Tasks Templates ටික ගන්න API එක
const getScheduleTemplates = async (req, res) => {
    try {
        const userId = req.user.id;
        const business = await prisma.businesses.findFirst({
            where: { OR: [{ head_manager_id: parseInt(userId) }, { ass_manager_id: parseInt(userId) }] }
        });

        if (!business) return res.status(200).json({ subjects: [], tasks: [] });

        let subjects = await prisma.subject_templates.findMany({ where: { business_id: business.id } });
        let tasks = await prisma.task_templates.findMany({ where: { business_id: business.id } });

        if (subjects.length === 0) {
            await prisma.subject_templates.createMany({
                data: [
                    { business_id: business.id, name: "Science Theory Class" },
                    { business_id: business.id, name: "Science Past Paper Discussion" },
                    { business_id: business.id, name: "Mathematics Revision" }
                ]
            });
            subjects = await prisma.subject_templates.findMany({ where: { business_id: business.id } });
        }

        if (tasks.length === 0) {
            await prisma.task_templates.createMany({
                data: [
                    { business_id: business.id, title: "Schedule Zoom Link", type: "STRICT" },
                    { business_id: business.id, title: "Upload PDF Tute to Portal", type: "OPTIONAL" },
                    { business_id: business.id, title: "Send Community WhatsApp Reminder", type: "OPTIONAL" },
                    { business_id: business.id, title: "Request Tech Hall Setup", type: "STRICT" }
                ]
            });
            tasks = await prisma.task_templates.findMany({ where: { business_id: business.id } });
        }

        return res.status(200).json(safeJson({ subjects, tasks }));
        
    } catch (error) {
        console.error("Template Fetch Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

// 🔥 9. Schedule එකයි ඒකට අදාල Tasks ටිකයි Save කරන API එක (Auto 3 Tasks Added) 🔥
const createScheduleWithTasks = async (req, res) => {
    try {
        const { batchId, date, subject, content, startTime, endTime, selectedTasks, lecturerId } = req.body;

        const schedule = await prisma.class_schedules.create({
            data: { 
                batch_id: BigInt(batchId), 
                subject, 
                date: new Date(date), 
                start_time: startTime, 
                end_time: endTime, 
                content,
                staff_id: lecturerId ? parseInt(lecturerId) : null
            }
        });

        const assignment = await prisma.batch_staff_assignments.findFirst({
            where: { batch_id: BigInt(batchId) },
            orderBy: { created_at: 'desc' }
        });
        const staffIdToAssign = assignment ? parseInt(assignment.staff_id) : parseInt(req.user.id);

        // 🔥 අනිවාර්ය Tasks 3 Auto හැදෙනවා 🔥
        const autoTasks = [
            { title: "Live Class Setup", type: "Live", time: startTime },
            { title: "Previous Day Recording", type: "Recording", time: startTime },
            { title: "Upload PDF Material", type: "Document", time: startTime }
        ];

        // ඔක්කොම Tasks (Auto + Selected)
        const finalTasksToCreate = [...autoTasks, ...(selectedTasks || [])];

        const taskPromises = finalTasksToCreate.map(task => {
            const desc = task.subTasks ? JSON.stringify(task.subTasks) : `[${subject}] - ${content}`;
            return prisma.daily_tasks.create({
                data: {
                    staff_id: staffIdToAssign,
                    batch_id: BigInt(batchId),
                    schedule_id: schedule.id,
                    task_type: task.title,
                    description: desc,
                    start_date: new Date(date),
                    deadline_date: new Date(date), 
                    start_time: task.time || startTime,
                    end_time: task.endTime || endTime,
                    is_completed: false,
                    is_locked: false,
                    manager_status: "PENDING"
                }
            });
        });
        await Promise.all(taskPromises);

        return res.status(200).json({ message: "Schedule & Tasks Created!" });
    } catch (error) {
        console.error("Schedule Create Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

// 10. Calendar එකට Schedule එක ගන්න API එක
const getBatchSchedule = async (req, res) => {
    try {
        const { batchId, year, month } = req.query;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const schedules = await prisma.class_schedules.findMany({
            where: {
                batch_id: BigInt(batchId.toString()),
                date: { gte: startDate, lte: endDate }
            }
        });
        
        const formatted = schedules.map(s => ({
            ...s, 
            id: s.id.toString(), 
            batch_id: s.batch_id.toString(), 
            date: s.date.toISOString().split('T')[0]
        }));
        return res.status(200).json(formatted);
    } catch (error) {
        return res.status(500).json({ message: "Server Error" });
    }
};

const addSubjectTemplate = async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user.id;
        
        const business = await prisma.businesses.findFirst({
            where: { OR: [{ head_manager_id: parseInt(userId) }, { ass_manager_id: parseInt(userId) }] }
        });

        if (!business) return res.status(404).json({ message: "Business not found for this manager" });

        const newSub = await prisma.subject_templates.create({
            data: { business_id: business.id, name }
        });
        
        return res.status(200).json(safeJson(newSub));
    } catch(e) { 
        console.error("Add Subject Error:", e);
        return res.status(500).json({message: "Server Error"}); 
    }
};

const deleteSubjectTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.subject_templates.delete({ where: { id: parseInt(id) } });
        return res.status(200).json({ message: "Subject Deleted" });
    } catch (e) { return res.status(500).json({ message: "Server Error" }); }
};

const deleteSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.daily_tasks.deleteMany({ where: { schedule_id: parseInt(id) } });
        await prisma.class_schedules.delete({ where: { id: parseInt(id) } });
        return res.status(200).json({ message: "Schedule Deleted" });
    } catch (e) { return res.status(500).json({ message: "Server Error" }); }
};

// 11. Pending Approvals ටිකයි, Success Rate එකයි ගන්නවා (FILTERS එක්ක)
const getPendingApprovals = async (req, res) => {
    try {
        const { staffId, batchId } = req.query;

        let whereCondition = { manager_status: "WAITING_APPROVAL" };

        if (staffId && staffId !== 'all') {
            whereCondition.staff_id = parseInt(staffId);
        }
        if (batchId && batchId !== 'all') {
            whereCondition.batch_id = BigInt(batchId.toString());
        }

        const pendingTasks = await prisma.daily_tasks.findMany({
            where: whereCondition
        });
        
        let successWhere = { manager_status: { notIn: ["PENDING", "WAITING_APPROVAL"] } };
        let approvedWhere = { manager_status: "APPROVED" };
        
        if (staffId && staffId !== 'all') {
            successWhere.staff_id = parseInt(staffId);
            approvedWhere.staff_id = parseInt(staffId);
        }
        if (batchId && batchId !== 'all') {
            successWhere.batch_id = BigInt(batchId.toString());
            approvedWhere.batch_id = BigInt(batchId.toString());
        }

        const totalCompleted = await prisma.daily_tasks.count({ where: successWhere });
        const approvedCount = await prisma.daily_tasks.count({ where: approvedWhere });
        
        const successRate = totalCompleted === 0 ? 0 : Math.round((approvedCount / totalCompleted) * 100);

        return res.status(200).json({ tasks: safeJson(pendingTasks), successRate });
    } catch(e) { 
        console.error("Get Approvals Error:", e);
        return res.status(500).json({message: "Server Error"}); 
    }
};

// 🔥 12. Task එකක් Approve කිරීම සහ Content Hub එකට යැවීම 🔥
const approveStaffTask = async (req, res) => {
    try {
        const { taskId } = req.body;
        
        const updatedTask = await prisma.daily_tasks.update({
            where: { id: parseInt(taskId) },
            data: { manager_status: "APPROVED" }
        });

        const schedule = await prisma.class_schedules.findUnique({
            where: { id: updatedTask.schedule_id }
        });

        if (schedule && updatedTask.submitted_proof) {
            // submitted_proof එක දැන් JSON string එකක්
            let proofObj = {};
            try {
                proofObj = JSON.parse(updatedTask.submitted_proof);
            } catch(e) {
                proofObj = { link: updatedTask.submitted_proof }; // පරණ data වලට support කරන්න
            }

            let contentType = 1; 
            const typeStr = (proofObj.type || updatedTask.task_type).toLowerCase();
            
            if (typeStr.includes('zoom') || typeStr.includes('live')) contentType = 1;
            else if (typeStr.includes('record')) contentType = 2;
            else if (typeStr.includes('pdf') || typeStr.includes('document') || typeStr.includes('tute')) contentType = 3;
            else if (typeStr.includes('paper') || typeStr.includes('mcq')) contentType = 4;

            // Content Table එකට Data Insert කිරීම
            await prisma.contents.create({
                data: {
                    title: proofObj.title || `${schedule.subject} - ${updatedTask.task_type}`,
                    date: schedule.date,
                    startTime: schedule.start_time,
                    endTime: schedule.end_time,
                    link: proofObj.link, 
                    type: contentType,
                    isFree: false
                }
            });
        }

        return res.status(200).json({ message: "Task Approved & Content Auto-Published! 🎉" });
    } catch(e) { 
        console.error(e);
        return res.status(500).json({ message: "Error" }); 
    }
};

// 13. Task එකක් Reject කිරීම
const rejectStaffTask = async (req, res) => {
    try {
        const { taskId, reason } = req.body;
        await prisma.daily_tasks.update({
            where: { id: parseInt(taskId) },
            data: { 
                manager_status: "REJECTED", 
                reject_reason: reason,
                resubmit_count: { increment: 1 },
                is_completed: false 
            }
        });
        return res.status(200).json({ message: "Task Rejected" });
    } catch(e) { return res.status(500).json({ message: "Error" }); }
};

const addTaskTemplate = async (req, res) => {
    try {
        const { title, has_time_limit } = req.body;
        const userId = req.user.id;
        const business = await prisma.businesses.findFirst({
            where: { OR: [{ head_manager_id: parseInt(userId) }, { ass_manager_id: parseInt(userId) }] }
        });
        const newTask = await prisma.task_templates.create({
            data: { business_id: business.id, title, has_time_limit: Boolean(has_time_limit) }
        });
        return res.status(200).json(safeJson(newTask));
    } catch(e) { return res.status(500).json({message: "Error"}); }
};

const deleteTaskTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.task_templates.delete({ where: { id: parseInt(id) } });
        return res.status(200).json({ message: "Deleted" });
    } catch(e) { return res.status(500).json({message: "Error"}); }
};

const getStaffList = async (req, res) => {
    try {
        const staff = await prisma.users.findMany({ where: { role: { in: ['Coordinator', 'Staff', 'Lecturer'] } } });
        return res.json(safeJson(staff));
    } catch(e) { return res.status(500).json({message:"Error"}); }
};

const getBatchStaff = async (req, res) => {
    try {
        const { batchId } = req.params;
        const assignments = await prisma.batch_staff_assignments.findMany({ where: { batch_id: BigInt(batchId) } });
        const staffIds = assignments.map(a => a.staff_id);
        const staffDetails = await prisma.users.findMany({ where: { id: { in: staffIds } } });
        return res.json(safeJson(staffDetails));
    } catch(e) { return res.status(500).json({message:"Error"}); }
};

const assignStaffToBatch = async (req, res) => {
    try {
        const { batchId, staffId } = req.body;
        const exists = await prisma.batch_staff_assignments.findFirst({ where: { batch_id: BigInt(batchId), staff_id: parseInt(staffId) } });
        if(!exists) {
            await prisma.batch_staff_assignments.create({ data: { batch_id: BigInt(batchId), staff_id: parseInt(staffId) } });
        }
        return res.json({message: "Assigned"});
    } catch(e) { return res.status(500).json({message:"Error"}); }
};

const removeStaffFromBatch = async (req, res) => {
    try {
        const { batchId, staffId } = req.params;
        await prisma.batch_staff_assignments.deleteMany({ where: { batch_id: BigInt(batchId), staff_id: parseInt(staffId) } });
        return res.json({message: "Removed"});
    } catch(e) { return res.status(500).json({message:"Error"}); }
};

const getCoordinatorOverview = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await prisma.users.findUnique({ where: { id: parseInt(userId) } });

        const assignment = await prisma.batch_staff_assignments.findFirst({
            where: { staff_id: parseInt(userId) },
            orderBy: { created_at: 'desc' } 
        });

        if (!assignment) return res.status(404).json({ message: "No batch assigned" });

        const batch = await prisma.batches.findUnique({ where: { id: assignment.batch_id } });
        const business = batch ? await prisma.businesses.findUnique({ where: { id: batch.business_id } }) : null;

        const groups = await prisma.groups.findMany({ where: { batch_id: batch.id } });

        const today = new Date().toISOString().split('T')[0];
        const todayClasses = await prisma.class_schedules.findMany({
            where: { batch_id: batch.id, date: new Date(today) }
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

const assignTaskToExistingSchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const { taskTpl } = req.body;

        const schedule = await prisma.class_schedules.findUnique({ where: { id: parseInt(scheduleId) } });
        if (!schedule) return res.status(404).json({ message: "Schedule not found" });

        const assignment = await prisma.batch_staff_assignments.findFirst({
            where: { batch_id: schedule.batch_id },
            orderBy: { created_at: 'desc' }
        });
        const staffIdToAssign = assignment ? parseInt(assignment.staff_id) : parseInt(req.user.id);

        const newTask = await prisma.daily_tasks.create({
            data: {
                staff_id: staffIdToAssign,
                batch_id: schedule.batch_id,
                schedule_id: parseInt(scheduleId),
                task_type: taskTpl.title,
                description: `[${schedule.subject}] - ${schedule.content}`,
                start_date: taskTpl.start_date ? new Date(taskTpl.start_date) : schedule.date,
                deadline_date: taskTpl.deadline_date ? new Date(taskTpl.deadline_date) : schedule.date,
                start_time: taskTpl.start_time || schedule.start_time,
                end_time: taskTpl.end_time || schedule.end_time,
                is_completed: false,
                is_locked: false,
                manager_status: "PENDING"
            }
        });
        return res.status(200).json(safeJson(newTask));
    } catch (e) { 
        console.error(e);
        return res.status(500).json({ message: "Error assigning task" }); 
    }
};

const getTasksForSchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const tasks = await prisma.daily_tasks.findMany({ where: { schedule_id: parseInt(scheduleId) } });
        return res.status(200).json(safeJson(tasks));
    } catch (e) { return res.status(500).json({ message: "Error fetching tasks" }); }
};

const deleteAssignedTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        await prisma.daily_tasks.delete({ where: { id: parseInt(taskId) } });
        return res.status(200).json({ message: "Task removed" });
    } catch (e) { return res.status(500).json({ message: "Error deleting task" }); }
};

const lockTask = async (req, res) => {
    try {
        const { taskId } = req.body;
        await prisma.daily_tasks.update({
            where: { id: parseInt(taskId) },
            data: { is_locked: true, updated_at: new Date() }
        });
        return res.status(200).json({ message: "Task Locked" });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const managerUnlockTask = async (req, res) => {
    try {
        const { taskId } = req.body;
        await prisma.daily_tasks.update({
            where: { id: parseInt(taskId) },
            data: { 
                is_locked: false, 
                unlock_status: 'MANAGER_UNLOCKED',
                resubmit_count: { increment: 1 }, 
                updated_at: new Date()
            }
        });
        return res.status(200).json({ message: "Task Unlocked but penalized." });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

// එකම module.exports එකක් විතරයි යටින් තියෙන්නේ
module.exports = {
    createTask, completeTask, requestUnlock, approveUnlock, getMyTasks, getDailyTasks, createDailyTask,
    getScheduleTemplates, createScheduleWithTasks, getBatchSchedule, addSubjectTemplate, getPendingApprovals,
    deleteSubjectTemplate, deleteSchedule, approveStaffTask, rejectStaffTask, addTaskTemplate,
    deleteTaskTemplate, getStaffList, getBatchStaff, assignStaffToBatch, removeStaffFromBatch, getCoordinatorOverview,
    assignTaskToExistingSchedule, getTasksForSchedule, deleteAssignedTask, managerUnlockTask, lockTask
};