const express = require('express');
const cors = require('cors');
const path = require('path'); 
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const taskRoutes = require('./routes/taskRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const financeRoutes = require('./routes/financeRoutes');
const publicRoutes = require('./routes/publicRoutes');
const courseSetupRoutes = require('./routes/courseSetupRoutes');
const contentHubRoutes = require('./routes/contentHubRoutes');
const templateRoutes = require('./routes/templateRoutes');

// 🔥 CRM සහ Team වලට අදාල අලුත් සහ පරණ Routes 🔥
const crmRoutes = require('./routes/crmRoutes'); 
const teamRoutes = require('./routes/teamRoutes');

// 🚀 Webhook Controller එක මෙතනින් Import කරගන්න 🚀
const whatsappWebhookController = require('./controllers/whatsappWebhookController');

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
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', financeRoutes);
app.use('/api', publicRoutes); 
app.use('/api/course-setup', courseSetupRoutes);
app.use('/api/admin/manager', contentHubRoutes);
app.use('/api/templates', templateRoutes);

// 🔥 LMS / Right Panel Routes (ඔයා අලුතින් හදපු එක) 🔥
app.use('/api/bridge', require('./routes/bridgeRoutes'));

// --- CRM & TEAM ROUTES ---
app.use('/api/crm', crmRoutes); 
app.use('/api/team', teamRoutes); 

// 🔥 Mobile App එකට අදාල සම්පූර්ණ Routes මෙතනින් යන්නේ 🔥
app.use('/api/mobile', require('./routes/mobile/mobileRoutes'));

// 🚀 අලුත් Webhook Routes දෙක මෙතනින් දාන්න 🚀
// Meta එකෙන් Verify කරගන්න (GET)
app.get('/api/webhook', whatsappWebhookController.verifyWebhook);
// Meta එකෙන් මැසේජ් එවද්දි (POST)
app.post('/api/webhook', whatsappWebhookController.handleIncomingMessage);

// 🔥 ඔයාගේ පරණ Routes ෆයිල්ස් තියෙනවා නම් ඒවත් මෙතනින් Map කරන්න 🔥
try { app.use('/api/crm', require('./routes/contacts')); } catch(e) {} 
try { app.use('/api/broadcast', require('./routes/broadcast')); } catch(e) {} 
try { app.use('/api/templates', require('./routes/templates')); } catch(e) {} 
try { app.use('/api/quick-replies', require('./routes/quick_replies')); } catch(e) {} 

const startTaskCron = require('./cron/taskCron');

const PORT = process.env.PORT || 5000;

// 🔥 2. Server එක Start වෙද්දීම Cron එකත් Start කරන්න 🔥
startTaskCron();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log("⏱️  Cron Jobs are initialized and running..."); // මේකත් දාන්න, එතකොට Terminal එකේ පෙනෙයි
});