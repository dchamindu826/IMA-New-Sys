const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt'); // ඔයා bcryptjs පාවිච්චි කරනවා නම් ඒක දෙන්න

const prisma = new PrismaClient();

async function main() {
    console.log("Creating Super Admin...");

    // පාස්වර්ඩ් එක Hash කිරීම (මෙතන පාස්වර්ඩ් එක 'admin123' කියලා දීලා තියෙන්නේ)
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const newAdmin = await prisma.users.create({
        data: {
            fName: "Chamindu",
            lName: "Admin",
            phone: "0722882344", // මේකෙන් තමයි ලොග් වෙන්න ඕනේ
            role: "superadmin",  // Admin Role එක
            password: hashedPassword,
            status: 1
        }
    });

    console.log("✅ Super Admin Account එක සාර්ථකව හැදුවා!");
    console.log("Phone: 0722882344");
    console.log("Password: 12345678");
}

main()
  .catch((e) => {
    console.error("❌ Error එකක් ආවා:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });