const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            
            // 🔥 FIX: Secret Key එක හැමතැනම සමාන කරා (campus_super_secret_key_2026) 🔥
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'campus_super_secret_key_2026');
            
            req.user = decoded; // Token eke thiyena user ID eka req ekata attach karanawa
            next();
        } catch (error) {
            console.error("JWT Verification Error:", error.message);
            return res.status(401).json({ message: 'Not authorized, token failed or expired' });
        }
    } else {
        return res.status(401).json({ message: 'Not authorized, no token provided' });
    }
};

module.exports = { protect };