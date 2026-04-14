const express = require('express');
const cors = require('cors');
const path = require('path'); 
require('dotenv').config();

// 🔥 පින්තූරෙ තියෙන විදිහටම අකුරක් නෑර ගලපපු Imports ටික 🔥
const authRoutes = require('./src/modules/auth/auth.routes');
const studentRoutes = require('./src/modules/students/student.routes');
const adminRoutes = require('./src/modules/admin/admin.routes');

const taskRoutes = require('./src/modules/manager/taskRoutes');
const teamRoutes = require('./src/modules/manager/teamRoutes');
const paymentRoutes = require('./src/modules/payments/payment.routes');
const financeRoutes = require('./src/modules/payments/finance.routes');

const publicRoutes = require('./src/modules/public/publicRoutes');
const homeRoutes = require('./src/modules/public/homeRoutes');
const commonRoutes = require('./src/modules/common/commonRoutes');

// 🚨 මෙන්න ලොකුම අවුල තිබ්බ තැන! ෆෝල්ඩර් එක 'intergrations' (r අකුරක් එක්ක) 🚨
const contentHubRoutes = require('./src/modules/intergrations/contentHubRoutes');
const bridgeRoutes = require('./src/modules/intergrations/bridgeRoutes');

const crmRoutes = require('./src/modules/crm/crm.routes');
const callCampaignRoutes = require('./src/modules/crm/callCampaign.routes');
const mobileRoutes = require('./src/modules/mobile/mobileRoutes');

// 🚀 Webhook Controller එක
const whatsappWebhookController = require('./src/modules/crm/whatsappWebhook.controller');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/storage', express.static(path.join(__dirname, 'public')));
app.use('/documents', express.static(path.join(__dirname, 'public/documents')));

// --- MAIN API ROUTES ---
app.use('/api/auth', authRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/admin', adminRoutes);

// අලුත් Folders වලට Point කරපු Routes
app.use('/api/whatsapp', callCampaignRoutes); 
app.use('/api/tasks', taskRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', financeRoutes);
app.use('/api', publicRoutes); 
app.use('/api', homeRoutes); 
app.use('/api', commonRoutes);
app.use('/api/admin/manager', contentHubRoutes);
app.use('/api/templates', taskRoutes); 

// 🔥 LMS / Right Panel Routes 🔥
app.use('/api/bridge', bridgeRoutes);

// --- CRM & TEAM ROUTES ---
app.use('/api/crm', crmRoutes); 

// 🔥 Mobile App එකට අදාල සම්පූර්ණ Routes 🔥
app.use('/api/mobile', mobileRoutes);

// 🚀 Webhook Routes 🚀
app.get('/api/webhook', whatsappWebhookController.verifyWebhook);
app.post('/api/webhook', whatsappWebhookController.handleIncomingMessage);

// Cron Jobs අලුත් Path එකෙන් Load කිරීම
const startTaskCron = require('./src/cron/taskCron');

const PORT = process.env.PORT || 5000;

// 🔥 Server එක Start වෙද්දීම Cron එකත් Start කරනවා 🔥
startTaskCron();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log("⏱️  Cron Jobs are initialized and running..."); 
});