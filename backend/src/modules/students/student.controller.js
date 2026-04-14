const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const prisma = new PrismaClient();

const { verifySlipImage } = require('../../services/geminiService');

BigInt.prototype.toJSON = function() {
    return this.toString();
};

const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// --- 1. Dashboard Data ---
const index = async (req, res) => {
    try {
        const user = req.user;
        const courseUsers = await prisma.course_user.findMany({ where: { user_id: BigInt(user.id) }});
        
        const registeredCourseIds = [...new Set(courseUsers.map(cu => cu.course_id))];
        const courses = await prisma.courses.findMany({ where: { id: { in: registeredCourseIds } } });
        const registeredGroupIds = [...new Set(courses.map(c => c.group_id))];
        const groups = await prisma.groups.findMany({ where: { id: { in: registeredGroupIds } } });
        const registeredBatches = [...new Set(groups.map(g => g.batch_id))];
        const batches = await prisma.batches.findMany({ where: { id: { in: registeredBatches } } });
        const registeredBusinesses = [...new Set(batches.map(b => b.business_id))];

        const announcements = await prisma.announcements.findMany({
            where: { OR: [{ business_id: null }, { business_id: { in: registeredBusinesses } }], AND: { OR: [{ batch_id: null }, { batch_id: { in: registeredBatches } }] } }, orderBy: { id: 'desc' }
        });
        const posts = await prisma.posts.findMany({
            where: { OR: [{ business_id: null }, { business_id: { in: registeredBusinesses } }], AND: { OR: [{ batch_id: null }, { batch_id: { in: registeredBatches } }] } }, orderBy: { id: 'desc' }
        });

        return res.status(200).json(safeJson({ registeredBusinesses: [...registeredBusinesses, 'All'], announcements, posts }));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// --- 2. ClassRoom View ---
const classRoom = async (req, res) => {
    try {
        const user = req.user;
        
        const approvedPayments = await prisma.payments.findMany({
            where: { student_id: BigInt(user.id), status: 1 }
        });

        for (let p of approvedPayments) {
            const isExists = await prisma.course_user.findFirst({
                where: { user_id: BigInt(user.id), course_id: p.course_id }
            });
            
            if (!isExists) {
                const course = await prisma.courses.findUnique({ where: { id: p.course_id } });
                if (course) {
                    let groupType = 1;
                    if (course.group_id) {
                        const groupData = await prisma.groups.findUnique({ where: { id: course.group_id } });
                        if (groupData) groupType = groupData.type;
                    }
                    await prisma.course_user.create({
                        data: { user_id: BigInt(user.id), course_id: p.course_id, pType: groupType }
                    });
                }
            }
        }

        const enrolledRecords = await prisma.course_user.findMany({ where: { user_id: BigInt(user.id) } });
        const registeredCourseIds = [...new Set(enrolledRecords.map(c => c.course_id))];

        if (registeredCourseIds.length === 0) return res.status(200).json(safeJson({ businesses: [] }));

        const courses = await prisma.courses.findMany({ where: { id: { in: registeredCourseIds }, status: 1 } });
        const registeredGroupIds = [...new Set(courses.map(c => c.group_id))];

        const groups = await prisma.groups.findMany({ where: { id: { in: registeredGroupIds }, status: 1 }, orderBy: { itemOrder: 'asc' } });
        const registeredBatchIds = [...new Set(groups.map(g => g.batch_id))];

        const batches = await prisma.batches.findMany({ where: { id: { in: registeredBatchIds }, status: 1 }, orderBy: { itemOrder: 'asc' } });
        const registeredBusinessIds = [...new Set(batches.map(b => b.business_id))];

        const rawBusinesses = await prisma.businesses.findMany({ where: { id: { in: registeredBusinessIds }, status: 1 } });

        const businesses = rawBusinesses.map(biz => {
            const bizBatches = batches.filter(b => b.business_id.toString() === biz.id.toString()).map(batch => {
                const batchGroups = groups.filter(g => g.batch_id.toString() === batch.id.toString()).map(group => {
                    const groupCourses = courses.filter(c => c.group_id.toString() === group.id.toString());
                    return { ...group, courses: groupCourses };
                });
                return { ...batch, groups: batchGroups };
            });
            return { ...biz, batches: bizBatches };
        });

        return res.status(200).json(safeJson({ businesses }));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// --- 3. View Module ---
const viewModule = async (req, res) => {
    try {
        const user = req.user;
        const { courseId } = req.params;

        const course = await prisma.courses.findUnique({ where: { id: BigInt(courseId) } });
        let courseDetails = course ? { ...course } : null;

        if (courseDetails && courseDetails.group_id) {
            courseDetails.group = await prisma.groups.findUnique({ where: { id: courseDetails.group_id } });
            if (courseDetails.group && courseDetails.group.batch_id) {
                courseDetails.group.batch = await prisma.batches.findUnique({ where: { id: courseDetails.group.batch_id } });
                if (courseDetails.group.batch && courseDetails.group.batch.business_id) {
                    courseDetails.group.batch.business = await prisma.businesses.findUnique({ where: { id: courseDetails.group.batch.business_id } });
                }
            }
        }

        const contentCourseLinks = await prisma.content_course.findMany({
            where: { course_id: BigInt(courseId) }
        });
        const contentIds = [...new Set(contentCourseLinks.map(link => link.content_id))];

        const getContents = async (type) => {
            if (contentIds.length === 0) return [];
            return await prisma.contents.findMany({
                where: { type: type, id: { in: contentIds } },
                orderBy: { date: 'asc' }
            });
        };
        
        const liveClasses = await getContents(1);
        const recordings = await getContents(2);
        const documents = await getContents(3);
        const papers = await getContents(4);
        const sPapers = await getContents(5);

        const allContents = [...liveClasses, ...recordings, ...documents, ...papers, ...sPapers];
        const usedFolderIds = [...new Set(allContents.map(c => c.content_group_id).filter(id => id != null))];

        let safeCode = courseDetails?.code || `SUB_${courseDetails?.id}`;
        let batchId = courseDetails?.group?.batch_id || BigInt(0);

        const lessonGroups = await prisma.content_groups.findMany({
            where: {
                OR: [
                    { batch_id: batchId, course_code: safeCode },
                    { id: { in: usedFolderIds.map(id => BigInt(id)) } }
                ]
            },
            orderBy: { itemOrder: 'asc' }
        });

        let paidStatus = 0;
        const payment = await prisma.payments.findFirst({ 
            where: { course_id: BigInt(courseId), student_id: BigInt(user.id), status: { notIn: [-2, -3] } }, 
            orderBy: { id: 'desc' } 
        });
        
        if (payment) {
            paidStatus = payment.status;

            const hasGracePeriod = payment.post_pay_date && new Date(payment.post_pay_date) >= new Date();
            if (hasGracePeriod) paidStatus = 1;

            if ((payment.isInstallment === 1 || payment.isInstallment === true) && paidStatus === 1) {
                let mainPaymentId = payment.id;
                if (payment.isLinked && payment.linked) mainPaymentId = BigInt(payment.linked);
                
                const overdueInstallment = await prisma.installments.findFirst({
                    where: { payment_id: mainPaymentId, status: 0 } 
                });

                if (overdueInstallment && overdueInstallment.due_date) {
                    const dueDate = new Date(overdueInstallment.due_date);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    
                    if (dueDate < today && !hasGracePeriod) {
                        paidStatus = 0; 
                    }
                }
            }
        }

        return res.status(200).json(safeJson({ 
            liveClasses, recordings, documents, papers, sPapers, lessonGroups,
            paidStatus, course: courseDetails 
        }));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const viewZoom = async (req, res) => {
    try {
        const { content_id } = req.body;
        const content = await prisma.contents.findUnique({ where: { id: BigInt(content_id) } });
        const attendance = await prisma.attendances.findFirst({ where: { content_id: BigInt(content_id), user_id: BigInt(req.user.id) } });
        if (!attendance) await prisma.attendances.create({ data: { user_id: BigInt(req.user.id), content_id: BigInt(content_id), created_at: new Date() } });
        return res.status(200).json({ zoomLink: content.link });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const viewYoutubeLive = async (req, res) => {
    try {
        const { content_id } = req.body;
        const content = await prisma.contents.findUnique({ where: { id: BigInt(content_id) } });
        let link = content.link;
        if (link.includes('youtube.com/live')) link = "https://www.youtube.com/embed/" + link.split("live/")[1];
        else if (link.includes('v=')) link = "https://www.youtube.com/embed/" + link.split("v=").pop();
        else if (link.includes('youtu.be/')) link = "https://www.youtube.com/embed/" + link.split("youtu.be/").pop().split("?")[0];

        const attendance = await prisma.attendances.findFirst({ where: { content_id: BigInt(content_id), user_id: BigInt(req.user.id) } });
        if (!attendance) await prisma.attendances.create({ data: { user_id: BigInt(req.user.id), content_id: BigInt(content_id), created_at: new Date() } });
        return res.status(200).json({ youtubeLink: link });
    } catch (error) { return res.status(500).json({ message: error.message }); }
};

const startExam = async (req, res) => { return res.status(200).json({ message: 'Exam Ready!' }); };
const paperComplete = async (req, res) => { return res.status(200).json({ message: 'Exam Completed Successfully!' }); };
const addUserAnswer = async (req, res) => { return res.status(200).json({ message: 'Answer Submitted Successfully!' }); };
const updateUserAnswer = async (req, res) => { return res.status(200).json({ message: 'Answer Updated Successfully!' }); };
const getDownloadRecording = async (req, res) => { return res.status(200).json({ message: 'Download ready' }); };

// 🔥 1. getStudentDashboard එක Update කිරීම (Live Class & Posts යවන්න) 🔥
const getStudentDashboard = async (req, res) => {
    try {
        const userId = req.user.id; 
        const enrolledCourses = await prisma.course_user.findMany({ where: { user_id: BigInt(userId) } });
        const courseIds = enrolledCourses.map(e => e.course_id);

        const courses = await prisma.courses.findMany({ where: { id: { in: courseIds } } });
        const groupIds = [...new Set(courses.map(c => c.group_id))];
        const groups = await prisma.groups.findMany({ where: { id: { in: groupIds } } });
        const batchIds = [...new Set(groups.map(g => g.batch_id))];
        const batches = await prisma.batches.findMany({ where: { id: { in: batchIds } } });
        const businessIds = [...new Set(batches.map(b => b.business_id))];

        const posts = await prisma.posts.findMany({
            where: { OR: [{ business_id: null, batch_id: null }, { business_id: { in: businessIds } }, { batch_id: { in: batchIds } }] },
            orderBy: { created_at: 'desc' }, take: 15
        });

        let alerts = [];
        const userInstallmentPayments = await prisma.payments.findMany({
            where: { student_id: BigInt(userId), isInstallment: true, status: { notIn: [-2, -3] } }
        });

        const unpaidInstallments = await prisma.installments.findMany({ where: { status: 0 } });
        const now = new Date();
        now.setHours(0,0,0,0);

        for (let payment of userInstallmentPayments) {
            let mainPaymentId = payment.id;
            if (payment.isLinked && payment.linked) mainPaymentId = BigInt(payment.linked);
            
            const nextInst = unpaidInstallments.find(i => i.payment_id === mainPaymentId);
            if (nextInst && nextInst.due_date) {
                const dueDate = new Date(nextInst.due_date);
                const timeDiff = dueDate.getTime() - now.getTime();
                const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                const hasGracePeriod = payment.post_pay_date && new Date(payment.post_pay_date) >= now;

                const course = courses.find(c => c.id === payment.course_id);
                const courseName = course ? course.name : "your subject";

                if (daysLeft <= 5 && daysLeft > 1) {
                    alerts.push({ type: 'warning', msg: `Reminder: Installment of LKR ${nextInst.amount} for ${courseName} is due in ${daysLeft} days.` });
                } else if (daysLeft === 1 || daysLeft === 0) {
                    alerts.push({ type: 'danger', msg: `URGENT: Installment of LKR ${nextInst.amount} for ${courseName} is due within 24 Hours! Access will be locked.` });
                } else if (daysLeft < 0 && !hasGracePeriod) {
                    alerts.push({ type: 'locked', msg: `LOCKED: Access to ${courseName} is disabled due to an unpaid installment. Please pay to unlock.` });
                }
            }
        }

        const contentLinks = await prisma.content_course.findMany({ where: { course_id: { in: courseIds } } });
        const contentIds = [...new Set(contentLinks.map(l => l.content_id))];
        
        const upcomingLive = await prisma.contents.findFirst({
            where: { 
                id: { in: contentIds }, 
                type: 1, 
                date: { gte: new Date() } 
            },
            orderBy: { date: 'asc' }
        });

        let liveClassData = null;
        if (upcomingLive) {
            const relatedLink = contentLinks.find(l => l.content_id === upcomingLive.id);
            const relatedCourse = courses.find(c => c.id === relatedLink?.course_id);
            liveClassData = { ...upcomingLive, courseName: relatedCourse?.name || "Live Class" };
        }

        return res.status(200).json(safeJson({ enrolledCount: courseIds.length, posts, alerts, upcomingLive: liveClassData }));
    } catch (error) {
        return res.status(500).json({ message: "Server Error" });
    }
};

// 🔥 2. AI Chatbot Controller (Context Aware) 🔥
// 🔥 2. AI Chatbot Controller (Context Aware & Full DB Knowledge) 🔥
const studentAIChat = async (req, res) => {
    try {
        const { message, messageCount } = req.body;
        const userId = req.user.id;

        if (messageCount >= 3) {
            return res.status(200).json({ 
                reply: "ඔබගේ ගැටළුව අපගේ කාර්ය මණ්ඩලයට යොමු කර ඇත. ඔවුන් ඉක්මනින් ඔබව සම්බන්ධ කරගනු ඇත. (Your inquiry has been escalated to our Support Staff.)", 
                escalated: true 
            });
        }

        // 1. ළමයාගේ දත්ත
        const student = await prisma.users.findUnique({ where: { id: BigInt(userId) } });
        const enrolled = await prisma.course_user.findMany({ where: { user_id: BigInt(userId) } });
        const courseNames = [];
        for (let e of enrolled) {
            const c = await prisma.courses.findUnique({ where: { id: e.course_id } });
            if (c) courseNames.push(c.name);
        }
        const pendingPayments = await prisma.payments.count({ where: { student_id: BigInt(userId), status: { in: [-1, 0] } } });

        // 2. මුළු කැම්පස් එකේම දත්ත සාරාංශය (AI එකට ඉගෙනගන්න)
        const allCourses = await prisma.courses.findMany({ where: { status: 1 } });
        let dbKnowledge = allCourses.map(c => `- ${c.name} (Code: ${c.code || 'N/A'}): LKR ${c.price}`).join('\n');

        const geminiKeyRecord = await prisma.api_keys.findFirst({ where: { type: 'gemini' } });
        if (!geminiKeyRecord || !geminiKeyRecord.api_key) return res.status(400).json({ reply: "AI Bot is currently offline." });

        const genAI = new GoogleGenerativeAI(geminiKeyRecord.api_key);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // 3. AI Prompt එක (Singlish / Sinhala නීති ඇතුලුව)
        const prompt = `You are a highly intelligent, polite, and helpful Customer Support AI Assistant for "IMA Campus". 
        
        ABOUT THE CAMPUS (Use this to answer user questions):
        Available Courses & Fees:
        ${dbKnowledge}
        (Note: We offer bundle discounts for multiple subjects and flexible monthly installment plans).

        ABOUT THIS STUDENT:
        Name: ${student.fName} ${student.lName}. 
        Enrolled Subjects: ${courseNames.join(', ') || 'Not enrolled yet'}. 
        Pending Payments: ${pendingPayments > 0 ? 'Has pending dues' : 'All clear'}.
        
        LANGUAGE RULES (CRITICAL):
        1. If the user asks the question in English, reply in English.
        2. If the user asks in "Singlish" (Sinhala words typed in English letters, e.g., "Mata visthara kiyanna", "Kohomada class ekata yanne"), you MUST reply ONLY in standard Sinhala Script (සිංහල අකුරෙන්). Do not reply in English or Singlish.
        3. Keep the answers concise, friendly, and directly helpful.

        User Question: "${message}"`;

        const result = await model.generateContent(prompt);
        return res.status(200).json({ reply: (await result.response).text(), escalated: false });

    } catch (error) {
        return res.status(500).json({ reply: "⚠️ AI සර්වර් එක සමඟ සම්බන්ධ වීමේ දෝෂයකි." });
    }
};

const getAvailableEnrollments = async (req, res) => {
    try {
        const rawBusinesses = await prisma.businesses.findMany({ where: { status: 1 }, orderBy: { id: 'desc' } });
        const rawBatches = await prisma.batches.findMany({ where: { status: 1 }, orderBy: { itemOrder: 'asc' } });
        const rawGroups = await prisma.groups.findMany({ where: { status: 1 }, orderBy: { itemOrder: 'asc' } });
        const rawCourses = await prisma.courses.findMany({ where: { status: 1 }, orderBy: { itemOrder: 'asc' } });
        const rawInstallments = await prisma.installment_plans.findMany({ where: { status: 1 } });

        const businesses = rawBusinesses.map(biz => {
            const bBatches = rawBatches.filter(b => b.business_id.toString() === biz.id.toString()).map(batch => {
                    const bGroups = rawGroups.filter(g => g.batch_id.toString() === batch.id.toString()).map(group => {
                            const gCourses = rawCourses.filter(c => c.group_id.toString() === group.id.toString());
                            return { ...group, courses: gCourses };
                        });
                    const batchInstallments = rawInstallments.filter(i => i.batch_id.toString() === batch.id.toString());
                    return { ...batch, groups: bGroups, installment_plans_parsed: batchInstallments };
                });
            return { ...biz, batches: bBatches };
        });

        res.status(200).json(safeJson({ businesses }));
    } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
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
    } catch (error) { 
        return res.status(500).json({ error: "Failed to process enrollment." }); 
    }
};

// 1. Update Profile Details & Image
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { fName, lName } = req.body;
        
        let updateData = { 
            fName, 
            lName, 
            updated_at: new Date() 
        };

        // File එකක් ඇවිත් තියෙනවද බලනවා
        if (req.file) {
            updateData.image = req.file.filename;
        }

        const updatedUser = await prisma.users.update({
            where: { id: BigInt(userId) },
            data: updateData
        });

        res.status(200).json({ 
            message: "Profile updated successfully", 
            image: updatedUser.image 
        });
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ message: "Failed to update profile" });
    }
};

// 2. Change Password
const updatePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        const user = await prisma.users.findUnique({ where: { id: BigInt(userId) }});
        
        // පරණ Password එක හරිද කියලා බලනවා
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Current password is incorrect!" });
        }

        // අලුත් Password එක Hash කරනවා
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        await prisma.users.update({
            where: { id: BigInt(userId) },
            data: { 
                password: hashedPassword, 
                updated_at: new Date() 
            }
        });

        res.status(200).json({ message: "Password changed successfully!" });
    } catch (error) {
        console.error("Password Update Error:", error);
        res.status(500).json({ message: "Failed to change password" });
    }
};

module.exports = { 
    index, classRoom, viewModule, viewZoom, viewYoutubeLive, startExam, 
    paperComplete, addUserAnswer, updateUserAnswer, getDownloadRecording, getStudentDashboard,
    getAvailableEnrollments, enrollWithSlip, studentAIChat, updateProfile, updatePassword
};