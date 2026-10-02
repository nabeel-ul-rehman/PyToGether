document.addEventListener("DOMContentLoaded", function () {
    if (!isAuthenticated()) return;

    loadProfile();
    document.getElementById("profileForm").addEventListener("submit", saveProfile);
    document.getElementById("changePasswordForm").addEventListener("submit", changePassword);
    setupProfilePaymentMethods();
});

function setupProfilePaymentMethods() {
    const container = document.getElementById("profilePaymentMethods");
    document.getElementById("addProfilePaymentMethod").addEventListener("click", () => {
        const row = container.querySelector(".profile-payment-method-row").cloneNode(true);
        row.querySelector("select").selectedIndex = 0;
        row.querySelector("input").value = "";
        container.appendChild(row);
        updateProfilePaymentMethodRows();
    });
    container.addEventListener("change", (event) => {
        if (event.target.matches(".profile-payment-method-select")) updateProfilePaymentMethodRows();
    });
    container.addEventListener("click", (event) => {
        const removeButton = event.target.closest(".remove-profile-payment-method");
        if (removeButton) {
            removeButton.closest(".profile-payment-method-row").remove();
            updateProfilePaymentMethodRows();
        }
    });
    updateProfilePaymentMethodRows();
}

function updateProfilePaymentMethodRows() {
    const container = document.getElementById("profilePaymentMethods");
    const rows = [...container.querySelectorAll(".profile-payment-method-row")];
    rows.forEach((row) => {
        const isCash = row.querySelector("select").value === "cash";
        const input = row.querySelector("input");
        input.disabled = isCash;
        input.required = !isCash;
        input.placeholder = isCash ? "No account details needed" : "Account number or ID";
        row.querySelector(".remove-profile-payment-method").classList.toggle("hidden", rows.length === 1);
    });
}

function renderProfilePaymentMethods(paymentMethods = []) {
    const container = document.getElementById("profilePaymentMethods");
    const templateRow = container.querySelector(".profile-payment-method-row").cloneNode(true);
    container.replaceChildren();
    const entries = paymentMethods.length ? paymentMethods : [{ method: "cash", identifier: "" }];
    entries.forEach((entry) => {
        const row = templateRow.cloneNode(true);
        row.querySelector("select").value = entry.method || "cash";
        row.querySelector("input").value = entry.identifier || "";
        container.appendChild(row);
    });
    updateProfilePaymentMethodRows();
}

function getInitialsLocal(name) {
    if (!name) return "?";
    return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0].toUpperCase()).join("");
}

async function loadProfile() {
    try {
        const response = await apiRequest("/api/profile/");
        if (response.status === 401) return logout();
        if (!response.ok) throw new Error("Unable to load profile.");

        const user = await response.json();

        document.getElementById("full_name").value = user.full_name || "";
        document.getElementById("email").value = user.email || "";
        document.getElementById("phone").value = user.phone || "";
        renderProfilePaymentMethods(user.payment_methods || []);
        document.getElementById("profileName").textContent = user.full_name;
        document.getElementById("profileInitials").textContent = getInitialsLocal(user.full_name);

        if (user.date_joined) {
            const joined = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(
                new Date(user.date_joined)
            );
            document.getElementById("profileJoined").textContent = `Member since ${joined}`;
        }

        document.getElementById("loadingState").classList.add("hidden");
        document.getElementById("profileContent").classList.remove("hidden");
    } catch (error) {
        console.error(error);
    }
}

function showMessage(message, type) {
    const alert = document.createElement("div");
    alert.className = type === "success"
        ? "rounded-xl border border-green-300 bg-green-100 px-4 py-3 text-sm text-green-700"
        : "rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-700";
    alert.setAttribute("role", type === "success" ? "status" : "alert");
    alert.textContent = message;
    document.getElementById("message").replaceChildren(alert);
}

async function saveProfile(event) {
    event.preventDefault();

    const button = document.getElementById("saveBtn");
    button.disabled = true;
    button.textContent = "Saving...";

    const payload = {
        full_name: document.getElementById("full_name").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        payment_methods: [...document.querySelectorAll("#profilePaymentMethods .profile-payment-method-row")].map((row) => ({
            method: row.querySelector("select").value,
            identifier: row.querySelector("input").value.trim(),
        })),
    };

    try {
        const response = await apiRequest("/api/profile/", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (response.status === 401) return logout();

        const data = await response.json().catch(() => ({}));
        if (response.ok) {
            showMessage("Profile updated successfully.", "success");
            localStorage.setItem("user_name", payload.full_name);
            document.getElementById("profileName").textContent = payload.full_name;
            document.getElementById("profileInitials").textContent = getInitialsLocal(payload.full_name);
        } else {
            const errors = Object.values(data).flat().filter(Boolean).join(" ");
            showMessage(errors || "Unable to update profile.", "error");
        }
    } catch (error) {
        console.error(error);
        showMessage("Server error. Please try again.", "error");
    } finally {
        button.disabled = false;
        button.textContent = "Save Changes";
    }
}

function showPasswordMessage(message, type) {
    const alert = document.createElement("div");
    alert.className = type === "success"
        ? "rounded-xl border border-green-300 bg-green-100 px-4 py-3 text-sm text-green-700"
        : "rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-700";
    alert.setAttribute("role", type === "success" ? "status" : "alert");
    alert.textContent = message;
    document.getElementById("passwordMessage").replaceChildren(alert);
}

async function changePassword(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const button = document.getElementById("changePasswordBtn");
    const payload = {
        current_password: document.getElementById("currentPassword").value,
        new_password: document.getElementById("newPassword").value,
        confirm_new_password: document.getElementById("confirmNewPassword").value,
    };

    if (payload.new_password !== payload.confirm_new_password) {
        showPasswordMessage("New passwords do not match.", "error");
        return;
    }

    button.disabled = true;
    button.textContent = "Updating...";

    try {
        const response = await apiRequest("/api/profile/change-password/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (response.status === 401) return logout();

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const errors = Object.values(data).flat().filter(Boolean).join(" ");
            showPasswordMessage(errors || "Unable to change password.", "error");
            return;
        }

        form.reset();
        showPasswordMessage(data.message || "Password changed successfully.", "success");
    } catch (error) {
        console.error(error);
        showPasswordMessage("Server error. Please try again.", "error");
    } finally {
        button.disabled = false;
        button.textContent = "Update Password";
    }
}
