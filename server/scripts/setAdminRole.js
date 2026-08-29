// One-off CLI helper to promote/demote a user, since the admin API itself
// requires an existing admin to call it. Usage:
//   node scripts/setAdminRole.js user@example.com ADMIN
//   node scripts/setAdminRole.js user@example.com USER
require("dotenv").config();
const prisma = require("../src/config/db");

async function main() {
    const [email, role = "ADMIN"] = process.argv.slice(2);

    if (!email) {
        console.error("Usage: node scripts/setAdminRole.js <email> [ADMIN|USER]");
        process.exit(1);
    }

    if (!["ADMIN", "USER"].includes(role)) {
        console.error("Role must be ADMIN or USER");
        process.exit(1);
    }

    const user = await prisma.user.update({
        where: { email },
        data: { role },
        select: { id: true, email: true, fullName: true, role: true },
    });

    console.log(`Updated ${user.email} (id ${user.id}) -> ${user.role}`);
}

main()
    .catch((error) => {
        console.error(error.code === "P2025" ? "No user with that email" : error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
