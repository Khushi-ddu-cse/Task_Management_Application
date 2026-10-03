const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const { initializeDatabase } = require("./database");
const { verifySocketToken } = require("./auth");
const authRoutes = require("./authRoutes");
const taskRoutes = require("./taskRoutes");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 5000;

initializeDatabase();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("io", io);

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error("Authentication required."));
        socket.user = verifySocketToken(token);
        next();
    } catch (error) {
        next(new Error("Invalid token."));
    }
});

io.on("connection", socket => {
    socket.join(socket.user.id);
});

app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ message: "API endpoint not found." });
    }
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
    console.log(`Task Manager is running at http://localhost:${PORT}`);
});
