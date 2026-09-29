document.addEventListener("DOMContentLoaded", function () {
    if (!isAuthenticated()) return;
    loadDashboardStats();
});

function formatMoney(amount) {
    const number = Number(amount || 0);
    return new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(number);
}

function timeAgo(dateString) {
    const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
    const units = [
        ["year", 31536000],
        ["month", 2592000],
        ["day", 86400],
        ["hour", 3600],
        ["minute", 60],
    ];
    for (const [name, secondsInUnit] of units) {
        const value = Math.floor(seconds / secondsInUnit);
        if (value >= 1) return `${value} ${name}${value > 1 ? "s" : ""} ago`;
    }
    return "just now";
}

async function loadDashboardStats() {
    try {
        const response = await apiRequest("/api/dashboard-stats/");

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error("Unable to load dashboard stats.");
        }

        const data = await response.json();

        document.getElementById("statTotalTours").textContent = data.total_tours;
        document.getElementById("statTotalMembers").textContent = data.total_members;
        document.getElementById("statTotalExpenses").textContent = formatMoney(data.total_expense);

        const balanceEl = document.getElementById("statBalance");
        const balance = Number(data.balance || 0);
        balanceEl.textContent = formatMoney(balance);
        balanceEl.classList.add(balance < 0 ? "text-red-600" : "text-emerald-600");

        renderTourGroups(data.created_tours || [], data.joined_tours || []);
    } catch (error) {
        console.error(error);
    }
}

function renderTourGroups(createdTours, joinedTours) {
    renderTourList("createdToursList", createdTours, "You have not created any tours yet.", "created");
    renderTourList("joinedToursList", joinedTours, "You have not joined any tours yet.", "joined");
}

function renderTourList(elementId, tours, emptyMessage, group) {
    const container = document.getElementById(elementId);
    const rowClasses = group === "joined"
        ? "border-slate-200 bg-white hover:bg-slate-50 hover:border-teal-300"
        : "border-slate-200 bg-white hover:bg-slate-50 hover:border-brand-300";
    const codeClasses = group === "joined"
        ? "bg-accent-600 text-white shadow-sm ring-1 ring-accent-500/30"
        : "bg-brand-600 text-white shadow-sm ring-1 ring-brand-500/30";
    const titleClasses = group === "joined"
        ? "text-slate-800"
        : "text-slate-800";
    const detailClasses = group === "joined"
        ? "text-slate-500"
        : "text-slate-500";

    if (!tours.length) {
        container.innerHTML = `<p class="text-slate-400 text-sm py-6 text-center">${emptyMessage}</p>`;
        return;
    }

    container.innerHTML = tours
        .map(
            (tour) => `
        <a href="/tours/${tour.id}/" class="flex items-center justify-between gap-4 rounded-xl border px-3 py-3 transition ${rowClasses}">
            <div class="flex items-center min-w-0">
                <div class="min-w-0">
                    <p class="text-sm font-semibold ${titleClasses} truncate">${escapeHtml(tour.title)}</p>
                    <p class="text-xs ${detailClasses} truncate">${escapeHtml(tour.destination)} &middot; ${escapeHtml(tour.start_date)} to ${escapeHtml(tour.end_date)}</p>
                </div>
            </div>
            <span class="shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold tracking-wider ${codeClasses}">${escapeHtml(tour.join_code)}</span>
        </a>`
        )
        .join("");
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}
