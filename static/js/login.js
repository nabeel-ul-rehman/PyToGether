const loginForm = document.getElementById("loginForm");
const messageBox = document.getElementById("message");
const loginButton = document.getElementById("loginButton");

loginForm.addEventListener("submit", loginUser);

async function loginUser(event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    messageBox.innerHTML = "";

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    try {
        const response = await fetch("/api/login/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email,
                password,
            }),
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem(
                "access_token",
                data.tokens.access
            );

            localStorage.setItem(
                "refresh_token",
                data.tokens.refresh
            );

            localStorage.setItem(
                "user_name",
                data.user.full_name
            );

            showMessage(
                "Login Successful!",
                "success"
            );

            setTimeout(() => {
                window.location.href = "/dashboard";
            }, 1000);

        } else {
            const errorMessage =
                data.detail ||
                data.non_field_errors?.[0] ||
                "Invalid email or password.";

            showMessage(
                errorMessage,
                "error"
            );
        }

    } catch (error) {
        console.error(error);

        showMessage(
            "Server error. Please try again.",
            "error"
        );
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
}

function showMessage(message, type) {
    const bg =
        type === "success"
            ? "bg-green-500"
            : "bg-red-500";

    messageBox.innerHTML = `
        <div class="${bg} text-white rounded-lg p-3">
            ${message}
        </div>
    `;
}