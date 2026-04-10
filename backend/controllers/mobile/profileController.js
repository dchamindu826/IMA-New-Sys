const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const updateProfile = async (req, res) => {
    res.status(200).json({ message: "Profile Updated Successfully (Mobile API)" });
};

const updateProfilePic = async (req, res) => {
    res.status(200).json({ message: "Profile Picture Updated (Mobile API)" });
};

module.exports = { updateProfile, updateProfilePic };