// ---------------------------------------------------------------------------
// Shared helpers for every authenticated page (dashboard, tours, profile...).
// Loaded once via the app shell, before each page's own script.
// ---------------------------------------------------------------------------

function getAccessToken() {
    return localStorage.getItem("access_token");
}

function getRefreshToken() {
    return localStorage.getItem("refresh_token");
}

function saveAccessToken(token) {
    localStorage.setItem("access_token", token);
}

function isAuthenticated() {
    return getAccessToken() !== null;
}

function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = "/login/";
        return false;
    }
    return true;
}

function logout() {
    localStorage.clear();
    window.location.href = "/login/";
}

async function refreshAccessToken() {
    const refresh = getRefreshToken();
    if (!refresh) {
        return false;
    }
    try {
        const response = await fetch("/api/token/refresh/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refresh }),
        });
        if (!response.ok) {
            return false;
        }
        const data = await response.json();
        saveAccessToken(data.access);
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

/**
 * fetch() wrapper that attaches the access token and transparently
 * refreshes it once on a 401 before retrying.
 */
async function apiRequest(url, options = {}) {
    options.headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${getAccessToken()}`,
    };

    let response = await fetch(url, options);

    if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            options.headers.Authorization = `Bearer ${getAccessToken()}`;
            response = await fetch(url, options);
        }
    }

    return response;
}

function getInitials(name) {
    if (!name) return "?";
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("");
}

async function loadTopbarProfile() {
    const nameEl = document.getElementById("userName");
    const initialsEl = document.getElementById("userInitials");
    if (!nameEl) return;

    try {
        const response = await apiRequest("/api/profile/");
        if (response.status === 401) {
            logout();
            return;
        }
        const user = await response.json();
        nameEl.textContent = user.full_name || user.email;
        if (initialsEl) initialsEl.textContent = getInitials(user.full_name);

        const welcomeName = document.getElementById("welcomeName");
        if (welcomeName) welcomeName.textContent = user.full_name;

        localStorage.setItem("user_name", user.full_name || "");
        window.currentUser = user;
    } catch (error) {
        console.error("Unable to load profile", error);
    }
}

function escapeNotificationText(value) {
    const element = document.createElement("div");
    element.textContent = value ?? "";
    return element.innerHTML;
}

async function loadPaymentNotifications() {
    const list = document.getElementById("notificationsList");
    const countEl = document.getElementById("notificationCount");
    const panelCountEl = document.getElementById("notificationPanelCount");
    if (!list || !countEl || !panelCountEl) return;

    try {
        const response = await apiRequest("/api/payment-notifications/");
        if (!response.ok) throw new Error("Unable to load notifications.");
        const data = await response.json();
        const count = Number(data.count || 0);
        panelCountEl.textContent = `${count} notification${count === 1 ? "" : "s"}`;
        countEl.textContent = count > 9 ? "9+" : String(count);
        countEl.classList.toggle("hidden", count === 0);

        if (!count) {
            list.innerHTML = '<p class="px-3 py-6 text-center text-sm text-slate-400">No payment notifications.</p>';
            return;
        }

        list.innerHTML = data.notifications.map((notification) => `
            <div class="rounded-xl border border-slate-100 p-3">
                <a href="/tours/${notification.tour_id}/" class="block hover:text-brand-700">
                    <p class="text-sm font-semibold text-slate-800">${escapeNotificationText(notification.payer_name)} paid you</p>
                    <p class="mt-1 text-xs text-slate-500">${escapeNotificationText(notification.tour_title)} &middot; ${escapeNotificationText(notification.recipient_name)} &middot; ${escapeNotificationText(notification.payment_method)}</p>
                    <p class="mt-1 text-sm font-bold text-brand-700">PKR ${escapeNotificationText(notification.amount)}</p>
                </a>
                <div class="notificationReviewActions mt-3 flex gap-2">
                    <button type="button" class="notificationReviewBtn flex-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-700" data-tour-id="${notification.tour_id}" data-payment-id="${notification.id}" data-action="approved">Approve</button>
                    <button type="button" class="notificationReviewBtn flex-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50" data-tour-id="${notification.tour_id}" data-payment-id="${notification.id}" data-action="rejected">Reject</button>
                </div>
            </div>`).join("");
    } catch (error) {
        console.error("Unable to load notifications", error);
        list.innerHTML = '<p class="px-3 py-6 text-center text-sm text-red-500">Unable to load notifications.</p>';
    }
}

async function reviewPaymentNotification(button) {
    const actionGroup = button.closest(".notificationReviewActions");
    const actionButtons = actionGroup
        ? actionGroup.querySelectorAll(".notificationReviewBtn")
        : [button];
    actionButtons.forEach((actionButton) => {
        actionButton.disabled = true;
        actionButton.setAttribute("aria-busy", "true");
    });
    try {
        const response = await apiRequest(`/api/tours/${button.dataset.tourId}/payments/${button.dataset.paymentId}/review/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: button.dataset.action }),
        });
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || "Unable to review payment.");
        }
        await loadPaymentNotifications();
    } catch (error) {
        console.error(error);
        actionButtons.forEach((actionButton) => {
            actionButton.disabled = false;
            actionButton.removeAttribute("aria-busy");
        });
        const list = document.getElementById("notificationsList");
        if (list) {
            list.insertAdjacentHTML(
                "afterbegin",
                `<p class="px-3 py-2 text-center text-xs font-semibold text-red-600">${escapeNotificationText(error.message)}</p>`
            );
        }
    }
}

function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById("mobileMenuBtn");
    const mobileMenuPanel = document.getElementById("mobileMenuPanel");
    const mobileMenuBackdrop = document.getElementById("mobileMenuBackdrop");
    const mobileMenuCloseBtn = document.getElementById("mobileMenuCloseBtn");
    const mobileMenuLogoutBtn = document.getElementById("mobileMenuLogoutBtn");

    if (!mobileMenuBtn || !mobileMenuPanel || !mobileMenuBackdrop) return;

    const currentPath = window.location.pathname;
    document.querySelectorAll("[data-mobile-nav]").forEach((link) => {
        if (link.dataset.mobileNav === currentPath) {
            link.classList.remove("border-white/10", "bg-white/10", "text-white");
            link.classList.add("bg-brand-600", "border-brand-500", "text-white", "shadow-sm");
        }
    });

    function setMobileMenuState(isOpen) {
        mobileMenuPanel.classList.toggle("is-open", isOpen);
        mobileMenuBackdrop.classList.toggle("is-open", isOpen);
        mobileMenuPanel.setAttribute("aria-hidden", String(!isOpen));
        mobileMenuBackdrop.setAttribute("aria-hidden", String(!isOpen));
        mobileMenuBtn.setAttribute("aria-expanded", String(isOpen));
        mobileMenuBtn.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
        document.body.classList.toggle("mobile-menu-open", isOpen);

        const menuIcon = mobileMenuBtn.querySelector("svg");
        if (menuIcon) {
            const nextIcon = document.createElement("i");
            nextIcon.setAttribute("data-lucide", isOpen ? "x" : "menu");
            nextIcon.className = "h-4 w-4";
            menuIcon.replaceWith(nextIcon);
            if (window.lucide) lucide.createIcons();
        }

        if (isOpen && mobileMenuCloseBtn) mobileMenuCloseBtn.focus();
        if (!isOpen) mobileMenuBtn.focus();
    }

    mobileMenuBtn.addEventListener("click", function (event) {
        event.stopPropagation();
        setMobileMenuState(!mobileMenuPanel.classList.contains("is-open"));
    });

    if (mobileMenuCloseBtn) {
        mobileMenuCloseBtn.addEventListener("click", function () {
            setMobileMenuState(false);
        });
    }

    mobileMenuBackdrop.addEventListener("click", function () {
        setMobileMenuState(false);
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && mobileMenuPanel.classList.contains("is-open")) {
            setMobileMenuState(false);
        }
    });

    window.addEventListener("resize", function () {
        if (window.innerWidth >= 768 && mobileMenuPanel.classList.contains("is-open")) {
            setMobileMenuState(false);
        }
    });

    if (mobileMenuLogoutBtn) mobileMenuLogoutBtn.addEventListener("click", logout);
}

document.addEventListener("DOMContentLoaded", function () {
    setupMobileMenu();
    if (!requireAuth()) return;

    loadTopbarProfile();
    loadPaymentNotifications();

    const notificationsBtn = document.getElementById("notificationsBtn");
    const notificationsPanel = document.getElementById("notificationsPanel");
    if (notificationsBtn && notificationsPanel) {
        notificationsBtn.addEventListener("click", () => {
            const isHidden = notificationsPanel.classList.toggle("hidden");
            notificationsBtn.setAttribute("aria-expanded", String(!isHidden));
        });
        document.addEventListener("click", (event) => {
            if (!notificationsPanel.contains(event.target) && !notificationsBtn.contains(event.target)) {
                notificationsPanel.classList.add("hidden");
                notificationsBtn.setAttribute("aria-expanded", "false");
            }
        });
        notificationsPanel.addEventListener("click", (event) => {
            const button = event.target.closest(".notificationReviewBtn");
            if (button) {
                event.preventDefault();
                event.stopPropagation();
                reviewPaymentNotification(button);
            }
        });
    }

    const logoutBtn = document.getElementById("logoutBtn");
    const logoutBtnMobile = document.getElementById("logoutBtnMobile");
    if (logoutBtn) logoutBtn.addEventListener("click", logout);
    if (logoutBtnMobile) logoutBtnMobile.addEventListener("click", logout);
});
