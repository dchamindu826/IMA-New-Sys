// backend/controllers/bridgeController.js

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

const checkStudentLms = async (req, res) => {
    try {
        let phone = req.params.phone;

        // 🔥 FIX: ෆෝන් නම්බර් එකේ තියෙන ඔක්කොම අකුරු/ලකුණු (Spaces, + , -) අයින් කරනවා 🔥
        let cleanPhone = phone.replace(/\D/g, ''); 

        // 🔥 FIX: අග තියෙන ඉලක්කම් 9 විතරක් ගන්නවා. (උදා: 714941559) 🔥
        const last9Digits = cleanPhone.slice(-9);

        // නම්බර් එකෙන් ළමයව හොයනවා. (පොඩිම කෑල්ලෙන් හොයන නිසා කොහොම ලියලා තිබ්බත් අහුවෙනවා!)
        const student = await prisma.users.findFirst({
            where: { 
                phone: { endsWith: last9Digits }, // EndsWith එකෙන් හොයනවා
                role: 'user' 
            }
        });

        if (!student) return res.status(200).json({ found: false });

        // ළමයාගේ Courses සහ Payments ගන්නවා
        const courseUsers = await prisma.course_user.findMany({ where: { user_id: student.id } });
        const courseIds = courseUsers.map(c => c.course_id);
        
        const courses = await prisma.courses.findMany({
            where: { id: { in: courseIds } },
            include: { group: { include: { batch: { include: { business: true } } } } }
        });

        const payments = await prisma.payments.findMany({
            where: { student_id: student.id, course_id: { in: courseIds } }
        });

        const activeCourses = courses.map(c => {
            const payment = payments.find(p => p.course_id.toString() === c.id.toString());
            return {
                enrollment_id: c.id.toString(),
                course_name: c.name,
                batch_name: c.group?.batch?.name,
                business_name: c.group?.batch?.business?.name,
                course_price: c.price,
                plan_type: payment && payment.isInstallment ? 2 : 1, // 1=Full, 2=Monthly
                current_discount: payment ? payment.free_amount : 0
            };
        });

        res.status(200).json(safeJson({ 
            found: true, 
            student: { id: student.id, name: `${student.fName} ${student.lName}`, nic: student.nic, courses: activeCourses } 
        }));
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

module.exports = { checkStudentLms, updatePassword, updateEnrollmentPlan };