const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getTemplates, createTemplate, deleteTemplate } = require('../controllers/templateController');

router.get('/', protect, getTemplates);
router.post('/create', protect, createTemplate);
router.delete('/:name', protect, deleteTemplate);

module.exports = router;