document.addEventListener("DOMContentLoaded", function () {
    if (!isAuthenticated()) return;

    const form = document.getElementById("joinTourForm");
    const input = document.getElementById("joinCode");
    const invitationCode = new URLSearchParams(window.location.search).get("code");

    if (invitationCode) {
        input.value = invitationCode.trim().toUpperCase();
    }

    input.addEventListener("input", () => {
        input.value = input.value.toUpperCase();
    });

    form.addEventListener("submit", joinTour);
});

function showMessage(message, type) {
    const styles = {
        success: "bg-green-100 border border-green-300 text-green-700",
        error: "bg-red-100 border border-red-300 text-red-700",
    };
    document.getElementById("message").innerHTML = `
        <div class="${styles[type] || styles.error} px-4 py-3 rounded-xl text-sm">${message}</div>`;
}

async function joinTour(event) {
    event.preventDefault();

    const joinButton = document.getElementById("joinButton");
    const code = document.getElementById("joinCode").value.trim();

    if (!code) {
        showMessage("Please enter a join code.", "error");
        return;
    }

    joinButton.disabled = true;
    joinButton.textContent = "Joining...";

    try {
        const response = await apiRequest("/api/tours/join/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ join_code: code }),
        });

        const data = await response.json();

        if (response.ok) {
            showMessage(data.message || "Joined successfully!", "success");
            setTimeout(() => {
                window.location.href = `/tours/${data.tour.id}/`;
            }, 900);
        } else {
            const errorMessage =
                data.join_code?.[0] || data.detail || data.non_field_errors?.[0] || "Unable to join this tour.";
            showMessage(errorMessage, "error");
        }
    } catch (error) {
        console.error(error);
        showMessage("Server error. Please try again.", "error");
    } finally {
        joinButton.disabled = false;
        joinButton.textContent = "Join Tour";
    }
}
