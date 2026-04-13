const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const prisma = new PrismaClient();
const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));
const generateMD5 = (str) => crypto.createHash('md5').update(str).digest('hex').toUpperCase();

const { verifySlipImage } = require('../services/geminiService');

const onlinePaymentSuccessNotify = async (req, res) => {
    try {
        const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } = req.body;
        const local_md5sig = generateMD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + generateMD5(process.env.PAY_HERE_MERCHANT_SECRET));

        if (local_md5sig === md5sig && parseInt(status_code) === 2) {
            const payment = await prisma.payments.findUnique({ where: { id: BigInt(order_id) }, include: { course: { include: { group: true } } } });
            const userId = payment.student_id;

            const isExists = await prisma.course_user.findFirst({ where: { user_id: userId, course_id: payment.course_id } });
            if (!isExists) await prisma.course_user.create({ data: { user_id: userId, course_id: payment.course_id, pType: payment.course.group.type } });

            if (payment.isInstallment) {
                const installments = await prisma.installments.findMany({ where: { payment_id: payment.id }, orderBy: { id: 'asc' } });
                const nextInstallment = installments.find(i => i.status === 0);
                if (nextInstallment) await prisma.installments.update({ where: { id: nextInstallment.id }, data: { pType: 'online', status: 1, approver_id: 9999 } });
                await prisma.payments.update({ where: { id: payment.id }, data: { pType: 'online', status: 1, approver_id: 9999 } });
            } else {
                await prisma.payments.update({ where: { id: payment.id }, data: { pType: 'online', status: 1, approver_id: 9999 } });
                await prisma.payments.updateMany({ where: { isLinked: true, linked: payment.id }, data: { pType: 'online', status: 1, approver_id: 9999 } });
            }
            return res.status(200).send("OK");
        } else {
            let sCode = parseInt(status_code) === 0 ? -1 : -3;
            await prisma.payments.update({ where: { id: BigInt(order_id) }, data: { pType: 'online', status: sCode } });
            return res.status(400).send("Failed");
        }
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const courseConfirm = async (req, res) => {
    try {
        const user = req.user;
        const { discountEnabled, businessID, courses, classMonth } = req.body;
        let total = 0, insTotal = 0, round = 0, mainPayment = null;
        const business = businessID ? await prisma.businesses.findUnique({ where: { id: BigInt(businessID) } }) : null;

        if (courses && Array.isArray(courses)) {
            if (business && business.category === "AL" && parseInt(discountEnabled) === 1 && business.minCourseCount && courses.length >= business.minCourseCount) {
                total -= parseFloat(business.discountAmount);
            }

            for (let courseItem of courses) {
                const [courseIdStr, payType] = courseItem.split("-");
                const course = await prisma.courses.findUnique({ where: { id: BigInt(courseIdStr) } });
                let coursePrice = course.price;

                if (round === 0) mainPayment = await prisma.payments.create({ data: { payer_id: BigInt(user.id), student_id: BigInt(user.id), course_id: course.id, status: -2, created_at: new Date() } });

                let singleSubjectPayment = coursePrice, paymentMonth = classMonth ? new Date(classMonth + '-01') : new Date();
                
                if (courses.length > 1 && payType === "full" && parseInt(discountEnabled) === 1 && course.discountedPrice < course.price) {
                    singleSubjectPayment = course.discountedPrice;
                }

                total += parseFloat(singleSubjectPayment);
                insTotal += parseFloat(coursePrice);

                if (round === 0) {
                    mainPayment = await prisma.payments.update({ where: { id: mainPayment.id }, data: { isLinked: true, subjectAmount: singleSubjectPayment, payment_month: paymentMonth } });
                    round = 1;
                } else {
                    await prisma.payments.create({ data: { payer_id: BigInt(user.id), student_id: BigInt(user.id), course_id: course.id, status: -2, isLinked: true, linked: mainPayment.id, subjectAmount: singleSubjectPayment, payment_month: paymentMonth } });
                }
            }
            mainPayment = await prisma.payments.update({ where: { id: mainPayment.id }, data: { is_discount_applied: parseInt(discountEnabled), amount: total } });
        }
        return res.status(200).json(safeJson({ mainPayment, isInstallmentAvailable: false }));
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const uploadSlip = async (req, res) => {
    try {
        const { remark, mainPaymentId, installmentPaymentId } = req.body;
        const userId = req.user.id;
        if (!req.file) return res.status(400).json({ message: "Slip image is required" });
        const imageName = req.file.filename;

        const payment = await prisma.payments.update({ where: { id: BigInt(mainPaymentId) }, data: { pType: 'slip', status: -1, slipFileName: imageName, remark: remark } });
        await prisma.payments.updateMany({ where: { isLinked: true, linked: BigInt(mainPaymentId) }, data: { pType: 'slip', status: -1, slipFileName: imageName } });
        await prisma.payments.deleteMany({ where: { student_id: BigInt(userId), status: -2 } }); 

        if (installmentPaymentId) {
            await prisma.installments.update({ where: { id: BigInt(installmentPaymentId) }, data: { status: -1, pType: 'slip', slipFileName: imageName, remark: remark } });
        }

        setTimeout(async () => {
            try {
                const isLate = payment.post_pay_date && payment.post_pay_date < new Date();
                if (isLate) return;

                // ✅ AI verification path එක public/slipImages වලට හැදුවා
                const imagePath = path.join(__dirname, '../public/slipImages/', imageName);
                const aiResult = await verifySlipImage(imagePath);
                
                if (aiResult.status === 'SUCCESS') {
                    const extractedAmount = parseFloat(aiResult.data.amount);
                    const expectedAmount = parseFloat(payment.subjectAmount || payment.amount);
                    
                    let aiStatus = 'MISMATCHED';
                    if (aiResult.data.isClear && extractedAmount >= expectedAmount) {
                        aiStatus = 'MATCHED';
                        await prisma.payments.update({ where: { id: payment.id }, data: { status: 1, approver_id: 9999 } });
                        await prisma.payments.updateMany({ where: { isLinked: true, linked: parseInt(payment.id.toString()) }, data: { status: 1, approver_id: 9999 } });
                        
                        const courseData = await prisma.courses.findUnique({ where: { id: payment.course_id }, include: { group: true }});
                        const isExists = await prisma.course_user.findFirst({ where: { user_id: BigInt(userId), course_id: payment.course_id } });
                        if (!isExists) await prisma.course_user.create({ data: { user_id: BigInt(userId), course_id: payment.course_id, pType: courseData.group.type } });
                    } else if (!aiResult.data.isClear) {
                        aiStatus = 'UNREADABLE';
                    }

                    await prisma.slip_verifications.create({
                        data: {
                            payment_id: payment.id, ai_status: aiStatus, ai_confidence: aiResult.data.isClear ? 90.0 : 40.0,
                            extracted_amount: extractedAmount, extracted_date: aiResult.data.date, extracted_ref: aiResult.data.referenceNo, raw_ai_response: aiResult.raw
                        }
                    });
                }
            } catch (e) { console.error("AI Slip Verification Error:", e); }
        }, 0);

        return res.status(200).json({ message: 'Payment Slip Uploaded! Pending Verification.' });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const enrollWithSlip = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { businessId, batchId, groupId, subjects, paymentMethodChosen } = req.body;
        const parsedSubjects = JSON.parse(subjects);
        const slipFileName = req.file ? req.file.filename : null;

        if (!slipFileName) return res.status(400).json({ error: "Bank slip image is required." });

        const group = await prisma.groups.findUnique({ where: { id: BigInt(groupId) } });
        let activeDiscount = null;
        if (group.discount_rules) {
            const rules = JSON.parse(group.discount_rules).sort((a, b) => b.courseCount - a.courseCount);
            for (let rule of rules) {
                if (parsedSubjects.length >= rule.courseCount) { activeDiscount = rule; break; }
            }
        }

        let totalAmount = 0;
        for (let subId of parsedSubjects) {
            const course = await prisma.courses.findUnique({ where: { id: BigInt(subId) } });
            totalAmount += activeDiscount ? parseFloat(activeDiscount.pricePerCourse) : parseFloat(course.price);
        }

        const isInstallmentSelected = paymentMethodChosen === 'installment'; 
        let mainPayment = null;
        let round = 0;

        for (let subId of parsedSubjects) {
            const course = await prisma.courses.findUnique({ where: { id: BigInt(subId) } });
            let singleSubjectPayment = activeDiscount ? parseFloat(activeDiscount.pricePerCourse) : parseFloat(course.price);

            if (round === 0) {
                mainPayment = await prisma.payments.create({
                    data: {
                        student_id: BigInt(studentId), payer_id: BigInt(studentId), payer_type: "App\\Models\\User", payable_type: "App\\Models\\User", payable_id: BigInt(studentId),
                        course_id: BigInt(subId), amount: totalAmount, subjectAmount: singleSubjectPayment, pType: 'slip', slipFileName: slipFileName, status: -1, 
                        isInstallment: isInstallmentSelected, approver_id: 0, isFree: 0, free_amount: 0, isLinked: parsedSubjects.length > 1, 
                        is_discount_applied: !!activeDiscount, teacher_status: false, payment_month: new Date(), created_at: new Date(), updated_at: new Date()
                    }
                });
                round = 1;
            } else {
                await prisma.payments.create({
                    data: {
                        student_id: BigInt(studentId), payer_id: BigInt(studentId), payer_type: "App\\Models\\User", payable_type: "App\\Models\\User", payable_id: BigInt(studentId),
                        course_id: BigInt(subId), amount: totalAmount, subjectAmount: singleSubjectPayment, pType: 'slip', slipFileName: slipFileName, status: -1, 
                        isInstallment: isInstallmentSelected, approver_id: 0, isFree: 0, free_amount: 0, 
                        isLinked: true, linked: parseInt(mainPayment.id.toString()),
                        is_discount_applied: !!activeDiscount, teacher_status: false, payment_month: new Date(), created_at: new Date(), updated_at: new Date()
                    }
                });
            }
        }

        if (isInstallmentSelected && mainPayment) {
            const batch = await prisma.batches.findUnique({ where: { id: BigInt(batchId) } });
            const rawInstallments = await prisma.installment_plans.findMany({ where: { batch_id: batch.id, status: 1 } });
            
            let eligiblePlan = null;
            const sortedPlans = rawInstallments.sort((a, b) => b.subjectCount - a.subjectCount);
            for (let plan of sortedPlans) {
                if (parsedSubjects.length >= plan.subjectCount) { eligiblePlan = plan; break; }
            }

            if (eligiblePlan) {
                const steps = JSON.parse(eligiblePlan.details);
                let currentDueDate = new Date();

                for (let step of steps) {
                    currentDueDate.setDate(currentDueDate.getDate() + parseInt(step.gapDays || 0));
                    
                    await prisma.installments.create({
                        data: {
                            payment_id: mainPayment.id,
                            amount: step.amount,
                            status: step.step === 1 ? -1 : 0, 
                            slipFileName: step.step === 1 ? slipFileName : null,
                            pType: step.step === 1 ? 'slip' : null,
                            due_date: new Date(currentDueDate)
                        }
                    });
                }
            }
        }

        return res.status(200).json({ message: "Enrollment submitted successfully. Awaiting verification." });
    } catch (error) { return res.status(500).json({ error: "Failed to process enrollment." }); }
};

const myPayments = async (req, res) => {
    try {
        const studentId = req.user.id;

        // 1. ඔක්කොම Payments ගන්නවා (Linked ඒවත් එක්කම)
        const allPayments = await prisma.$queryRawUnsafe(`
            SELECT p.id as paymentId, p.created_at as createdDate, p.amount as totalAmount, 
                   p.subjectAmount, p.status, p.isInstallment, p.linked, p.pType,
                   c.name as courseName, g.name as groupName, b.logo as batchLogo, b.name as batchName
            FROM payments p 
            JOIN courses c ON p.course_id = c.id 
            JOIN \`groups\` g ON c.group_id = g.id
            JOIN batches b ON g.batch_id = b.id
            WHERE p.status != -2 AND p.student_id = ${studentId}
            ORDER BY p.id DESC
        `);

        // 2. ප්‍රධාන Payments (Main) සහ අනුබද්ධ Payments (Linked) වෙන් කරගන්නවා
        const mainPayments = allPayments.filter(p => p.linked === null);
        const linkedPayments = allPayments.filter(p => p.linked !== null);

        let formatted = [];

        for (let p of mainPayments) {
            // මේ Payment එකට අදාල Linked Courses හොයාගන්නවා
            const relatedCourses = linkedPayments.filter(lp => lp.linked === parseInt(p.paymentId.toString()));
            p.linkedPayments = relatedCourses; // Frontend එක බලාපොරොත්තු වෙන field එක

            if (p.isInstallment) {
                const insts = await prisma.installments.findMany({
                    where: { payment_id: p.paymentId },
                    orderBy: { id: 'asc' }
                });
                
                p.allInstallments = insts; 
                const activeInst = insts.find(i => i.status === -1 || i.status === 0);
                
                if (activeInst) {
                    p.amount = parseFloat(activeInst.amount); 
                    p.instStatus = activeInst.status; 
                    p.dueDate = activeInst.due_date;
                    p.isFullyPaid = false;
                } else {
                    p.amount = parseFloat(p.totalAmount);
                    p.instStatus = 1;
                    p.isFullyPaid = true;
                }
            } else {
                p.amount = parseFloat(p.subjectAmount > 0 ? p.subjectAmount : p.totalAmount);
                p.isFullyPaid = p.status === 1;
            }
            formatted.push(p);
        }

        return res.status(200).json(safeJson({ oldPayments: formatted, installmentPayments: [] }));
    } catch (error) { 
        console.error("MyPayments Fetch Error:", error);
        return res.status(500).json({ message: error.message }); 
    }
};

const getPaymentsAdmin = async (req, res) => {
    try {
        const { business, batch, group, course, pType, pPlan, student, studentPhone, pStatus } = req.body;
        const userRole = req.user.role;
        const userId = req.user.id;

        let query = `
            SELECT p.id as paymentId, p.payment_month, p.created_at as createdDate, p.updated_at as updatedDate, p.pType, p.amount, p.subjectAmount, p.course_id, p.student_id, p.status, p.approver_id, p.post_pay_date, p.isInstallment, p.remark, 
            c.name as courseName, u.fName, u.lName, u.phone, p.isLinked, p.linked, p.slipFileName, p.isFree, p.free_amount, 
            b.name as batchName, g.name as groupName, g.type as groupPType, s.name as businessName,
            sv.ai_status, sv.extracted_amount
            FROM payments p
            LEFT JOIN courses c ON p.course_id = c.id
            LEFT JOIN users u ON p.student_id = u.id
            LEFT JOIN \`groups\` g ON c.group_id = g.id
            LEFT JOIN batches b ON g.batch_id = b.id
            LEFT JOIN businesses s ON b.business_id = s.id
            LEFT JOIN slip_verifications sv ON p.id = sv.payment_id
            WHERE p.linked IS NULL AND p.status != -2
        `;

        const isAdmin = userRole === 'superadmin' || userRole === 'System Admin' || userRole === 'Director' || userRole === 'admin';
        if (!isAdmin) query += ` AND (s.head_manager_id = ${userId} OR s.ass_manager_id = ${userId})`;

        if (pStatus === "pending") query += ` AND p.status = -1 AND p.post_pay_date IS NULL`;
        else if (pStatus === "approved") query += ` AND p.status = 1`;
        else if (pStatus === "rejected") query += ` AND p.status IN (-3)`;
        else if (pStatus === "postPay") query += ` AND p.status = -1 AND p.post_pay_date IS NOT NULL`;
        else if (pStatus === "late") query += ` AND p.status = -1 AND (p.post_pay_date < NOW() OR (p.post_pay_date IS NULL AND p.payment_month < NOW()))`;

        if (business) query += ` AND s.id = ${business}`;
        if (batch) query += ` AND b.id = ${batch}`;
        if (group) query += ` AND g.id = ${group}`;
        if (course) query += ` AND c.id = ${course}`;
        if (student) query += ` AND CONCAT(u.fName, ' ', u.lName) LIKE '%${student}%'`;
        if (studentPhone) query += ` AND u.phone LIKE '%${studentPhone}%'`;

        query += ` ORDER BY p.updated_at DESC, p.id DESC`;

        const payments = await prisma.$queryRawUnsafe(query);

        let formattedData = [];
        for (let p of payments) {
            let actualAmount = parseFloat(p.subjectAmount > 0 ? p.subjectAmount : (p.isFree === 2 ? p.free_amount : p.amount));
            let insts = [];

            if (p.isInstallment === 1 || p.isInstallment === true) {
                insts = await prisma.installments.findMany({
                    where: { payment_id: p.paymentId },
                    orderBy: { id: 'asc' }
                });
                const activeInst = insts.find(i => i.status === -1 || i.status === 0) || insts[insts.length - 1];
                if (activeInst) actualAmount = parseFloat(activeInst.amount);
            }

            let approverName = "Pending";
            if (p.status === 1 || p.status === -3) {
                if (p.approver_id == 9999 || p.approver_id == 9999n) approverName = "AI Bot";
                else if (p.approver_id) approverName = "Admin / Staff";
            }

            formattedData.push({
                ...p,
                installments: insts, 
                calculatedAmount: actualAmount,
                approverName: approverName,
                isLate: p.post_pay_date && new Date(p.post_pay_date) < new Date(),
                aiMatched: p.ai_status === 'MATCHED',
                slip_file_name: p.slipFileName 
            });
        }

        if (pPlan && pPlan !== "all") formattedData = formattedData.filter(p => (pPlan === "monthly" && p.groupPType === 1) || (pPlan === "full" && p.groupPType === 2));

        return res.status(200).json(safeJson({ data: formattedData, total: formattedData.length }));
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const freePayment = async (req, res) => {
    try {
        const { paymentId } = req.body;
        const approverId = req.user.id;

        const payment = await prisma.payments.update({ 
            where: { id: BigInt(paymentId) }, 
            data: { status: 1, approver_id: approverId, isFree: 1, post_pay_date: null, updated_at: new Date() } 
        });
        
        const course = await prisma.courses.findUnique({ where: { id: payment.course_id } });
        let groupType = 1;
        if (course && course.group_id) {
            const groupData = await prisma.groups.findUnique({ where: { id: course.group_id } });
            if (groupData) groupType = groupData.type;
        }

        const isExists = await prisma.course_user.findFirst({ where: { user_id: payment.student_id, course_id: payment.course_id } });
        if (!isExists) await prisma.course_user.create({ data: { user_id: payment.student_id, course_id: payment.course_id, pType: groupType } });

        await prisma.audit_trails.create({ data: { user_id: approverId, action: 'Payment Free Approved', description: `Admin marked payment ID: ${payment.id} as FREE` }});

        return res.status(200).json({ message: "Payment Marked as Free Successfully!" });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const declinePayment = async (req, res) => {
    try {
        const { paymentId } = req.body;
        const approverId = req.user.id;

        const payment = await prisma.payments.update({ where: { id: BigInt(paymentId) }, data: { status: -3, approver_id: approverId, updated_at: new Date() } });
        await prisma.course_user.deleteMany({ where: { course_id: payment.course_id, user_id: payment.student_id } });
        await prisma.audit_trails.create({ data: { user_id: approverId, action: 'Payment Declined', description: `Admin declined payment ID: ${payment.id}` }});

        return res.status(200).json({ message: "Payment Declined!" });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const revertPayment = async (req, res) => {
    try {
        const { paymentId } = req.body;
        const approverId = req.user.id;

        const payment = await prisma.payments.findUnique({ where: { id: BigInt(paymentId) } });

        if (payment.approver_id === 9999n || payment.approver_id === 9999) {
            await prisma.slip_verifications.updateMany({
                where: { payment_id: payment.id },
                data: { ai_status: 'REVERTED', is_manually_reviewed: true, reviewer_id: parseInt(approverId) }
            });
        }

        await prisma.payments.update({ where: { id: payment.id }, data: { status: -1, approver_id: 0n, isFree: 0 } });
        await prisma.course_user.deleteMany({ where: { course_id: payment.course_id, user_id: payment.student_id } });
        await prisma.audit_trails.create({ data: { user_id: approverId, action: 'Payment Reverted', description: `Admin reverted payment ID: ${payment.id} to Pending` }});

        return res.status(200).json({ message: "Payment Reverted to Pending!" });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const approvePostPay = async (req, res) => {
    try {
        const { paymentId, postPayDate } = req.body;
        const approverId = req.user.id;

        const payment = await prisma.payments.update({
            where: { id: BigInt(paymentId) },
            data: { post_pay_date: new Date(postPayDate), status: -1, approver_id: approverId, updated_at: new Date() }
        });

        const course = await prisma.courses.findUnique({ where: { id: payment.course_id } });
        let groupType = 1;
        if (course && course.group_id) {
            const groupData = await prisma.groups.findUnique({ where: { id: course.group_id } });
            if (groupData) groupType = groupData.type;
        }

        const isExists = await prisma.course_user.findFirst({ where: { user_id: payment.student_id, course_id: payment.course_id } });
        if (!isExists) await prisma.course_user.create({ data: { user_id: payment.student_id, course_id: payment.course_id, pType: groupType } });

        await prisma.audit_trails.create({ data: { user_id: approverId, action: 'Post Pay Approved', description: `Payment ID: ${payment.id} - Post Pay Date Approved until ${postPayDate}` } });

        return res.status(200).json({ message: "Post Pay Date Approved Successfully!" });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const upgradeToFullPayment = async (req, res) => {
    try {
        const { studentId, courseId } = req.body;
        const adminId = req.user.id;

        const pastPayments = await prisma.payments.findMany({
            where: { student_id: BigInt(studentId), course_id: BigInt(courseId), status: 1 }
        });

        let totalPaid = 0;
        pastPayments.forEach(p => totalPaid += parseFloat(p.subjectAmount || p.amount || 0));

        const course = await prisma.courses.findUnique({ where: { id: BigInt(courseId) }, include: { group: true } });
        const fullPrice = parseFloat(course.price);

        if (totalPaid >= fullPrice) return res.status(400).json({ message: "Student has already paid the full amount or more." });

        const balanceRequired = fullPrice - totalPaid;

        const upgradePayment = await prisma.payments.create({
            data: {
                student_id: BigInt(studentId), payer_id: BigInt(studentId), course_id: BigInt(courseId), status: -1, 
                amount: balanceRequired, subjectAmount: balanceRequired, remark: "UPGRADE_TO_FULL", pType: "slip", created_at: new Date()
            }
        });

        for (let p of pastPayments) {
            await prisma.payments.update({ where: { id: p.id }, data: { remark: "UPGRADED_TO_FULL_PART" } });
        }

        await prisma.course_user.updateMany({
            where: { user_id: BigInt(studentId), course_id: BigInt(courseId) },
            data: { pType: 2 }
        });

        await prisma.audit_trails.create({ data: { user_id: adminId, action: 'Upgrade to Full', description: `Student ${studentId} upgraded to Full. Balance Pending: Rs.${balanceRequired}` }});

        return res.status(200).json({ message: `Upgrade successful! Balance of Rs.${balanceRequired} is now Pending.`, balance: balanceRequired });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const getBotStats = async (req, res) => {
    try {
        const total = await prisma.slip_verifications.count();
        const mistakes = await prisma.slip_verifications.count({ where: { ai_status: 'REVERTED' } });
        
        let accuracy = 100;
        if (total > 0) accuracy = ((total - mistakes) / total) * 100;

        return res.status(200).json(safeJson({ totalVerifications: total, revertedMistakes: mistakes, accuracyRate: accuracy.toFixed(1) }));
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const getFinancialReports = async (req, res) => {
    try {
        const { businessId } = req.body;
        if (!businessId) return res.status(400).json({ message: "Business ID is required" });

        const payments = await prisma.$queryRawUnsafe(`
            SELECT p.id, p.amount, p.subjectAmount, p.status, p.pType, p.isInstallment, p.isFree, p.created_at, b.name as batchName, g.type as groupType
            FROM payments p JOIN courses c ON p.course_id = c.id JOIN \`groups\` g ON c.group_id = g.id JOIN batches b ON g.batch_id = b.id
            WHERE b.business_id = ${businessId}
        `);

        let totalRevenue = 0, totalEnrollments = payments.length, approvedCount = 0, pendingCount = 0, rejectedCount = 0;
        let planBreakdown = { full: 0, monthly: 0, installment: 0, free: 0 };
        let batchRevenue = {};

        payments.forEach(p => {
            const actualAmount = parseFloat(p.subjectAmount || p.amount || 0);
            if (p.status === 1) approvedCount++;
            else if (p.status === -1) pendingCount++;
            else if (p.status === -3 || p.status === -2) rejectedCount++;

            if (p.status === 1 && p.isFree !== 1) {
                totalRevenue += actualAmount;
                if (!batchRevenue[p.batchName]) batchRevenue[p.batchName] = { revenue: 0, enrollments: 0 };
                batchRevenue[p.batchName].revenue += actualAmount;
                batchRevenue[p.batchName].enrollments += 1;
            }

            if (p.isFree === 1) planBreakdown.free++;
            else if (p.isInstallment === 1) planBreakdown.installment++;
            else if (p.groupType === 1) planBreakdown.monthly++;
            else planBreakdown.full++;
        });

        const batchChartData = Object.keys(batchRevenue).map(key => ({ name: key, Revenue: batchRevenue[key].revenue, Enrollments: batchRevenue[key].enrollments })).sort((a, b) => b.Revenue - a.Revenue);
        const planChartData = [
            { name: 'Full', value: planBreakdown.full, color: '#8b5cf6' }, { name: 'Monthly', value: planBreakdown.monthly, color: '#10b981' },
            { name: 'Installments', value: planBreakdown.installment, color: '#f59e0b' }, { name: 'Free', value: planBreakdown.free, color: '#ec4899' }
        ].filter(item => item.value > 0);

        const topBatch = batchChartData.length > 0 ? batchChartData[0] : { name: 'N/A', Revenue: 0 };

        return res.status(200).json(safeJson({ totalRevenue, totalEnrollments, approvedCount, pendingCount, rejectedCount, topBatch, batchChartData, planChartData }));
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const financialDataChat = async (req, res) => {
    try {
        const { message, reportData } = req.body;
        const geminiKeyRecord = await prisma.api_keys.findFirst({ where: { type: 'gemini' } });
        if (!geminiKeyRecord || !geminiKeyRecord.api_key) return res.status(400).json({ reply: "Please configure Gemini API keys in Bot Settings first." });

        const genAI = new GoogleGenerativeAI(geminiKeyRecord.api_key);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const prompt = `You are a Senior CFO. Analyze this data and give 2-3 strategic business recommendations for growth based on the user question. Data: ${JSON.stringify(reportData)} Question: ${message}`;
        const result = await model.generateContent(prompt);
        return res.status(200).json({ reply: (await result.response).text() });
    } catch (error) { return res.status(500).json({ reply: "⚠️ API Model Error. Please try again." }); }
};

const getApiSettings = async (req, res) => {
    try {
        const keys = await prisma.api_keys.findMany();
        const geminiKeys = keys.filter(k => k.type === 'gemini');
        const bankKeys = keys.filter(k => k.type === 'bank');
        return res.status(200).json(safeJson({ geminiKeys, bankKeys }));
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const saveApiSettings = async (req, res) => {
    try {
        const { pin, geminiKeys, bankKeys, botEnabled } = req.body;
        if (pin !== "10954") return res.status(401).json({ success: false, message: "Invalid Security PIN!" });

        await prisma.api_keys.deleteMany();
        const newKeys = [];
        for (let i = 0; i < Math.min(geminiKeys.length, 5); i++) if (geminiKeys[i].api_key) newKeys.push({ type: 'gemini', api_key: geminiKeys[i].api_key });
        for (let i = 0; i < Math.min(bankKeys.length, 5); i++) if (bankKeys[i].name && bankKeys[i].api_key) newKeys.push({ type: 'bank', name: bankKeys[i].name, api_key: bankKeys[i].api_key });

        if (newKeys.length > 0) await prisma.api_keys.createMany({ data: newKeys });
        return res.status(200).json({ success: true, message: "Settings Saved!" });
    } catch (error) { return res.status(500).json({ success: false, message: error.message }); }
};

const getDropdownOptions = async (req, res) => {
    try {
        const { type, businessId, batchId, groupId, classType } = req.body;
        let data = [];

        if (type === "batch" && businessId) {
            data = await prisma.batches.findMany({ where: { business_id: BigInt(businessId), status: 1 } });
        } else if (type === "group" && batchId) {
            data = await prisma.groups.findMany({ where: { batch_id: BigInt(batchId), status: 1 } });
        } else if (type === "course" && groupId) {
            let whereClause = { group_id: BigInt(groupId), status: 1 };
            data = await prisma.courses.findMany({ where: whereClause });
        }

        return res.status(200).json(safeJson({ data }));
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const getInstallmentPaymentsAdmin = async (req, res) => {
    try {
        const { business, student } = req.body;
        const userRole = req.user.role;
        const userId = req.user.id;

        let query = `
            SELECT p.id as paymentId, p.amount, p.isInstallment, c.name as courseName, u.fName, u.lName, u.phone, b.name as batchName, s.name as businessName 
            FROM payments p 
            JOIN courses c ON p.course_id = c.id 
            JOIN users u ON p.student_id = u.id 
            JOIN \`groups\` g ON c.group_id = g.id 
            JOIN batches b ON g.batch_id = b.id 
            JOIN businesses s ON b.business_id = s.id
            WHERE p.isInstallment = 1 AND p.linked IS NULL
        `;

        const isAdmin = userRole === 'superadmin' || userRole === 'System Admin' || userRole === 'Director' || userRole === 'admin';
        if (!isAdmin) query += ` AND (s.head_manager_id = ${userId} OR s.ass_manager_id = ${userId})`;

        if (business) query += ` AND s.id = ${business}`;
        if (student) query += ` AND u.phone LIKE '%${student}%'`;

        const payments = await prisma.$queryRawUnsafe(query);
        let formattedData = [];

        for (const payment of payments) {
            const installments = await prisma.installments.findMany({ where: { payment_id: payment.paymentId }, orderBy: { id: 'asc' } });
            formattedData.push({ ...payment, installments });
        }

        return res.status(200).json(safeJson({ data: formattedData }));
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const approveInstallment = async (req, res) => {
    try {
        const { paymentId, installmentId, nextPaymentDue } = req.body;
        const approverId = req.user.id;

        // 1. අදාල Installment එක Approve කරනවා
        await prisma.installments.update({
            where: { id: BigInt(installmentId) },
            data: { status: 1, approver_id: parseInt(approverId) }
        });

        // 2. ඊළඟට ගෙවන්න තියෙන එකට අලුත් Due Date එකක් දානවා (Admin දුන්නොත්)
        if (nextPaymentDue) {
            const nextInst = await prisma.installments.findFirst({
                where: { payment_id: BigInt(paymentId), status: 0 },
                orderBy: { id: 'asc' }
            });
            if (nextInst) {
                await prisma.installments.update({
                    where: { id: nextInst.id },
                    data: { due_date: new Date(nextPaymentDue) }
                });
            }
        }

        // 3. මේකට අදාල අනිත් විෂයවල් ඔක්කොම හොයාගන්නවා (Main + Linked)
        const pIdBigInt = BigInt(paymentId);
        const pIdInt = parseInt(paymentId.toString());

        const allPayments = await prisma.payments.findMany({
            where: { OR: [{ id: pIdBigInt }, { linked: pIdInt }] }
        });

        // 4. ඔක්කොම විෂයවල් වල Status 1 කරලා, Classroom Access දෙනවා
        for (let p of allPayments) {
            await prisma.payments.update({ 
                where: { id: p.id }, 
                data: { status: 1, approver_id: parseInt(approverId) }
            });

            // ✅ FIX: include: { group: true } අයින් කරලා වෙනම Query කරනවා
            const course = await prisma.courses.findUnique({ where: { id: p.course_id } });
            if (course) {
                let groupType = 1;
                if (course.group_id) {
                    const groupData = await prisma.groups.findUnique({ where: { id: course.group_id } });
                    if (groupData) groupType = groupData.type;
                }

                const isExists = await prisma.course_user.findFirst({ where: { user_id: p.student_id, course_id: p.course_id } });
                
                if (!isExists) {
                    await prisma.course_user.create({ 
                        data: { user_id: p.student_id, course_id: p.course_id, pType: groupType } 
                    });
                }
            }
        }

        await prisma.audit_trails.create({ data: { user_id: approverId, action: 'Installment Approved', description: `Approved Phase ID: ${installmentId} and granted access.` }});

        return res.status(200).json({ message: "Installment Approved & Access Granted to all subjects!" });
    } catch (error) { 
        console.error("Installment Approve Error:", error);
        return res.status(500).json({ message: error.message }); 
    }
};


const approvePayment = async (req, res) => {
    try {
        const { paymentId, approveType } = req.body;
        const approverId = req.user.id;
        const isFree = (approveType === "free") ? 1 : 0;

        const pIdBigInt = BigInt(paymentId);
        const pIdInt = parseInt(paymentId.toString());

        const allPayments = await prisma.payments.findMany({
            where: { OR: [{ id: pIdBigInt }, { linked: pIdInt }] }
        });

        for (let p of allPayments) {
            await prisma.payments.update({ 
                where: { id: p.id }, 
                data: { status: 1, approver_id: approverId, isFree: isFree, post_pay_date: null, updated_at: new Date() } 
            });

            // ✅ FIX: මෙතනත් include: { group: true } අයින් කරලා වෙනම Query කරනවා
            const course = await prisma.courses.findUnique({ where: { id: p.course_id } });
            if (course) {
                let groupType = 1;
                if (course.group_id) {
                    const groupData = await prisma.groups.findUnique({ where: { id: course.group_id } });
                    if (groupData) groupType = groupData.type;
                }

                const isExists = await prisma.course_user.findFirst({ where: { user_id: p.student_id, course_id: p.course_id } });
                if (!isExists) {
                    await prisma.course_user.create({ data: { user_id: p.student_id, course_id: p.course_id, pType: groupType } });
                }
            }
        }

        await prisma.audit_trails.create({ data: { user_id: approverId, action: 'Payment Approved', description: `Admin approved payment ID: ${paymentId}` }});
        return res.status(200).json({ message: "Payment Approved Successfully!" });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const deleteInstallment = async (req, res) => {
    try {
        const { installmentId } = req.body;
        const approverId = req.user.id;

        await prisma.installments.update({
            where: { id: BigInt(installmentId) },
            data: { status: 0, slipFileName: null, pType: null, remark: "REJECTED" }
        });

        await prisma.audit_trails.create({ data: { user_id: approverId, action: 'Installment Rejected', description: `Rejected Phase ID: ${installmentId}` }});

        return res.status(200).json({ message: "Installment Rejected. Student can re-upload." });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

module.exports = { 
    onlinePaymentSuccessNotify, courseConfirm, uploadSlip, myPayments, getPaymentsAdmin, 
    getInstallmentPaymentsAdmin, approvePayment, declinePayment, revertPayment,
    upgradeToFullPayment, getBotStats, getFinancialReports, financialDataChat, getApiSettings,
    saveApiSettings, getDropdownOptions, approvePostPay, freePayment,
    approveInstallment, deleteInstallment, enrollWithSlip
};