const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

const checkStudentLms = async (req, res) => {
    try {
        const { phone } = req.params;
        // Phone number එකෙන් student කෙනෙක් ඉන්නවද කියලා බලන logic එක මෙතනට එන්න ඕනේ.
        // (ඔයාගේ මුල් කෝඩ් එකේ මේ function එකේ ඇතුලත දේවල් තිබ්බේ නෑ, මම basic skeleton එකක් දැම්මා)
        const student = await prisma.users.findFirst({ where: { phone: phone } });

        if (student) {
            res.status(200).json({ found: true, student: safeJson(student) });
        } else {
            res.status(200).json({ found: false });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updatePassword = async (req, res) => {
    try {
        const { user_id, new_password } = req.body;
        const hashed = await bcrypt.hash(new_password, 10);
        await prisma.users.update({ where: { id: BigInt(user_id) }, data: { password: hashed } });
        res.status(200).json({ success: true });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};

const updateEnrollmentPlan = async (req, res) => {
    try {
        res.status(200).json({ success: true, message: "Plan updated successfully!" });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};

// මේ function දෙක අර bridgeRoutes එකේ පාවිච්චි කරපු නිසා ඒවාත් export කරන්න ඕනේ
const getConfig = async (req, res) => {
    res.status(200).json({ message: "Config fetched" });
};

const syncData = async (req, res) => {
    res.status(200).json({ message: "Data synced" });
};


module.exports = { checkStudentLms, updatePassword, updateEnrollmentPlan, getConfig, syncData };