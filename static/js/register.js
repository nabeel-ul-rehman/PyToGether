const registerForm = document.getElementById("registerForm");
const messageBox = document.getElementById("message");

registerForm.addEventListener("submit", registerUser);

async function registerUser(event) {
    event.preventDefault();

    messageBox.innerHTML = "";

    const full_name = document.getElementById("full_name").value.trim();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
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