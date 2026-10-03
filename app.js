// Task Manager - Frontend JavaScript

let token = localStorage.getItem("taskManagerToken");
let currentUser = JSON.parse(localStorage.getItem("taskManagerUser") || "null");

let editingTaskId = null;
let deletingTaskId = null;
let currentView = "dashboard";
let socket = null;

const $ = id => document.getElementById(id);

// Start application

document.addEventListener("DOMContentLoaded", () => {
    setupAuthForms();
    setupTaskEvents();
    showTodayDate();

    if (token && currentUser) {
        showApp();
    } else {
        showAuth();
    }
});

// Authentication

function setupAuthForms() {
    $("loginForm").addEventListener("submit", login);
    $("registerForm").addEventListener("submit", register);

    $("switchAuth").addEventListener("click", () => {
        const loginVisible = !$("loginForm").classList.contains("hidden");

        $("loginForm").classList.toggle("hidden", loginVisible);
        $("registerForm").classList.toggle("hidden", !loginVisible);

        $("authEyebrow").textContent = loginVisible ? "CREATE ACCOUNT" : "WELCOME BACK";
        $("authTitle").textContent = loginVisible ? "Create account" : "Login";
        $("authSubtitle").textContent = loginVisible
            ? "Create an account to start managing tasks."
            : "Login to manage your tasks.";

        $("switchText").textContent = loginVisible
            ? "Already have an account?"
            : "Don't have an account?";

        $("switchAuth").textContent = loginVisible
            ? "Login"
            : "Create account";
    });
}

async function login(event) {
    event.preventDefault();

    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    try {
        const data = await api("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password })
        });

        saveLogin(data);
        showApp();
        showToast("Login successful!");
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function register(event) {
    event.preventDefault();

    const name = $("registerName").value.trim();
    const email = $("registerEmail").value.trim();
    const password = $("registerPassword").value;

    try {
        const data = await api("/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password })
        });

        saveLogin(data);
        showApp();
        showToast("Account created successfully!");
    } catch (error) {
        showToast(error.message, "error");
    }
}

function saveLogin(data) {
    token = data.token;
    currentUser = data.user;

    localStorage.setItem("taskManagerToken", token);
    localStorage.setItem("taskManagerUser", JSON.stringify(currentUser));
}

function logout() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    token = null;
    currentUser = null;

    localStorage.removeItem("taskManagerToken");
    localStorage.removeItem("taskManagerUser");

    showAuth();
    showToast("Logged out.");
}

function showAuth() {
    $("authScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
}

async function showApp() {
    $("authScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");

    $("userName").textContent = currentUser.name;
    $("welcomeName").textContent = currentUser.name;
    $("userEmail").textContent = currentUser.email;
    $("avatar").textContent = currentUser.name.charAt(0).toUpperCase();

    connectSocket();

    try {
        await Promise.all([loadTasks(), loadStats()]);
    } catch (error) {
        // If the token is no longer valid, ask the user to login again.
        if (error.status === 401) {
            logout();
        }
    }
}

// API helper

async function api(endpoint, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const error = new Error(data.message || "Something went wrong.");
        error.status = response.status;
        throw error;
    }

    return data;
}

// Socket.IO real-time updates

function connectSocket() {
    if (socket) {
        socket.disconnect();
    }

    socket = io({
        auth: {
            token
        }
    });

    socket.on("connect", () => {
        setConnection(true);
    });

    socket.on("disconnect", () => {
        setConnection(false);
    });

    socket.on("connect_error", () => {
        setConnection(false);
    });

    socket.on("taskChanged", async () => {
        await Promise.all([loadTasks(), loadStats()]);
    });
}

function setConnection(online) {
    $("connectionDot").classList.toggle("offline", !online);
    $("connectionText").textContent = online ? "Live" : "Offline";
}

// Task events

function setupTaskEvents() {
    $("addTaskBtn").addEventListener("click", () => {
        openTaskModal();
    });

    $("emptyAddBtn").addEventListener("click", () => {
        openTaskModal();
    });

    $("closeTaskModal").addEventListener("click", closeTaskModal);

    $("taskModal").addEventListener("click", event => {
        if (event.target.id === "taskModal") {
            closeTaskModal();
        }
    });

    $("confirmModal").addEventListener("click", event => {
        if (event.target.id === "confirmModal") {
            closeDeleteModal();
        }
    });

    $("taskForm").addEventListener("submit", saveTask);

    $("cancelDelete").addEventListener("click", closeDeleteModal);
    $("confirmDelete").addEventListener("click", deleteTask);

    $("logoutBtn").addEventListener("click", logout);

    document.querySelectorAll(".nav-item").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach(item => {
                item.classList.remove("active");
            });

            button.classList.add("active");
            currentView = button.dataset.view;

            if (currentView === "dashboard") {
                $("pageTitle").textContent = "Dashboard";
                $("taskSectionTitle").textContent = "My Tasks";
            }

            if (currentView === "all") {
                $("pageTitle").textContent = "All Tasks";
                $("taskSectionTitle").textContent = "All My Tasks";
            }

            if (currentView === "completed") {
                $("pageTitle").textContent = "Completed";
                $("taskSectionTitle").textContent = "Completed Tasks";
            }

            loadTasks();
        });
    });

    let searchTimer;

    $("searchInput").addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(loadTasks, 250);
    });

    $("statusFilter").addEventListener("change", loadTasks);
    $("priorityFilter").addEventListener("change", loadTasks);
}

// Load tasks and statistics

async function loadTasks() {
    let status = $("statusFilter").value;

    // Completed view automatically shows completed tasks.
    if (currentView === "completed") {
        status = "Completed";
    }

    const search = encodeURIComponent($("searchInput").value.trim());

    const url =
        `/tasks?search=${search}` +
        `&status=${encodeURIComponent(status)}` +
        `&priority=${encodeURIComponent($("priorityFilter").value)}`;

    try {
        const data = await api(url);
        renderTasks(data.tasks);
    } catch (error) {
        showToast(error.message, "error");
    }
}

async function loadStats() {
    const data = await api("/tasks/stats");

    $("totalTasks").textContent = data.total;
    $("pendingTasks").textContent = data.pending;
    $("progressTasks").textContent = data.inProgress;
    $("completedTasks").textContent = data.completed;
}

// Render tasks

function renderTasks(tasks) {
    const list = $("taskList");
    list.innerHTML = "";

    if (tasks.length === 0) {
        $("emptyState").classList.remove("hidden");
        return;
    }

    $("emptyState").classList.add("hidden");

    tasks.forEach(task => {
        list.appendChild(createTaskElement(task));
    });
}

function createTaskElement(task) {
    const card = document.createElement("article");
    card.className = "task-card";

    const main = document.createElement("div");
    main.className = "task-main";

    const titleRow = document.createElement("div");
    titleRow.className = "task-title-row";

    const title = document.createElement("h3");
    title.className = "task-title";
    title.textContent = task.title;

    titleRow.appendChild(title);
    titleRow.appendChild(createBadge(task.priority.toLowerCase(), task.priority));
    titleRow.appendChild(createBadge(
        task.status.toLowerCase().replace(" ", "-"),
        task.status
    ));

    const description = document.createElement("p");
    description.className = "task-description";
    description.textContent = task.description || "No description added.";

    const meta = document.createElement("div");
    meta.className = "task-meta";

    if (task.dueDate) {
        const dueDate = document.createElement("span");
        dueDate.className = "due-date";
        dueDate.textContent = `Due: ${formatDate(task.dueDate)}`;
        meta.appendChild(dueDate);
    }

    main.appendChild(titleRow);
    main.appendChild(description);
    main.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editButton = document.createElement("button");
    editButton.className = "icon-btn";
    editButton.textContent = "Edit";
    editButton.title = "Edit task";
    editButton.addEventListener("click", () => openTaskModal(task));

    const deleteButton = document.createElement("button");
    deleteButton.className = "icon-btn delete";
    deleteButton.textContent = "Delete";
    deleteButton.title = "Delete task";
    deleteButton.addEventListener("click", () => openDeleteModal(task.id));

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    card.appendChild(main);
    card.appendChild(actions);

    return card;
}

function createBadge(className, text) {
    const badge = document.createElement("span");
    badge.className = `badge ${className}`;
    badge.textContent = text;
    return badge;
}

// Add/Edit modal

function openTaskModal(task = null) {
    editingTaskId = task ? task.id : null;

    $("taskModal").classList.remove("hidden");

    $("taskModalTitle").textContent = task ? "Edit Task" : "Add Task";
    $("modalEyebrow").textContent = task ? "EDIT TASK" : "NEW TASK";
    $("saveTaskBtn").textContent = task ? "Save Changes" : "Create Task";

    $("taskTitle").value = task ? task.title : "";
    $("taskDescription").value = task ? task.description : "";
    $("taskPriority").value = task ? task.priority : "Medium";
    $("taskStatus").value = task ? task.status : "Pending";
    $("taskDueDate").value = task ? task.dueDate : "";

    $("taskTitle").focus();
}

function closeTaskModal() {
    editingTaskId = null;
    $("taskModal").classList.add("hidden");
    $("taskForm").reset();
    $("taskPriority").value = "Medium";
    $("taskStatus").value = "Pending";
}

async function saveTask(event) {
    event.preventDefault();

    const payload = {
        title: $("taskTitle").value.trim(),
        description: $("taskDescription").value.trim(),
        priority: $("taskPriority").value,
        status: $("taskStatus").value,
        dueDate: $("taskDueDate").value
    };

    const isEditing = Boolean(editingTaskId);
    const button = $("saveTaskBtn");

    button.disabled = true;
    button.textContent = isEditing ? "Saving..." : "Creating...";

    try {
        await api(
            isEditing ? `/tasks/${editingTaskId}` : "/tasks",
            {
                method: isEditing ? "PUT" : "POST",
                body: JSON.stringify(payload)
            }
        );

        closeTaskModal();

        // Socket.IO will refresh both task list and stats.
        // These are also loaded immediately so the current tab updates.
        await Promise.all([loadTasks(), loadStats()]);

        showToast(
            isEditing
                ? "Task updated successfully!"
                : "Task created successfully!"
        );
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        button.disabled = false;
        button.textContent = isEditing ? "Save Changes" : "Create Task";
    }
}

// Delete task

function openDeleteModal(id) {
    deletingTaskId = id;
    $("confirmModal").classList.remove("hidden");
}

function closeDeleteModal() {
    deletingTaskId = null;
    $("confirmModal").classList.add("hidden");
}

async function deleteTask() {
    if (!deletingTaskId) {
        return;
    }

    const button = $("confirmDelete");
    button.disabled = true;

    try {
        await api(`/tasks/${deletingTaskId}`, {
            method: "DELETE"
        });

        closeDeleteModal();

        await Promise.all([loadTasks(), loadStats()]);

        showToast("Task deleted successfully!");
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        button.disabled = false;
    }
}

// Small helpers

function showTodayDate() {
    $("todayDate").textContent = new Date().toLocaleDateString(
        "en-IN",
        {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        }
    );
}

function formatDate(date) {
    return new Date(date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    $("toastContainer").appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
