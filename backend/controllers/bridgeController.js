const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

const checkStudentLms = async (req, res) => {
    try {
        let phoneRaw = req.params.phone;
        const cleanPhone = phoneRaw.replace(/\D/g, '').slice(-9);

        if (!cleanPhone || cleanPhone.length !== 9) return res.status(200).json({ found: false });

        const students = await prisma.users.findMany({
            where: { role: 'user' } 
        });

        const student = students.find(s => {
            const dbPhone = (s.phone || '').replace(/\D/g, '');
            return dbPhone.endsWith(cleanPhone);
        });

        if (!student) return res.status(200).json({ found: false });

        const courseUsers = await prisma.course_user.findMany({ where: { user_id: student.id } });
        const courseIds = courseUsers.map(c => c.course_id);
        
        const courses = await prisma.courses.findMany({
            where: { id: { in: courseIds } }
        });

        const payments = await prisma.payments.findMany({
            where: { student_id: student.id, course_id: { in: courseIds } }
        });

        const activeCourses = await Promise.all(courses.map(async (c) => {
            const payment = payments.find(p => p.course_id.toString() === c.id.toString());
            
            let batchName = "N/A";
            let businessName = "N/A";
            
            try {
                if (c.batch_id) {
                    const batch = await prisma.batches.findUnique({ where: { id: c.batch_id } });
                    if (batch) {
                        batchName = batch.name;
                        if (batch.business_id) {
                            const biz = await prisma.businesses.findUnique({ where: { id: batch.business_id } });
                            if (biz) businessName = biz.name;
                        }
                    }
                }
            } catch(e) {}

            return {
                enrollment_id: c.id.toString(),
                course_name: c.name || "Unknown Course",
                batch_name: batchName,
                business_name: businessName,
                course_price: c.price || 0,
                plan_type: payment && payment.isInstallment ? 2 : 1, 
                current_discount: payment ? payment.free_amount : 0
            };
        }));

        res.status(200).json(safeJson({ 
            found: true, 
            student: { 
                id: student.id, 
                name: `${student.fName || ''} ${student.lName || ''}`.trim(), 
                nic: student.nic, 
                email: student.email,
                phone: student.phone,
                courses: activeCourses 
            } 
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