const express = require("express");
const { authenticate } = require("./auth");
const { readTasks, saveTasks } = require("./database");

const router = express.Router();
router.use(authenticate);

function validateTask(body) {
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const priority = body.priority || "Medium";
    const status = body.status || "Pending";
    const dueDate = body.dueDate || "";

    if (!title) return { error: "Task title is required." };
    if (title.length > 100) return { error: "Task title must be 100 characters or less." };
    if (description.length > 500) return { error: "Description must be 500 characters or less." };
    if (!["Low", "Medium", "High"].includes(priority)) return { error: "Invalid priority." };
    if (!["Pending", "In Progress", "Completed"].includes(status)) return { error: "Invalid status." };

    return { title, description, priority, status, dueDate };
}

router.get("/", (req, res) => {
    let tasks = readTasks().filter(task => task.userId === req.user.id);
    const search = String(req.query.search || "").trim().toLowerCase();
    const status = req.query.status || "All";
    const priority = req.query.priority || "All";

    if (search) {
        tasks = tasks.filter(task =>
            task.title.toLowerCase().includes(search) ||
            task.description.toLowerCase().includes(search)
        );
    }

    if (status !== "All") tasks = tasks.filter(task => task.status === status);
    if (priority !== "All") tasks = tasks.filter(task => task.priority === priority);

    tasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ tasks });
});

router.get("/stats", (req, res) => {
    const tasks = readTasks().filter(task => task.userId === req.user.id);

    res.json({
        total: tasks.length,
        pending: tasks.filter(task => task.status === "Pending").length,
        inProgress: tasks.filter(task => task.status === "In Progress").length,
        completed: tasks.filter(task => task.status === "Completed").length
    });
});

router.post("/", (req, res) => {
    const result = validateTask(req.body);
    if (result.error) return res.status(400).json({ message: result.error });

    const now = new Date().toISOString();
    const task = {
        id: Date.now().toString(),
        userId: req.user.id,
        ...result,
        createdAt: now,
        updatedAt: now
    };

    const tasks = readTasks();
    tasks.push(task);
    saveTasks(tasks);
    req.app.get("io").to(req.user.id).emit("taskChanged");

    res.status(201).json({ message: "Task created successfully.", task });
});

router.put("/:id", (req, res) => {
    const result = validateTask(req.body);
    if (result.error) return res.status(400).json({ message: result.error });

    const tasks = readTasks();
    const index = tasks.findIndex(task =>
        task.id === req.params.id && task.userId === req.user.id
    );

    if (index === -1) return res.status(404).json({ message: "Task not found." });

    tasks[index] = {
        ...tasks[index],
        ...result,
        updatedAt: new Date().toISOString()
    };

    saveTasks(tasks);
    req.app.get("io").to(req.user.id).emit("taskChanged");
    res.json({ message: "Task updated successfully.", task: tasks[index] });
});

router.delete("/:id", (req, res) => {
    const tasks = readTasks();
    const task = tasks.find(item =>
        item.id === req.params.id && item.userId === req.user.id
    );

    if (!task) return res.status(404).json({ message: "Task not found." });

    saveTasks(tasks.filter(item => item.id !== req.params.id));
    req.app.get("io").to(req.user.id).emit("taskChanged");
    res.json({ message: "Task deleted successfully." });
});

module.exports = router;
