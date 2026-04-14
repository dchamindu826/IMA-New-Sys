const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

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

const createTask = async (req, res) => {
    try {
        const { staff_id, batch_id, task_type, description, start_time, deadline } = req.body;
        const newTask = await prisma.daily_tasks.create({
            data: { staff_id: parseInt(staff_id), batch_id: BigInt(batch_id), task_type, description, start_time: start_time ? new Date(start_time) : null, deadline: new Date(deadline), unlock_status: 'NONE' }
        });
        return res.status(201).json({ message: "Task assigned", task: safeJson(newTask) });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const completeTask = async (req, res) => {
    try {
        const { task_id, contentTitle, contentType, link, zoomMeetingId, startTime, endTime, contentGroupId, isFree, noChanges, paperTime, questionCount, selectedCourses } = req.body;
        
        let proofData = {
            title: contentTitle, type: contentType, link: link || null, zoomMeetingId: zoomMeetingId || null,
            startTime: startTime || null, endTime: endTime || null, contentGroupId: contentGroupId || null,
            isFree: isFree === 'true' || isFree === true, noChanges: noChanges === 'true' || noChanges === true,
            paperTime: paperTime || null, questionCount: questionCount || null,
            selectedCourses: selectedCourses ? JSON.parse(selectedCourses) : []
        };

        if (req.file) proofData.link = `http://72.62.249.211:5000/documents/${req.file.filename}`;

        const updatedTask = await prisma.daily_tasks.update({
            where: { id: parseInt(task_id) },
            data: { submitted_proof: JSON.stringify(proofData), is_completed: true, manager_status: 'WAITING_APPROVAL', submitted_at: new Date() }
        });

        return res.status(200).json({ message: "Task completed!", task: safeJson(updatedTask) });
    } catch (error) { return res.status(500).json({ message: "Server Error: " + error.message }); }
};

const requestUnlock = async (req, res) => {
    try {
        const { task_id, reason } = req.body;
        await prisma.daily_tasks.update({ where: { id: parseInt(task_id) }, data: { unlock_status: 'REQUESTED', unlock_reason: reason } });
        return res.status(200).json({ message: "Unlock request sent." });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const approveUnlock = async (req, res) => {
    try {
        const { task_id, new_time } = req.body;
        
        if (!new_time) return res.status(400).json({ message: "New time is required" });

        // 🔥 අද දවස ගන්නවා (පරණ දවස තිබ්බොත් ආයෙත් Lock වෙන නිසා)
        const today = new Date();

        await prisma.daily_tasks.update({
            where: { id: parseInt(task_id) },
            data: {
                end_time: new_time,          // අලුත් වෙලාව
                deadline_date: today,        // දවස අදට මාරු කරනවා
                is_locked: false,            // Lock එක අයින් කරනවා
                unlock_status: "APPROVED",   // Unlock කරපු බව සටහන් කරනවා (Penalty එකට ඕනෙ වෙනවා)
                manager_status: "PENDING"    // Staff එකට ආපහු Submit කරන්න පුළුවන් වෙන්න PENDING කරනවා
            }
        });

        return res.status(200).json({ message: "Task unlocked successfully!" });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error unlocking task." });
    }
};

const getMyTasks = async (req, res) => {
    try {
        const userRole = req.user.role;
        const userId = req.user.id;
        const { staffId, batchId } = req.query; 
        
        const todayStr = new Date().toISOString().split('T')[0];
        let whereCondition = {};

        if (['System Admin', 'Director', 'Admin', 'Manager', 'Ass Manager'].includes(userRole)) {
            if (staffId && staffId !== 'all') whereCondition.staff_id = parseInt(staffId);
            if (batchId && batchId !== 'all') whereCondition.batch_id = BigInt(batchId.toString());
        } else {
            whereCondition.staff_id = parseInt(userId);
        }

        const allTasks = await prisma.daily_tasks.findMany({ where: whereCondition, orderBy: { created_at: 'desc' } });
        return res.status(200).json(safeJson({ tasks: allTasks, today: todayStr }));
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const getDailyTasks = async (req, res) => {
    try {
        const { batchId } = req.query; 
        let whereClause = {};
        if (batchId && batchId !== 'all') whereClause.batch_id = BigInt(batchId.toString());
        const tasks = await prisma.daily_tasks.findMany({ where: whereClause, orderBy: { created_at: 'desc' } });
        return res.status(200).json(safeJson(tasks));
    } catch (error) { return res.status(500).json({ message: "Server Error" }); }
};

const createDailyTask = async (req, res) => {
    try {
        const { staff_id, batch_id, schedule_id, task_type, description, deadline, start_time, end_time } = req.body;
        
        let exactDeadline = new Date(deadline);
        if (end_time) {
            exactDeadline = new Date(`${deadline}T${end_time}:00`);
            if (start_time && end_time < start_time) exactDeadline.setDate(exactDeadline.getDate() + 1);
        } else {
            exactDeadline.setHours(23, 59, 59); 
        }

        const newTask = await prisma.daily_tasks.create({
            data: { 
                staff_id: staff_id ? parseInt(staff_id) : 0, 
                batch_id: BigInt(batch_id), 
                schedule_id: schedule_id ? parseInt(schedule_id) : null,
                task_type, 
                description, 
                start_date: new Date(deadline), 
                deadline_date: exactDeadline, 
                start_time: start_time || null, 
                end_time: end_time || null, 
                is_completed: false, 
                is_locked: false, 
                manager_status: "PENDING", 
                unlock_status: "NONE" 
            }
        });
        return res.status(200).json({ message: "Task created successfully", task: safeJson(newTask) });
    } catch (error) { return res.status(500).json({ message: "Server Error" }); }
};

const assignTaskToStaff = async (req, res) => {
    try {
        const { taskId, staffId } = req.body;
        await prisma.daily_tasks.update({ where: { id: parseInt(taskId) }, data: { staff_id: parseInt(staffId) } });
        return res.status(200).json({ message: "Task Assigned!" });
    } catch (error) { return res.status(500).json({ message: "Server Error" }); }
};

const getScheduleTemplates = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        let businessId = null;

        if (['Manager', 'Ass Manager'].includes(userRole)) {
            const business = await prisma.businesses.findFirst({ where: { OR: [{ head_manager_id: parseInt(userId) }, { ass_manager_id: parseInt(userId) }] } });
            if (business) businessId = business.id;
        }

        let whereClause = {};
        if (businessId) whereClause.business_id = businessId;

        let subjects = await prisma.subject_templates.findMany({ where: whereClause });
        let tasks = await prisma.task_templates.findMany({ where: whereClause });
        return res.status(200).json(safeJson({ subjects, tasks }));
    } catch (error) { return res.status(500).json({ message: "Server Error" }); }
};

const createScheduleWithTasks = async (req, res) => {
    try {
        const { batchId, date, subject, content, startTime, endTime, selectedTasks } = req.body;
        const schedule = await prisma.class_schedules.create({
            data: { batch_id: BigInt(batchId), subject, date: new Date(date), start_time: startTime, end_time: endTime, content }
        });

        let exactDeadline = new Date(`${date}T${endTime || '23:59'}:00`);
        if (endTime && startTime && endTime < startTime) exactDeadline.setDate(exactDeadline.getDate() + 1);

        const taskTypeMap = {
            'live': 'Live Class',
            'recording': 'Recording',
            'document': 'Document/PDF',
            'sPaper': 'Structured Paper',
            'paper': 'MCQ Paper'
        };

        const tasksList = Array.isArray(selectedTasks) ? selectedTasks : [];
        const tasksToCreate = tasksList.map(tKey => ({
            schedule_id: schedule.id, 
            batch_id: BigInt(batchId), 
            staff_id: 0, 
            task_type: tKey, 
            description: `[${taskTypeMap[tKey] || tKey}] ${subject} - ${content}`, 
            start_date: new Date(date), 
            deadline_date: exactDeadline, 
            start_time: startTime, 
            end_time: endTime, 
            is_completed: false, 
            is_locked: false, 
            manager_status: "PENDING"
        }));

        if (tasksToCreate.length > 0) {
            await prisma.daily_tasks.createMany({ data: tasksToCreate });
        }
        res.status(201).json({ message: "Class Scheduled!" });
    } catch (error) { res.status(500).json({ error: "Failed to create schedule" }); }
};

const getBatchSchedule = async (req, res) => {
    try {
        const { batchId, year, month } = req.query;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const schedules = await prisma.class_schedules.findMany({ where: { batch_id: BigInt(batchId.toString()), date: { gte: startDate, lte: endDate } } });
        const formatted = schedules.map(s => ({ ...s, id: s.id.toString(), batch_id: s.batch_id.toString(), date: s.date.toISOString().split('T')[0] }));
        return res.status(200).json(formatted);
    } catch (error) { return res.status(500).json({ message: "Server Error" }); }
};

const addSubjectTemplate = async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.user.id;
        const business = await prisma.businesses.findFirst({ where: { OR: [{ head_manager_id: parseInt(userId) }, { ass_manager_id: parseInt(userId) }] } });
        if (!business) return res.status(404).json({ message: "Business not found for this manager" });
        const newSub = await prisma.subject_templates.create({ data: { business_id: business.id, name } });
        return res.status(200).json(safeJson(newSub));
    } catch(e) { return res.status(500).json({message: "Server Error"}); }
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

const getPendingApprovals = async (req, res) => {
    try {
        const { staffId, batchId } = req.query;
        let whereCondition = { manager_status: "WAITING_APPROVAL" };
        
        if (staffId && staffId !== 'all') whereCondition.staff_id = parseInt(staffId);
        if (batchId && batchId !== 'all') whereCondition.batch_id = BigInt(batchId.toString());

        // Unlock request කරපු ඒවත් UI එකට යවන්න ඕනෙ නිසා OR දානවා
        const pendingTasks = await prisma.daily_tasks.findMany({ 
            where: {
                OR: [
                    whereCondition,
                    { unlock_status: "REQUESTED", ...(staffId !== 'all' && {staff_id: parseInt(staffId)}) }
                ]
            }
        });
        
        let successWhere = { manager_status: { notIn: ["PENDING", "WAITING_APPROVAL"] } };
        let approvedWhere = { manager_status: "APPROVED" };
        let penalizedWhere = { manager_status: "APPROVED", unlock_status: "APPROVED" }; // Late වෙලා කරපු ඒවා
        
        if (staffId && staffId !== 'all') { 
            successWhere.staff_id = parseInt(staffId); 
            approvedWhere.staff_id = parseInt(staffId); 
            penalizedWhere.staff_id = parseInt(staffId);
        }
        
        const totalCompleted = await prisma.daily_tasks.count({ where: successWhere });
        const approvedCount = await prisma.daily_tasks.count({ where: approvedWhere });
        const penalizedCount = await prisma.daily_tasks.count({ where: penalizedWhere });

        // 🔥 Penalty Calculation: Late වෙච්ච හැම Task එකකටම 50% ක penalty එකක් (අඩුවීමක්) වෙනවා
        const actualSuccessScore = approvedCount - (penalizedCount * 0.5); 
        const successRate = totalCompleted === 0 ? 0 : Math.max(0, Math.round((actualSuccessScore / totalCompleted) * 100));

        return res.status(200).json({ tasks: safeJson(pendingTasks), successRate });
    } catch(e) { return res.status(500).json({message: "Server Error"}); }
};

const approveStaffTask = async (req, res) => {
    try {
        const { taskId } = req.body;
        const updatedTask = await prisma.daily_tasks.update({ 
            where: { id: parseInt(taskId) }, 
            data: { manager_status: "APPROVED" } 
        });

        // 🔥 Content Hub එකට යවන්න ඕනෙ Task Types ටික විතරක් මෙතන දාන්න
        const hubTaskTypes = ['live', 'recording', 'document', 'sPaper', 'paper'];

        // ඒ type එකක් නම් විතරක් Content Hub (contents table) එකට push කරන්න
        if (hubTaskTypes.includes(updatedTask.task_type)) {
            const schedule = await prisma.class_schedules.findUnique({ where: { id: updatedTask.schedule_id } });

            if (schedule && updatedTask.submitted_proof) {
                let proofObj = {};
                try { proofObj = JSON.parse(updatedTask.submitted_proof); } catch(e) { proofObj = { link: updatedTask.submitted_proof }; }

                if (proofObj.noChanges !== true) {
                    let contentType = proofObj.type || 1; 

                    const newContent = await prisma.contents.create({
                        data: {
                            title: proofObj.title || `${schedule.subject} - ${updatedTask.task_type}`,
                            date: schedule.date,
                            startTime: proofObj.startTime || schedule.start_time,
                            endTime: proofObj.endTime || schedule.end_time,
                            link: proofObj.link, 
                            type: contentType,
                            zoomMeetingId: proofObj.zoomMeetingId || null,
                            content_group_id: proofObj.contentGroupId ? parseInt(proofObj.contentGroupId) : null,
                            isFree: proofObj.isFree === true || proofObj.isFree === 'true',
                            paperTime: proofObj.paperTime ? parseInt(proofObj.paperTime) : null,
                            questionCount: proofObj.questionCount ? parseInt(proofObj.questionCount) : null
                        }
                    });

                    if (proofObj.selectedCourses && Array.isArray(proofObj.selectedCourses) && proofObj.selectedCourses.length > 0) {
                        const contentCourseData = proofObj.selectedCourses.map(courseId => ({
                            content_id: newContent.id, course_id: BigInt(courseId), type: contentType,
                            itemOrder: "0", created_at: new Date()
                        }));
                        await prisma.content_course.createMany({ data: contentCourseData });
                    }
                }
            }
            return res.status(200).json({ message: "Task Approved & Content Published to Hub! 🎉" });
        } else {
            // Custom Task එකක් නම් නිකම්ම Approve කරනවා
            return res.status(200).json({ message: "Custom Task Approved Successfully! ✅" });
        }
    } catch(e) { return res.status(500).json({ message: "Error approving task." }); }
};

const rejectStaffTask = async (req, res) => {
    try {
        const { taskId, reason } = req.body;
        await prisma.daily_tasks.update({ where: { id: parseInt(taskId) }, data: { manager_status: "REJECTED", reject_reason: reason, resubmit_count: { increment: 1 }, is_completed: false } });
        return res.status(200).json({ message: "Task Rejected" });
    } catch(e) { return res.status(500).json({ message: "Error" }); }
};

// 🔥 FIX: Database එකට යවද්දි business_id එක BigInt විදිහට අනිවාර්යයෙන් යවන්න හැදුවා 🔥
const addTaskTemplate = async (req, res) => {
    try {
        const { title, start_date, end_date, start_time, end_time, businessId } = req.body; 
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let targetBizId = null;

        if (['Manager', 'Ass Manager'].includes(userRole)) {
            const business = await prisma.businesses.findFirst({ where: { OR: [{ head_manager_id: parseInt(userId) }, { ass_manager_id: parseInt(userId) }] } });
            if (business) targetBizId = business.id;
        } else {
            if (businessId && businessId !== 'all') {
                targetBizId = businessId;
            } else {
                const fallbackBiz = await prisma.businesses.findFirst();
                if (fallbackBiz) targetBizId = fallbackBiz.id;
            }
        }

        if (!targetBizId) return res.status(400).json({ message: "Please select a specific Business to save templates." });

        const taskData = {
            business_id: BigInt(targetBizId), 
            title, 
            has_time_limit: false, 
            description: JSON.stringify({ start_date: start_date || null, end_date: end_date || null, start_time: start_time || null, end_time: end_time || null }) 
        };

        const newTask = await prisma.task_templates.create({ data: taskData });
        return res.status(200).json(safeJson(newTask));
    } catch(e) { 
        console.error("Add Template Error:", e);
        return res.status(500).json({message: "Failed to add template."}); 
    }
};

const updateTaskTemplate = async (req, res) => {
    try {
        const { id, title, start_date, end_date, start_time, end_time } = req.body;
        const updatedTask = await prisma.task_templates.update({
            where: { id: parseInt(id) },
            data: { 
                title, 
                description: JSON.stringify({ start_date: start_date || null, end_date: end_date || null, start_time: start_time || null, end_time: end_time || null }) 
            }
        });
        return res.status(200).json(safeJson(updatedTask));
    } catch(e) { 
        console.error("Update Template Error:", e);
        return res.status(500).json({message: "Failed to update template."}); 
    }
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
        if(!exists) await prisma.batch_staff_assignments.create({ data: { batch_id: BigInt(batchId), staff_id: parseInt(staffId) } });
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
        
        // 1. Manager assign karapu Batch Assignment eka gannawa
        const assignment = await prisma.batch_staff_assignments.findFirst({ 
            where: { staff_id: parseInt(userId) }, 
            orderBy: { created_at: 'desc' } 
        });

        // Batch ekak assign wela nathnam 404 yawanne nathuwa empty data yawana eka frontend ekata safe.
        // Eken Axios errors ena eka nawathinawa.
        if (!assignment) {
            return res.status(200).json(safeJson({ 
                user, business: null, batch: null, groups: [], todayClasses: [], pendingTasksCount: 0 
            }));
        }

        // 2. Batch eka check karanawa
        const batch = await prisma.batches.findUnique({ where: { id: assignment.batch_id } });
        
        // Batch eka delete wela nam crash wenna nodee safe json ekak yawenawa
        if (!batch) {
            return res.status(200).json(safeJson({ 
                user, business: null, batch: null, groups: [], todayClasses: [], pendingTasksCount: 0 
            }));
        }

        // 3. Business eka saha Groups gannawa
        const business = await prisma.businesses.findUnique({ where: { id: batch.business_id } });
        const groups = await prisma.groups.findMany({ where: { batch_id: batch.id } });

        // 4. Timezone issue nathuwa today classes ganna Date Range eka hadanawa (Mehema kalama crash wenne na)
        const todayStr = new Date().toISOString().split('T')[0];
        const startOfDay = new Date(`${todayStr}T00:00:00.000Z`);
        const endOfDay = new Date(`${todayStr}T23:59:59.999Z`);

        const todayClasses = await prisma.class_schedules.findMany({ 
            where: { 
                batch_id: batch.id, 
                date: { gte: startOfDay, lte: endOfDay } 
            } 
        });

        // 5. Tasks gannawa
        const myTasks = await prisma.daily_tasks.findMany({ 
            where: { staff_id: parseInt(userId), is_completed: false } 
        });

        return res.status(200).json(safeJson({ 
            user, business, batch, groups, todayClasses, pendingTasksCount: myTasks.length 
        }));

    } catch (error) { 
        console.error("Coordinator Overview Error:", error);
        return res.status(500).json({ message: "Server Error", error: error.message }); 
    }
};

const assignTaskToExistingSchedule = async (req, res) => {
    try {
        const { scheduleId } = req.params;
        const { taskTpl } = req.body;
        const schedule = await prisma.class_schedules.findUnique({ where: { id: parseInt(scheduleId) } });
        if (!schedule) return res.status(404).json({ message: "Schedule not found" });

        let exactDeadline = taskTpl.deadline_date ? new Date(taskTpl.deadline_date) : schedule.date;
        let sTime = taskTpl.start_time || schedule.start_time;
        let eTime = taskTpl.end_time || schedule.end_time;
        if (eTime) {
            const dateStr = exactDeadline.toISOString().split('T')[0];
            exactDeadline = new Date(`${dateStr}T${eTime}:00`);
            if (sTime && eTime < sTime) exactDeadline.setDate(exactDeadline.getDate() + 1);
        } else { exactDeadline.setHours(23, 59, 59); }

        const newTask = await prisma.daily_tasks.create({
            data: { staff_id: 0, batch_id: schedule.batch_id, schedule_id: parseInt(scheduleId), task_type: taskTpl.title, description: `[${schedule.subject}] - ${schedule.content}`, start_date: taskTpl.start_date ? new Date(taskTpl.start_date) : schedule.date, deadline_date: exactDeadline, start_time: sTime, end_time: eTime, is_completed: false, is_locked: false, manager_status: "PENDING" }
        });
        return res.status(200).json(safeJson(newTask));
    } catch (e) { return res.status(500).json({ message: "Error" }); }
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
    } catch (e) { return res.status(500).json({ message: "Error" }); }
};

const lockTask = async (req, res) => {
    try {
        const { taskId } = req.body;
        await prisma.daily_tasks.update({ where: { id: parseInt(taskId) }, data: { is_locked: true, updated_at: new Date() } });
        return res.status(200).json({ message: "Task Locked" });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const managerUnlockTask = async (req, res) => {
    try {
        const { taskId } = req.body;
        await prisma.daily_tasks.update({ where: { id: parseInt(taskId) }, data: { is_locked: false, unlock_status: 'MANAGER_UNLOCKED', resubmit_count: { increment: 1 }, updated_at: new Date() } });
        return res.status(200).json({ message: "Task Unlocked but penalized." });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

module.exports = {
    createTask, completeTask, requestUnlock, approveUnlock, getMyTasks, getDailyTasks, createDailyTask,
    getScheduleTemplates, createScheduleWithTasks, getBatchSchedule, addSubjectTemplate, getPendingApprovals,
    deleteSubjectTemplate, deleteSchedule, approveStaffTask, rejectStaffTask, addTaskTemplate, updateTaskTemplate,
    deleteTaskTemplate, getStaffList, getBatchStaff, assignStaffToBatch, removeStaffFromBatch, getCoordinatorOverview,
    assignTaskToExistingSchedule, getTasksForSchedule, deleteAssignedTask, managerUnlockTask, lockTask, assignTaskToStaff
};