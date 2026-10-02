const registerForm = document.getElementById("registerForm");
const messageBox = document.getElementById("message");

registerForm.addEventListener("submit", registerUser);

const paymentMethodsContainer = document.getElementById("paymentMethods");
document.getElementById("addPaymentMethod").addEventListener("click", () => {
    const firstRow = paymentMethodsContainer.querySelector(".payment-method-row");
    const row = firstRow.cloneNode(true);
    row.querySelector("select").selectedIndex = 0;
    row.querySelector("input").value = "";
    row.querySelector(".remove-payment-method").classList.remove("hidden");
    paymentMethodsContainer.appendChild(row);
    updatePaymentMethodRows();
});

paymentMethodsContainer.addEventListener("change", (event) => {
    if (event.target.matches(".payment-method-select")) updatePaymentMethodRows();
});
paymentMethodsContainer.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".remove-payment-method");
    if (removeButton) {
        removeButton.closest(".payment-method-row").remove();
        updatePaymentMethodRows();
    }
});

function updatePaymentMethodRows() {
    const rows = [...paymentMethodsContainer.querySelectorAll(".payment-method-row")];
    rows.forEach((row) => {
        const isCash = row.querySelector("select").value === "cash";
        const identifier = row.querySelector("input");
        identifier.disabled = isCash;
        identifier.required = !isCash;
        identifier.placeholder = isCash ? "No account details needed" : "Account number or ID";
        row.querySelector(".remove-payment-method").classList.toggle("hidden", rows.length === 1);
    });
}
updatePaymentMethodRows();

async function registerUser(event) {
    event.preventDefault();

    messageBox.innerHTML = "";

    const full_name = document.getElementById("full_name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const payment_methods = [...paymentMethodsContainer.querySelectorAll(".payment-method-row")].map((row) => ({
        method: row.querySelector("select").value,
        identifier: row.querySelector("input").value.trim(),
    }));
    const password = document.getElementById("password").value;
    const confirm_password = document.getElementById("confirm_password").value

    if (
        !full_name ||
        !email ||
        !password ||
        !confirm_password
    ) {
        showMessage(
            "Please fill all required fields.",
            "red"
        );

        return;
    }

    if (password !== confirm_password) {
        showMessage(
            "Passwords do not match.",
            "red"
        );

        return;
    }

    try {
        const response = await fetch("/api/register/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                full_name,
                email,
                phone,
                payment_methods,
                password,
                confirm_password
            })
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(
                "Registration Successful!",
                "green"
            );
            registerForm.reset();
            setTimeout(() => {
                window.location.href = "/login";
            }, 1500);
        }
        else {
            displayErrors(data);
        }

    } catch (error) {
        showMessage(
            "Server error. Please try again later.",
            "red"
        );
        console.error(error);
    }
}

function showMessage(message, color) {
    messageBox.innerHTML = `
        <div class="p-3 rounded text-white bg-${color}-500">
            ${message}
        </div>
    `;
}

function displayErrors(errors) {
    let html = "";

    for (let field in errors) {
        html += `
            <p class="text-red-600">
                ${field}: ${errors[field]}
            </p>
        `;
    }

    messageBox.innerHTML = html;
}
