const prisma = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
// const { get } = require("../app");

const registerUSER = async (req, res) => {
    // Registration logic here  
    const { email, password } = req.body;
    
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
            },
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
        res.json({ token });

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
res.status(200).json({ user: req.user });  
};

module.exports = {registerUSER, loginUSER, logoutUSER, getMe};


