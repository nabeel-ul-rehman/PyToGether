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

    const paymentResult = new URLSearchParams(window.location.search).get("payment");
    if (paymentResult === "success") showToast("Card payment submitted. Your balance updates after Stripe confirms it.");
    if (paymentResult === "cancelled") showToast("Card payment was cancelled.", "error");
    if (paymentResult) {
        const url = new URL(window.location.href);
        url.searchParams.delete("payment");
        url.searchParams.delete("session_id");
        window.history.replaceState({}, "", url);
    }

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

function capitalizeInitial(value) {
    const text = String(value || "");
    return text ? `${text.charAt(0).toLocaleUpperCase()}${text.slice(1)}` : "";
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
                const paymentLabels = { cash: "Cash", bank_transfer: "Bank Transfer", jazzcash: "JazzCash", easypaisa: "EasyPaisa", raast: "Raast" };
                const paymentMethods = member.payment_methods || [];
                if (!paymentMethods.some((entry) => entry.method === "raast") && member.raast_number) {
                    paymentMethods.push({ method: "raast", identifier: member.raast_number });
                }
                const paymentDetails = paymentMethods.length
                    ? `<div class="mt-2 space-y-1">${paymentMethods.map((entry) => `<p class="text-xs text-slate-500"><span class="font-semibold text-slate-600">${escapeHtml(paymentLabels[entry.method] || entry.method)}:</span> ${escapeHtml(entry.identifier || "Cash payment")}</p>`).join("")}</div>`
                    : `<p class="mt-2 text-xs text-slate-400">No payment details added</p>`;
                return `
                <div class="flex items-start gap-3">
                    <div class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">${escapeHtml(initials)}</div>
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-semibold text-slate-800 truncate">${escapeHtml(member.full_name)}</p>
                        <p class="text-xs text-slate-400 truncate">${escapeHtml(member.email)}</p>
                        ${paymentDetails}
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
    const detailsModal = document.getElementById("paymentDetailsModal");
    const form = document.getElementById("paymentForm");
    const recipientSelect = document.getElementById("paymentRecipient");
    const methodSelect = document.getElementById("paymentMethod");
    const methodDetails = document.getElementById("paymentMethodDetails");

    function updatePaymentMethodDetails() {
        const method = methodSelect.value;
        const recipient = currentReport?.members.find((member) => String(member.user_id) === recipientSelect.value);
        const labels = {
            raast: { title: "Raast", description: "Send to the recipient's Raast ID, then enter your transfer details.", reference: "Raast transaction ID", sender: true, emoji: "🔗" },
            bank_transfer: { title: "Bank Transfer", description: "Complete your bank transfer, then enter its reference.", reference: "Bank transfer reference", sender: false, emoji: "🏦" },
            jazzcash: { title: "JazzCash", description: "Complete your JazzCash payment, then enter its transaction ID.", reference: "JazzCash transaction ID", sender: false, emoji: "💰" },
            easypaisa: { title: "EasyPaisa", description: "Complete your EasyPaisa payment, then enter its transaction ID.", reference: "EasyPaisa transaction ID", sender: false, emoji: "📱" },
            cash: { title: "Cash", description: "Enter a receipt or note after paying in person.", reference: "Receipt or payment note", sender: false, emoji: "💵" },
        };
        const config = labels[method];
        if (!config) {
            methodDetails.innerHTML = "";
            return;
        }

        const recipientMethod = recipient?.payment_methods?.find((entry) => entry.method === method);
        const recipientIdentifier = recipientMethod?.identifier || (method === "raast" ? recipient?.raast_number : "");
        const recipientInfo = recipientIdentifier
            ? `<p class="text-sm text-slate-700">Pay <strong>${escapeHtml(recipient?.full_name || "selected member")}</strong> at <strong>${escapeHtml(recipientIdentifier)}</strong>.</p>`
            : method === "cash" ? "" : `<p class="text-sm text-amber-700">No ${escapeHtml(config.title)} account number or ID is on this member's profile.</p>`;
        const senderField = config.sender
            ? `<div><label for="paymentSenderAccount" class="mb-1 block text-sm font-semibold text-slate-600">Your Raast number</label><input id="paymentSenderAccount" type="text" required maxlength="100" placeholder="Number or Raast ID you paid from" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"></div>`
            : "";
        const referenceRequired = method !== "cash";
        const referenceField = `<div class="${config.sender ? "" : "sm:col-span-2"}"><label for="paymentTransactionReference" class="mb-1 block text-sm font-semibold text-slate-600">${config.reference}${referenceRequired ? " (required)" : " (optional)"}</label><input id="paymentTransactionReference" type="text" maxlength="120" ${referenceRequired ? "required" : ""} placeholder="Enter reference or transaction ID" class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"></div>`;
        methodDetails.innerHTML = `
            <p class="text-sm font-bold text-slate-800">${config.title}</p>
            <p class="text-xs leading-5 text-slate-500">${config.description}</p>
            ${recipientInfo}
            <div class="grid gap-2 sm:grid-cols-2">${senderField}${referenceField}</div>`;
        document.querySelectorAll(".paymentMethodOption").forEach((option) => {
            const selected = option.dataset.method === method;
            option.classList.toggle("border-brand-600", selected);
            option.classList.toggle("bg-brand-50", selected);
            option.classList.toggle("text-brand-700", selected);
            option.classList.toggle("ring-2", selected);
            option.classList.toggle("ring-brand-200", selected);
        });
    }

    function close() {
        modal.classList.add("hidden");
        detailsModal.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    }

    function openPayment(recipientId, amount) {
        if (!currentReport) {
            showToast("Balance report is still loading.", "error");
            return;
        }

        const recipients = currentReport.members
            .filter((member) => member.user_id !== currentUserId && Number(member.balance) > 0)
            .sort((a, b) => Number(b.balance) - Number(a.balance));
        const recipient = recipients.find((member) => String(member.user_id) === String(recipientId)) || recipients[0];
        recipientSelect.value = recipient?.user_id || "";

        const updateRecipientRaast = () => {
            const recipientName = document.getElementById("paymentRecipientName");
            const displayName = capitalizeInitial(recipient?.full_name || recipient?.email || "No eligible receiver");
            recipientName.textContent = displayName;
            recipientName.classList.remove("text-xl", "text-lg", "text-base");
            recipientName.classList.add(displayName.length <= 16 ? "text-xl" : displayName.length <= 28 ? "text-lg" : "text-base");
            if (recipient && !amount) {
                const owingMember = currentReport.members.find((member) => member.user_id === currentUserId);
                const owedAmount = Math.min(-Number(owingMember?.balance || 0), Number(recipient.balance));
                document.getElementById("paymentAmount").value = Math.max(0, owedAmount).toFixed(2);
                document.getElementById("paymentAmountDue").textContent = formatMoney(Math.max(0, owedAmount));
            } else if (recipient) {
                document.getElementById("paymentAmountDue").textContent = formatMoney(Math.min(Number(amount), Number(recipient.balance)));
            } else {
                document.getElementById("paymentRecipientName").textContent = "No eligible receiver";
                document.getElementById("paymentAmountDue").textContent = formatMoney(0);
            }
        };
        form.reset();
        methodSelect.value = "";
        document.querySelectorAll(".paymentMethodOption").forEach((option) => {
            option.classList.remove("border-brand-600", "bg-brand-50", "text-brand-700", "ring-2", "ring-brand-200");
        });
        recipientSelect.value = recipient?.user_id || "";
        if (amount) document.getElementById("paymentAmount").value = Number(amount).toFixed(2);
        updateRecipientRaast();
        document.getElementById("paymentFormMessage").innerHTML = "";
        detailsModal.classList.add("hidden");
        modal.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
    }

    document.getElementById("reportSummary").addEventListener("click", (event) => {
        const button = event.target.closest(".payMemberBtn");
        if (button) openPayment(button.dataset.recipient, button.dataset.amount);
    });

    document.getElementById("closePaymentModalBtn").addEventListener("click", close);
    document.getElementById("cancelPaymentBtn").addEventListener("click", close);
    document.getElementById("paymentModalOverlay").addEventListener("click", close);
    document.getElementById("paymentMethodOptions").addEventListener("click", async (event) => {
        const option = event.target.closest(".paymentMethodOption");
        if (!option) return;
        if (option.dataset.method === "stripe_card") {
            const recipient = recipientSelect.value;
            const amount = document.getElementById("paymentAmount").value;
            if (!recipient || !amount || Number(amount) <= 0) {
                showToast("Choose a recipient and enter a valid amount first.", "error");
                return;
            }
            option.disabled = true;
            try {
                const response = await apiRequest(`/api/tours/${tourId}/payments/stripe-checkout/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ recipient, amount, note: document.getElementById("paymentNote").value.trim() }),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.detail || "Unable to start card payment.");
                window.location.assign(data.checkout_url);
            } catch (error) {
                showToast(error.message, "error");
            } finally {
                option.disabled = false;
            }
            return;
        }
        methodSelect.value = option.dataset.method;
        updatePaymentMethodDetails();
        const methodNames = { cash: "Cash", bank_transfer: "Bank Transfer", jazzcash: "JazzCash", easypaisa: "EasyPaisa", raast: "Raast" };
        const methodEmojis = { cash: "💵", bank_transfer: "🏦", jazzcash: "💰", easypaisa: "📱", raast: "🔗" };
        const recipient = currentReport?.members.find((member) => String(member.user_id) === recipientSelect.value);
        document.getElementById("paymentDetailsTitle").textContent = `${methodNames[methodSelect.value]} payment`;
        document.getElementById("paymentDetailsEmoji").textContent = methodEmojis[methodSelect.value];
        document.getElementById("paymentDetailsRecipient").textContent = `Paying ${recipient?.full_name || "selected member"}`;
        document.getElementById("paymentFormMessage").innerHTML = "";
        modal.classList.add("hidden");
        detailsModal.classList.remove("hidden");
        if (window.lucide) lucide.createIcons();
    });
    document.getElementById("closePaymentDetailsBtn").addEventListener("click", close);
    document.getElementById("paymentDetailsModalOverlay").addEventListener("click", close);
    document.getElementById("cancelPaymentBtn").addEventListener("click", () => {
        detailsModal.classList.add("hidden");
        modal.classList.remove("hidden");
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submitButton = document.getElementById("paymentSubmitBtn");
        const payload = {
            recipient: recipientSelect.value,
            amount: document.getElementById("paymentAmount").value,
            payment_method: document.getElementById("paymentMethod").value,
            payment_details: {
                sender_account: document.getElementById("paymentSenderAccount")?.value.trim() || "",
                transaction_reference: document.getElementById("paymentTransactionReference")?.value.trim() || "",
            },
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
                throw new Error(
                    data.recipient?.[0] || data.amount?.[0] ||
                    data.payment_details?.sender_account?.[0] ||
                    data.payment_details?.transaction_reference?.[0] ||
                    "Unable to record payment."
                );
            }

            close();
            showToast("Payment recorded. Balances update after the recipient confirms it.");
            await loadReport();
        } catch (error) {
            document.getElementById("paymentFormMessage").innerHTML =
                `<div class="text-sm text-red-600">${escapeHtml(error.message)}</div>`;
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = "Submit payment";
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

        const currentMember = report.members.find((member) => member.user_id === currentUserId);
        const amountOwed = currentMember ? Math.max(0, -Number(currentMember.balance)) : 0;
        const rows = report.members
            .map((member) => {
                const balanceClass = member.balance > 0 ? "text-emerald-600" : member.balance < 0 ? "text-red-500" : "text-slate-400";
                const balanceLabel = member.balance > 0 ? "is owed" : member.balance < 0 ? "owes" : "settled up";
                const payButton = member.user_id === currentUserId && amountOwed > 0
                    ? `<button type="button" class="payMemberBtn rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold uppercase text-white shadow-soft transition hover:bg-brand-700" aria-label="Pay your balance">PAY</button>`
                    : "";
                return `
                <div class="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                    <div>
                        <p class="font-semibold text-slate-700">${escapeHtml(member.full_name)}</p>
                        <p class="text-xs text-slate-400">paid ${formatMoney(member.paid)} of ${formatMoney(member.share)} share</p>
                    </div>
                    <div class="text-right">
                        <div class="flex items-center justify-end gap-2">
                            <p class="${balanceClass} font-bold">${formatMoney(Math.abs(member.balance))}</p>
                            ${payButton}
                        </div>
                        <p class="text-xs ${member.balance < 0 ? "text-red-500" : "text-slate-400"}">${balanceLabel}</p>
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
                            ${payment.payment_method === "stripe_card" && payment.payment_details?.card_payment_received ? `<p class="mt-1 text-amber-700">Stripe charged the PayTogether account. The recipient must confirm after receiving their payout.</p>` : ""}
                            ${payment.payment_details?.sender_account || payment.payment_details?.transaction_reference ? `
                                <p class="mt-1 text-slate-500">
                                    ${payment.payment_details.sender_account ? `From: ${escapeHtml(payment.payment_details.sender_account)} ` : ""}
                                    ${payment.payment_details.transaction_reference ? `&middot; Ref: ${escapeHtml(payment.payment_details.transaction_reference)}` : ""}
                                </p>` : ""}
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

    const leaveModal = document.getElementById("leaveTourModal");
    const closeLeaveModal = () => {
        leaveModal.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
    };
    document.getElementById("leaveTourBtn").addEventListener("click", () => {
        leaveModal.classList.remove("hidden");
        document.body.classList.add("overflow-hidden");
    });
    document.getElementById("cancelLeaveTourBtn").addEventListener("click", closeLeaveModal);
    document.getElementById("leaveTourOverlay").addEventListener("click", closeLeaveModal);
    document.getElementById("confirmLeaveTourBtn").addEventListener("click", async (event) => {
        const confirmButton = event.currentTarget;
        confirmButton.disabled = true;
        confirmButton.textContent = "Leaving...";
        try {
            const response = await apiRequest(`/api/tours/${tourId}/leave/`, { method: "POST" });
            if (response.ok) {
                window.location.href = "/tours/";
            } else {
                const data = await response.json();
                closeLeaveModal();
                showToast(data.detail || "Unable to leave this tour.", "error");
            }
        } catch (error) {
            console.error(error);
            closeLeaveModal();
            showToast("Unable to leave this tour.", "error");
        } finally {
            confirmButton.disabled = false;
            confirmButton.textContent = "Leave tour";
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
