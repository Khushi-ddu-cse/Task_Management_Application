const fs = require("fs");
const path = require("path");

const dataFolder = path.join(__dirname, "data");
const usersFile = path.join(dataFolder, "users.json");
const tasksFile = path.join(dataFolder, "tasks.json");

function initializeDatabase() {
    if (!fs.existsSync(dataFolder)) {
        fs.mkdirSync(dataFolder, { recursive: true });
    }

    if (!fs.existsSync(usersFile)) {
        fs.writeFileSync(usersFile, "[]");
    }

    if (!fs.existsSync(tasksFile)) {
        fs.writeFileSync(tasksFile, "[]");
    }
}

function readUsers() {
    return JSON.parse(fs.readFileSync(usersFile, "utf8"));
}

function saveUsers(users) {
    fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function readTasks() {
    return JSON.parse(fs.readFileSync(tasksFile, "utf8"));
}

function saveTasks(tasks) {
    fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
}

module.exports = {
    initializeDatabase,
    readUsers,
    saveUsers,
    readTasks,
    saveTasks
};
