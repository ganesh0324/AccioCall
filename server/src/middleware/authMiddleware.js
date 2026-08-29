const jwt = require("jsonwebtoken");
const prisma = require("../config/db");

const protect = (req, res, next) => {
    try{

        //get authorization header
        const authHeader = req.headers.authorization;

        //no token
        if (!authHeader){
            return res.status(410).json({ message : "No token provided"});
        }
         // remove "Bearer "
        const token = authHeader.split(" ")[1];

        //verify token
        const decoded = jwt.verify(token , process.env.JWT_SECRET);
        
        //attach user info to request
        req.user = decoded;

        //move to next function!!
        next();

    } catch (error) {
        return res.status(401).json({message : "Invalid Token"});
    }

};

// Checks the CURRENT role in the database (not a claim baked into the JWT),
// so promoting/demoting an admin takes effect immediately, not on next login.
const requireAdmin = async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { role: true },
        });

        if (!user || user.role !== "ADMIN") {
            return res.status(403).json({ message: "Admin access required" });
        }

        next();
    } catch (error) {
        console.error("Error checking admin role:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {protect, requireAdmin} ;