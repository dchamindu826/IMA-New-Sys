const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/auth.middleware');
const multer = require('multer');
const path = require('path');

const { 
    createTask, completeTask, requestUnlock, approveUnlock, getMyTasks,
    getDailyTasks, createDailyTask, getScheduleTemplates, createScheduleWithTasks,
    getBatchSchedule, addSubjectTemplate, getPendingApprovals, deleteSubjectTemplate, 
    deleteSchedule, approveStaffTask, rejectStaffTask, addTaskTemplate, updateTaskTemplate, 
    deleteTaskTemplate, getStaffList, getBatchStaff, assignStaffToBatch, 
    getCoordinatorOverview, removeStaffFromBatch, assignTaskToExistingSchedule, 
    getTasksForSchedule, deleteAssignedTask, lockTask, managerUnlockTask, assignTaskToStaff
} = require('./task.controller');

// --- Multer Configuration ---
const proofStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../../public/documents')); // 🔥 Path Updated
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '_proof_' + path.extname(file.originalname));
    }
});
const uploadProof = multer({ storage: proofStorage });

// --- ROUTES ---
router.get('/my-tasks', protect, getMyTasks);
router.post('/complete', protect, uploadProof.single('file'), completeTask);
router.post('/request-unlock', protect, requestUnlock);
router.get('/coordinator/overview', protect, getCoordinatorOverview);

router.post('/create', protect, createTask);
router.post('/approve-unlock', protect, approveUnlock);
router.get('/manager/tasks', protect, getDailyTasks);
router.post('/manager/tasks/add', protect, createDailyTask);
router.put('/manager/task-templates/update', protect, updateTaskTemplate);

router.get('/manager/templates', protect, getScheduleTemplates);
router.post('/manager/subjects/add', protect, addSubjectTemplate);
router.delete('/manager/subjects/:id', protect, deleteSubjectTemplate);
router.post('/manager/task-templates/add', protect, addTaskTemplate);
router.delete('/manager/task-templates/:id', protect, deleteTaskTemplate);

router.post('/manager/schedule/add', protect, createScheduleWithTasks);
router.get('/manager/schedule', protect, getBatchSchedule);
router.delete('/manager/schedule/:id', protect, deleteSchedule);
router.post('/manager/schedule/:scheduleId/tasks', protect, assignTaskToExistingSchedule);
router.get('/manager/schedule/:scheduleId/tasks', protect, getTasksForSchedule);
router.delete('/manager/tasks/:taskId', protect, deleteAssignedTask);

router.get('/manager/approvals', protect, getPendingApprovals);
router.post('/manager/approvals/approve', protect, approveStaffTask);
router.post('/manager/approvals/reject', protect, rejectStaffTask);

router.get('/manager/staff-list', protect, getStaffList);
router.get('/manager/batch-staff/:batchId', protect, getBatchStaff);
router.post('/manager/batch-staff/assign', protect, assignStaffToBatch);
router.delete('/manager/batch-staff/remove/:batchId/:staffId', protect, removeStaffFromBatch);

router.post('/lock', protect, lockTask); 
router.post('/manager/approvals/unlock', protect, managerUnlockTask);
router.post('/manager/tasks/assign', protect, assignTaskToStaff);

module.exports = router;