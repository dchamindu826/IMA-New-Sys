const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getHomeData = async (req, res) => {
    res.status(200).json({ message: "Home Data Working (Mobile API)" });
};

module.exports = { getHomeData };