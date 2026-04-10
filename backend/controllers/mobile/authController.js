const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 1. Mobile App Login
const login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ message: "Phone and password are required" });
        }

        // User ව Database එකෙන් හොයනවා
        const user = await prisma.users.findFirst({ where: { phone: phone } });

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials. User not found." });
        }

        // Password එක හරිද කියලා බලනවා
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials. Incorrect password." });
        }

        // Token එක හදනවා (App එකේ Login එක තියාගන්න)
        const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '30d' });

        // App එකේ Profile එක පෙන්නන්න ඕන Data ටික යවනවා
        res.status(200).json({
            message: "Login Successful",
            token,
            user: {
                id: user.id,
                fName: user.fName,
                lName: user.lName,
                phone: user.phone,
                directPhone: user.directPhone,
                nic: user.nic,
                image: user.image || 'default.png',
                houseNo: user.houseNo,
                streetName: user.streetName,
                village: user.village,
                town: user.town,
                district: user.district
            }
        });

    } catch (error) {
        console.error("Mobile Login Error:", error);
        res.status(500).json({ message: "Server error during login" });
    }
};

// 2. Mobile App Register
const register = async (req, res) => {
    try {
        // App එකෙන් එවන Data ටික
        const { fName, lName, phone, directPhone, nic, password, houseNoVal, streetNameVal, villageVal, townVal, districtVal } = req.body;

        // මේ Phone Number එක දැනටමත් තියෙනවද බලනවා
        const existingUser = await prisma.users.findFirst({ where: { phone: phone } });
        if (existingUser) {
            return res.status(400).json({ message: "Phone number is already registered. Please login." });
        }

        // Password එක Hash කරනවා (ආරක්ෂාවට)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // අලුත් User ව Database එකට දානවා
        const newUser = await prisma.users.create({
            data: {
                fName,
                lName,
                phone,
                directPhone: directPhone || null,
                nic,
                password: hashedPassword,
                houseNo: houseNoVal || null,
                streetName: streetNameVal || null,
                village: villageVal || null,
                town: townVal || null,
                district: districtVal || null,
                role: 'user', // Default Role එක
                status: 1
            }
        });

        res.status(201).json({ message: "Account created successfully!" });

    } catch (error) {
        console.error("Mobile Register Error:", error);
        res.status(500).json({ message: "Server error during registration. Please try again." });
    }
};

module.exports = { login, register };