const jwt = require("jsonwebtoken");

const JWT_SECRET =
    process.env.JWT_SECRET || "thiranex-task-manager-development-secret";

function createToken(user) {
    return jwt.sign(
        {
            id: user.id,
            name: user.name,
            email: user.email
        },
        JWT_SECRET,
        { expiresIn: "7d" }
    );
}

function authenticate(req, res, next) {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Please log in first." });
    }

    const token = header.split(" ")[1];

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        res.status(401).json({ message: "Session expired. Please log in again." });
    }
}

function verifySocketToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = { createToken, authenticate, verifySocketToken };
