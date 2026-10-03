const express = require("express");
const bcrypt = require("bcryptjs");
const { readUsers, saveUsers } = require("./database");
const { createToken, authenticate } = require("./auth");

const router = express.Router();

router.post("/register", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Name, email and password are required." });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        const users = readUsers();

        if (users.some(user => user.email === email)) {
            return res.status(409).json({ message: "An account with this email already exists." });
        }

        const user = {
            id: Date.now().toString(),
            name,
            email,
            passwordHash: await bcrypt.hash(password, 10),
            createdAt: new Date().toISOString()
        };

        users.push(user);
        saveUsers(users);

        res.status(201).json({
            message: "Account created successfully.",
            token: createToken(user),
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ message: "Could not create account." });
    }
});

router.post("/login", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        const user = readUsers().find(item => item.email === email);

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ message: "Invalid email or password." });
        }

        res.json({
            message: "Login successful.",
            token: createToken(user),
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        res.status(500).json({ message: "Could not log in." });
    }
});

router.get("/me", authenticate, (req, res) => {
    res.json({ user: req.user });
});

module.exports = router;
