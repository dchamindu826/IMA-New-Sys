const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const safeJson = (data) => JSON.parse(JSON.stringify(data, (key, value) => typeof value === 'bigint' ? value.toString() : value));

// --- 1. Create User (Register) ---
const createUser = async (req, res) => {
    try {
        const { fName, lName, phone, nic, password, role } = req.body;

        const existingUser = await prisma.users.findFirst({
            where: { OR: [{ phone: phone }, { nic: nic }] }
        });

        if (existingUser) {
            return res.status(401).json({ message: "Validation error: Phone number or NIC already exists!" });
        }

        let imageName = req.file ? req.file.filename : 'default.png';
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.users.create({
            data: {
                fName, lName, password: hashedPassword, phone, nic,
                role: role || 'user', image: imageName, status: 1,
                created_at: new Date(), updated_at: new Date()
            }
        });

        return res.status(200).json({
            message: 'User Created Successfully',
            user: safeJson(user)
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// --- 2. Login User ---
const loginUser = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(401).json({ message: 'Validation error: Username and Password are required.' });
        }

        // is_numeric checks if it's a number, length < 11 checks if it's a phone number length
        const isNumeric = /^\d+$/.test(username);
        const field = (isNumeric && username.length < 11) ? 'phone' : 'nic';

        const user = await prisma.users.findFirst({
            where: { [field]: username }
        });

        if (!user) {
            return res.status(401).json({ message: 'NIC / Phone & Password does not match with our record.' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'NIC / Phone & Password does not match with our record.' });
        }

        if (user.status === 0 || user.status === -1) {
            return res.status(401).json({ message: 'The account is inactive.' });
        }

        // Audit Trail
        if (user.role !== 'user') {
            await prisma.audit_trails.create({
                data: {
                    user_id: user.id,
                    action: 'User Login',
                    description: `User ${user.fName} logged into the system via portal.`,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });
        }

        // 🔥 FIX: Secret Key එක හැමතැනම සමාන කරා (campus_super_secret_key_2026) 🔥
        const token = jwt.sign(
            { id: user.id.toString(), role: user.role, fName: user.fName, lName: user.lName }, 
            process.env.JWT_SECRET || 'campus_super_secret_key_2026', 
            { expiresIn: '30d' }
        );

        return res.status(200).json({
            message: 'User Logged In Successfully',
            user: safeJson(user),
            token: token
        });

    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({ message: error.message, user: null, token: null });
    }
};

// --- 3. Logout User ---
const logoutUser = async (req, res) => {
    try {
        const user = req.user; 
        
        // 🔥 FIX: Code Duplication අයින් කළා 🔥
        if (user && user.role !== 'user') {
            await prisma.audit_trails.create({
                data: {
                    user_id: BigInt(user.id),
                    action: 'User Logout',
                    description: `User ${user.fName} logged out from the system.`,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });
        }
        
        return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createUser,
    loginUser,
    logoutUser
};