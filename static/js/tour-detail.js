let tourId = null;
let currentUserId = null;
let editingExpenseId = null;
let currentReport = null;

document.addEventListener("DOMContentLoaded", function () {
    if (!isAuthenticated()) return;

    tourId = document.getElementById("tourId").value;
    if (!tourId) {
        showPageError("Invalid tour.");
        return;
    }

    setupExpenseModal();
    setupPaymentModal();
    setupPaymentApprovalActions();
    setupDeleteModal();
    setupOtherActions();

    init();
});

async function init() {
    try {
        const me = await apiRequest("/api/profile/").then((r) => r.json());
        currentUserId = me.id;
    } catch (error) {
        console.error("Unable to load current user", error);
    }

    try {
        await loadTour();
        document.getElementById("loadingState").classList.add("hidden");
        document.getElementById("tourContent").classList.remove("hidden");
        if (window.lucide) lucide.createIcons();
    } catch (error) {
        console.error("Unable to load tour details", error);
        showPageError("Unable to load this tour.");
        return;
    }

    await Promise.allSettled([loadMembers(), loadExpenses(), loadReport()]);

    if (window.lucide) lucide.createIcons();
}

function formatMoney(amount) {
    return new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        minimumFractionDigits: 2,
    }).format(Number(amount || 0));
}

function formatDate(dateString) {
    if (!dateString) return "-";
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(
        new Date(`${dateString}T00:00:00`)
    );
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value ?? "";
    return div.innerHTML;
}

function getMediaUrl(url) {
    return new URL(url, window.location.origin).href;
}

function showPageError(message) {
    document.getElementById("loadingState").classList.add("hidden");
    document.getElementById("messageArea").innerHTML = `
        <div class="bg-red-100 border border-red-300 text-red-700 px-5 py-4 rounded-xl">${escapeHtml(message)}</div>`;
}

function showToast(message, type = "success") {
    const styles = {
        success: "bg-green-100 border border-green-300 text-green-700",
        error: "bg-red-100 border border-red-300 text-red-700",
    };
    document.getElementById("messageArea").innerHTML = `
        <div class="${styles[type]} px-5 py-4 rounded-xl">${escapeHtml(message)}</div>`;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------------------------------------------------------------------------
// Tour header
// ---------------------------------------------------------------------------

let currentTour = null;

async function loadTour() {
    const response = await apiRequest(`/api/tours/${tourId}/`);

    if (response.status === 401) return logout();
    if (response.status === 404) {
        showPageError("Tour not found or you don't have access to it.");
        return;
    }
    if (!response.ok) {
        showPageError("Unable to load this tour.");
        return;
    }

    const tour = await response.json();
    currentTour = tour;

    document.getElementById("tourTitle").textContent = tour.title;
    document.querySelector("#tourDestination span").textContent = tour.destination;
    document.getElementById("tourDescription").textContent = tour.description || "No description provided.";
    document.getElementById("tourBudget").textContent = formatMoney(tour.budget);
    document.getElementById("tourSpent").textContent = formatMoney(tour.total_expense);
    document.getElementById("tourDates").textContent = `${formatDate(tour.start_date)} – ${formatDate(tour.end_date)}`;
    document.getElementById("tourJoinCode").textContent = tour.join_code;
    document.getElementById("editTourLink").href = `/tours/edit/${tour.id}/`;

    const tourHeroImage = document.getElementById("tourHeroImage");
    const tourHero = document.getElementById("tourHero");
    const fallbackClasses = ["bg-gradient-to-br", "from-brand-900", "via-brand-700", "to-accent-600"];
    if (tour.image) {
        tourHeroImage.src = getMediaUrl(tour.image);
        tourHeroImage.classList.remove("hidden");
        tourHero.classList.remove(...fallbackClasses);
    } else {
        tourHeroImage.removeAttribute("src");
        tourHeroImage.classList.add("hidden");
        tourHero.classList.add(...fallbackClasses);
    }
    tourHeroImage.onerror = () => {
        tourHeroImage.classList.add("hidden");
        tourHero.classList.add(...fallbackClasses);
    };

    const statusLabels = { planned: "Planned", ongoing: "Ongoing", completed: "Completed", cancelled: "Cancelled" };
    const statusBadgeClasses = {
        planned: "border-blue-200/70 bg-blue-600/85",
        ongoing: "border-amber-200/70 bg-amber-500/90",
        completed: "border-emerald-200/70 bg-emerald-600/90",
        cancelled: "border-red-200/70 bg-red-600/90",
    };
    const statusBadge = document.getElementById("tourStatusBadge");
    statusBadge.className = `inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-bold text-white shadow-sm backdrop-blur-sm ${statusBadgeClasses[tour.status] || "border-slate-200/70 bg-slate-600/90"}`;
    statusBadge.textContent = statusLabels[tour.status] || tour.status;

    if (tour.is_owner) {
        document.getElementById("ownerActions").classList.remove("hidden");
        document.getElementById("leaveTourBtn").classList.add("hidden");
    } else {
        document.getElementById("ownerActions").classList.add("hidden");
        document.getElementById("leaveTourBtn").classList.remove("hidden");
    }
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

async function loadMembers() {
    const container = document.getElementById("membersList");
    try {
        const response = await apiRequest(`/api/tours/${tourId}/members/`);
        if (!response.ok) throw new Error("Unable to load members.");
        const memberData = await response.json();
        const members = memberData.results || memberData;
        const memberTotal = typeof memberData.count === "number" ? memberData.count : members.length;

        document.getElementById("memberCount").textContent = `(${memberTotal})`;

        if (!members.length) {
            container.innerHTML = `<p class="text-slate-400 text-sm">No members yet.</p>`;
            return;
        }

        container.innerHTML = members
            .map((member) => {
                const initials = (member.full_name || member.email)
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((p) => p[0].toUpperCase())
                    .join("");
                const roleBadge =
                    member.role === "creator"
                        ? `<span class="text-xs font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full">Creator</span>`
                        : `<span class="text-xs font-semibold text-slate-400">Member</span>`;
                return `
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">${escapeHtml(initials)}</div>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(member.full_name)}</p>
                        <p class="text-xs text-slate-400 truncate">${escapeHtml(member.email)}</p>
                    </div>
                    ${roleBadge}
                </div>`;
            })
            .join("");
    } catch (error) {
        console.error(error);
        container.innerHTML = `<p class="text-red-500 text-sm">Unable to load members.</p>`;
    }
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

async function loadExpenses() {
    const container = document.getElementById("expensesList");
    try {
        const response = await apiRequest(`/api/tours/${tourId}/expenses/`);
        if (!response.ok) throw new Error("Unable to load expenses.");
        const data = await response.json();
        const expenses = data.results || data;

        if (!expenses.length) {
            container.innerHTML = `
                <div class="py-10 text-center text-slate-400 text-sm">
                    No expenses yet. Add the first one to start tracking the trip.
                </div>`;
            return;
        }

        const categoryIcons = { food: "🍔", travel: "🚗", hotel: "🏨", other: "🧾" };

        container.innerHTML = expenses
            .map((expense) => {
                const canManage = expense.added_by === currentUserId || expense.is_owner;
                return `
                <div class="flex items-center justify-between py-3.5">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg shrink-0">
                            ${categoryIcons[expense.category] || "🧾"}
                        </div>
                        <div class="min-w-0">
                            <p class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(expense.description) || escapeHtml(expense.category_display)}</p>
                            <p class="text-xs text-slate-400">${escapeHtml(expense.added_by_name)} &middot; ${formatDate(expense.added_at?.slice(0, 10))}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        <span class="font-bold text-slate-800 text-sm">${formatMoney(expense.amount)}</span>
                        ${
                            canManage
                                ? `<button data-expense-id="${expense.id}" class="deleteExpenseBtn text-slate-400 hover:text-red-600 transition">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                   </button>`
                                : ""
                        }
                    </div>
                </div>`;
            })
            .join("");

        container.querySelectorAll(".deleteExpenseBtn").forEach((btn) => {
            btn.addEventListener("click", () => deleteExpense(btn.dataset.expenseId));
        });

        if (window.lucide) lucide.createIcons();
    } catch (error) {
        console.error(error);
        container.innerHTML = `<p class="text-red-500 text-sm py-6 text-center">Unable to load expenses.</p>`;
    }
}

async function deleteExpense(expenseId) {
    if (!confirm("Delete this expense?")) return;

    try {
        const response = await apiRequest(`/api/expenses/${expenseId}/`, { method: "DELETE" });
        if (response.status === 204) {
            showToast("Expense deleted.");
            await Promise.all([loadExpenses(), loadReport(), loadTour()]);
        } else {
            showToast("Unable to delete this expense.", "error");
        }
    } catch (error) {
        console.error(error);
        showToast("Unable to delete this expense.", "error");
    }
}

function setupExpenseModal() {
    const modal = document.getElementById("expenseModal");
    const openBtn = document.getElementById("addExpenseBtn");
    const closeBtn = document.getElementById("closeExpenseModalBtn");
    const cancelBtn = document.getElementById("cancelExpenseBtn");
    const overlay = document.getElementById("expenseModalOverlay");
    const form = document.getElementById("expenseForm");

    function open() {
        editingExpenseId = null;
        form.reset();
        document.getElementById("expenseFormMessage").innerHTML = "";
        modal.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
    }

    function close() {
        modal.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    }

    openBtn.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", close);

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const payload = {
            amount: document.getElementById("expenseAmount").value,
            category: document.getElementById("expenseCategory").value,
            description: document.getElementById("expenseDescription").value.trim(),
        };

        const submitBtn = document.getElementById("expenseSubmitBtn");
        submitBtn.disabled = true;
        submitBtn.textContent = "Saving...";

        try {
            const response = await apiRequest(`/api/tours/${tourId}/expenses/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                close();
                showToast("Expense added successfully.");
                await Promise.all([loadExpenses(), loadReport(), loadTour()]);
            } else {
                document.getElementById("expenseFormMessage").innerHTML = `
                    <div class="text-red-600 text-sm">${escapeHtml(JSON.stringify(data))}</div>`;
            }
        } catch (error) {
            console.error(error);
            document.getElementById("expenseFormMessage").innerHTML = `
                <div class="text-red-600 text-sm">Unable to save expense. Please try again.</div>`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Save Expense";
        }
    });
}

function setupPaymentModal() {
    const modal = document.getElementById("paymentModal");
    const form = document.getElementById("paymentForm");
    const recipientSelect = document.getElementById("paymentRecipient");

    function close() {
        modal.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    }

    document.getElementById("recordPaymentBtn").addEventListener("click", () => {
        if (!currentReport) {
            showToast("Balance report is still loading.", "error");
            return;
        }

        const recipients = currentReport.members.filter((member) => member.user_id !== currentUserId);
        recipientSelect.innerHTML = recipients.length
            ? recipients
                .map((member) => `<option value="${member.user_id}">${escapeHtml(member.full_name || member.email)}</option>`)
                .join("")
            : '<option value="">No other members available</option>';

        form.reset();
        document.getElementById("paymentFormMessage").innerHTML = "";
        modal.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
    });

    document.getElementById("closePaymentModalBtn").addEventListener("click", close);
    document.getElementById("cancelPaymentBtn").addEventListener("click", close);
    document.getElementById("paymentModalOverlay").addEventListener("click", close);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = document.getElementById("paymentSubmitBtn");
        const payload = {
            recipient: recipientSelect.value,
            amount: document.getElementById("paymentAmount").value,
            payment_method: document.getElementById("paymentMethod").value,
            note: document.getElementById("paymentNote").value.trim(),
        };

        submitButton.disabled = true;
        submitButton.textContent = "Saving...";
        try {
            const response = await apiRequest(`/api/tours/${tourId}/payments/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.recipient?.[0] || data.amount?.[0] || "Unable to record payment.");
            }

            close();
            showToast("Payment recorded. Balances have been updated.");
            await loadReport();
        } catch (error) {
            document.getElementById("paymentFormMessage").innerHTML =
                `<div class="text-sm text-red-600">${escapeHtml(error.message)}</div>`;
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Save payment";
        }
    });
}

function setupPaymentApprovalActions() {
    document.getElementById("reportSummary").addEventListener("click", async (event) => {
        const button = event.target.closest(".reviewPaymentBtn");
        if (!button) return;

        const action = button.dataset.action;
        button.disabled = true;

        try {
            const response = await apiRequest(
                `/api/tours/${tourId}/payments/${button.dataset.paymentId}/review/`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action }),
                }
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || "Unable to review payment.");

            showToast(`Payment ${action}.`);
            await loadReport();
        } catch (error) {
            showToast(error.message, "error");
            button.disabled = false;
        }
    });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

async function loadReport() {
    const container = document.getElementById("reportSummary");
    try {
        const response = await apiRequest(`/api/tours/${tourId}/report/`);
        if (!response.ok) throw new Error("Unable to load report.");
        const report = await response.json();
        currentReport = report;

        const rows = report.members
            .map((member) => {
                const balanceClass = member.balance > 0 ? "text-emerald-600" : member.balance < 0 ? "text-red-500" : "text-slate-400";
                const balanceLabel = member.balance > 0 ? "is owed" : member.balance < 0 ? "owes" : "settled up";
                return `
                <div class="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                    <div>
                        <p class="font-semibold text-slate-700">${escapeHtml(member.full_name)}</p>
                        <p class="text-xs text-slate-400">paid ${formatMoney(member.paid)} of ${formatMoney(member.share)} share</p>
                    </div>
                    <div class="text-right">
                        <p class="${balanceClass} font-bold">${formatMoney(Math.abs(member.balance))}</p>
                        <p class="text-xs text-slate-400">${balanceLabel}</p>
                    </div>
                </div>`;
            })
            .join("");

        const payments = report.payments?.length
            ? `<div class="pt-2 mt-2 border-t border-slate-100">
                <p class="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Payments</p>
                ${report.payments
                    .map(
                        (payment) => `<div class="text-xs py-2 border-b border-slate-50 last:border-0 text-slate-600">
                            <div>
                                <span class="font-semibold">${escapeHtml(payment.payer_name)}</span> paid
                                <span class="font-semibold">${escapeHtml(payment.recipient_name)}</span>
                                <span class="font-bold text-slate-800">${formatMoney(payment.amount)}</span>
                            </div>
                            <div class="flex flex-wrap items-center gap-1.5 mt-1 text-slate-400">
                                <span>via ${escapeHtml(payment.payment_method_display)}</span>
                                <span class="rounded-full px-2 py-0.5 font-semibold ${payment.status === "approved" ? "bg-green-100 text-green-700" : payment.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}">${escapeHtml(payment.status_display)}</span>
                                ${payment.recipient === currentUserId && payment.status === "pending" ? `
                                    <button type="button" class="reviewPaymentBtn text-brand-700 font-bold hover:underline" data-payment-id="${payment.id}" data-action="approved">Approve</button>
                                    <button type="button" class="reviewPaymentBtn text-red-600 font-bold hover:underline" data-payment-id="${payment.id}" data-action="rejected">Reject</button>` : ""}
                            </div>
                        </div>`
                    )
                    .join("")}
               </div>`
            : `<p class="text-xs text-slate-400 pt-2 mt-2 border-t border-slate-100">No settlement payments recorded.</p>`;

        container.innerHTML = `
            <div class="flex items-center justify-between text-sm mb-1">
                <span class="text-slate-500">Total spent</span>
                <span class="font-bold text-slate-800">${formatMoney(report.total_expense)}</span>
            </div>
            <div class="flex items-center justify-between text-sm mb-4">
                <span class="text-slate-500">Per-member share</span>
                <span class="font-bold text-slate-800">${formatMoney(report.per_member_share)}</span>
            </div>
            ${rows}
            ${payments}
        `;
    } catch (error) {
        console.error(error);
        container.innerHTML = `<p class="text-red-500 text-sm">Unable to load the report.</p>`;
    }
}

// ---------------------------------------------------------------------------
// Delete / Leave tour
// ---------------------------------------------------------------------------

function setupDeleteModal() {
    const modal = document.getElementById("deleteModal");
    const overlay = document.getElementById("deleteModalOverlay");

    document.getElementById("deleteTourBtn").addEventListener("click", () => {
        modal.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
    });

    function close() {
        modal.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    }

    document.getElementById("cancelDeleteBtn").addEventListener("click", close);
    overlay.addEventListener("click", close);

    document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
        try {
            const response = await apiRequest(`/api/tours/${tourId}/`, { method: "DELETE" });
            if (response.status === 204) {
                window.location.href = "/tours/";
            } else {
                close();
                showToast("Unable to delete this tour.", "error");
            }
        } catch (error) {
            console.error(error);
            close();
            showToast("Unable to delete this tour.", "error");
        }
    });
}

function setupOtherActions() {
    const shareModal = document.getElementById("shareJoinCodeModal");
    const closeShareModal = () => shareModal.classList.add("hidden");

    document.getElementById("closeShareJoinCodeBtn").addEventListener("click", closeShareModal);
    document.getElementById("shareJoinCodeOverlay").addEventListener("click", closeShareModal);

    document.getElementById("leaveTourBtn").addEventListener("click", async () => {
        if (!confirm("Leave this tour? You'll need the join code again to rejoin.")) return;

        try {
            const response = await apiRequest(`/api/tours/${tourId}/leave/`, { method: "POST" });
            if (response.ok) {
                window.location.href = "/tours/";
            } else {
                const data = await response.json();
                showToast(data.detail || "Unable to leave this tour.", "error");
            }
        } catch (error) {
            console.error(error);
            showToast("Unable to leave this tour.", "error");
        }
    });

    document.getElementById("copyJoinCodeBtn").addEventListener("click", async () => {
        const code = document.getElementById("tourJoinCode").textContent;
        try {
            await navigator.clipboard.writeText(code);
            showToast("Join code copied to clipboard.");
        } catch (error) {
            console.error(error);
        }
    });

    document.getElementById("shareJoinCodeBtn").addEventListener("click", async () => {
        const code = document.getElementById("tourJoinCode").textContent;
        const inviteLink = new URL("/tours/join/", window.location.origin);
        inviteLink.searchParams.set("code", code);
        const shareText = `Join ${currentTour?.title || "my tour"} on PayTogether using code ${code}.`;
        document.getElementById("shareJoinCodeValue").textContent = code;
        document.getElementById("shareWhatsAppBtn").href = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${inviteLink}`)}`;
        document.getElementById("shareTelegramBtn").href = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(shareText)}`;
        shareModal.classList.remove("hidden");
        if (window.lucide) lucide.createIcons();
    });

    document.getElementById("copyShareCodeBtn").addEventListener("click", async () => {
        await navigator.clipboard.writeText(document.getElementById("tourJoinCode").textContent);
        showToast("Join code copied to clipboard.");
    });

    document.getElementById("copyInviteLinkBtn").addEventListener("click", async () => {
        const link = new URL("/tours/join/", window.location.origin);
        link.searchParams.set("code", document.getElementById("tourJoinCode").textContent);
        await navigator.clipboard.writeText(link.toString());
        showToast("Invite link copied to clipboard.");
    });

    document.getElementById("nativeShareBtn").addEventListener("click", async () => {
        const code = document.getElementById("tourJoinCode").textContent;
        const link = new URL("/tours/join/", window.location.origin);
        link.searchParams.set("code", code);
        if (!navigator.share) {
            showToast("More sharing options are not available in this browser.", "error");
            return;
        }
        await navigator.share({ title: `Join ${currentTour?.title || "my tour"}`, text: `Join my tour using code ${code}.`, url: link.toString() });
    });
}
