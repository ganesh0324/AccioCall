const crypto = require("crypto");
const prisma = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendPasswordResetEmail } = require("../config/mailer");
// const { get } = require("../app");

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

const registerUSER = async (req, res) => {
    // Registration logic here  
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
        return res.status(400).json({ message: "Full name, email and password are required" });
    }
    
    try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10); 

        // Create new user
        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                fullName,
            },
            select: { id: true, email: true, fullName: true, role: true, createdAt: true },
        });
        res.status(201).json({"message": "User registered successfully", "user": newUser });

    } catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ message: "Internal server error" });
    }

};

const loginUSER = async (req, res) => {
    // Login logic here     
    const { email, password } = req.body;
    
    try {
        // Find user by email
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }
        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid email or password" });
        }
        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({
            token,
            user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
        });

    } catch (error) {
        console.error("Error logging in user:", error);
        res.status(500).json({ message: "Internal server error" });
    }


};
const logoutUSER = async (req, res) => {
    // Logout logic here     
    try {
        // Invalidate token logic (if using a token blacklist or similar approach)
        res.json({ message: "User logged out successfully" });
    } catch (error) {
        console.error("Error logging out user:" , error);
        res.status(500).json({ message : "Internal server error" });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, email: true, fullName: true, role: true, createdAt: true },
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ user });
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password are required" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentValid) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        const isSameAsOld = await bcrypt.compare(newPassword, user.password);
        if (isSameAsOld) {
            return res.status(400).json({ message: "New password must be different from the current one" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Always responds the same way whether or not the email exists, so this
// endpoint can't be used to check which emails have accounts.
const GENERIC_FORGOT_MESSAGE =
    "If an account exists for that email, a reset link has been sent.";

const forgotPassword = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (user) {
            const rawToken = crypto.randomBytes(32).toString("hex");

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    resetTokenHash: hashToken(rawToken),
                    resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
                },
            });

            const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
            const resetUrl = `${clientUrl}/?resetToken=${rawToken}`;

            try {
                await sendPasswordResetEmail(user.email, resetUrl);
            } catch (mailError) {
                console.error("Error sending password reset email:", mailError.message);
                // Don't leak email-delivery failures to the client — same
                // generic response either way, so this can't be used to
                // probe for valid emails or a misconfigured mailer.
            }
        }

        res.status(200).json({ message: GENERIC_FORGOT_MESSAGE });
    } catch (error) {
        console.error("Error requesting password reset:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    try {
        const user = await prisma.user.findFirst({
            where: {
                resetTokenHash: hashToken(token),
                resetTokenExpiresAt: { gt: new Date() },
            },
        });

        if (!user) {
            return res.status(400).json({ message: "Reset link is invalid or has expired" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetTokenHash: null,
                resetTokenExpiresAt: null,
            },
        });

        res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    registerUSER,
    loginUSER,
    logoutUSER,
    getMe,
    changePassword,
    forgotPassword,
    resetPassword,
};


