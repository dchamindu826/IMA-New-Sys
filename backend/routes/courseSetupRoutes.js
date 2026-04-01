const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const { 
    createBusiness, createBatch, createGroup, updateGroup,
    createSubject, setupInstallment, getInstallments, updateInstallment, deleteInstallment, setupDiscount,
    toggleBusinessStatus, toggleBatchStatus
} = require('../controllers/courseSetupController');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/storage/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

router.post('/business', upload.single('logo'), createBusiness);
router.post('/batch', upload.single('logo'), createBatch);
router.post('/group', createGroup);
router.put('/group/update', updateGroup);
router.post('/subject', createSubject);

// 🔥 Installments CRUD Routes 🔥
router.post('/installment', setupInstallment);
router.get('/installment/:batchId', getInstallments);
router.put('/installment', updateInstallment);
router.delete('/installment', deleteInstallment);

router.post('/discount', setupDiscount);

// Toggles
router.put('/business/toggle-status', toggleBusinessStatus);
router.put('/batch/toggle-status', toggleBatchStatus);

module.exports = router;