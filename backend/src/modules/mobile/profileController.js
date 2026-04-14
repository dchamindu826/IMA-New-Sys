const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 🔥 Update Profile Details & Image 🔥
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        // Frontend එකෙන් එන හැම Data එකම අල්ලගන්නවා (phone, nic ඇරෙන්න අනිත් ඒවා)
        const { fName, lName, directPhone, houseNo, streetName, village, town, district } = req.body;
        
        let updateData = { 
            fName: fName, 
            lName: lName,
            directPhone: directPhone,
            houseNo: houseNo,
            streetName: streetName,
            village: village,
            town: town,
            district: district,
            updated_at: new Date() 
        };

        // File එකක් (Profile Image) ඇවිත් තියෙනවද බලනවා
        // (අපි App එකෙන් යවන්නේ 'file' කියන නමින්)
        if (req.file) {
            updateData.image = req.file.filename;
        }

        const updatedUser = await prisma.users.update({
            where: { id: BigInt(userId) },
            data: updateData
        });

        res.status(200).json({ 
            message: "Profile updated successfully", 
            image: updatedUser.image,
            user: JSON.parse(JSON.stringify(updatedUser, (key, value) => typeof value === 'bigint' ? value.toString() : value))
        });
    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ message: "Failed to update profile" });
    }
};

const updateProfilePic = async (req, res) => {
    res.status(200).json({ message: "Profile Picture Updated (Mobile API)" });
};

module.exports = { updateProfile, updateProfilePic };