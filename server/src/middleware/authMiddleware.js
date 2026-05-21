const jwt = require("jsonwebtoken");

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

module.exports = {protect} ;