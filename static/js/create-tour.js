document
    .getElementById("tourform")
    .addEventListener("submit",createtour);

const imageInput = document.getElementById("image");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");

imageInput.addEventListener("change", function () {
    const file = this.files[0];

    if (!file) {
        imagePreviewContainer.classList.add("hidden");
        imagePreview.removeAttribute("src");
        return;
    }

    if (!file.type.startsWith("image/")) {
        this.value = "";
        imagePreviewContainer.classList.add("hidden");
        showMessage("Please select an image file.", "error");
        return;
    }

    imagePreview.src = URL.createObjectURL(file);
    imagePreviewContainer.classList.remove("hidden");
});

async function createtour(e) {
    e.preventDefault();

    const token = localStorage.getItem("access_token");

    if(!token){
        window.location.href = "/login/";
        return;
    }

    const formData = new FormData();
    formData.append("title", document.getElementById("title").value.trim());
    formData.append("destination", document.getElementById("destination").value.trim());
    formData.append("description", document.getElementById("description").value.trim());
    formData.append("budget", document.getElementById("budget").value);
    formData.append("start_date", document.getElementById("startDate").value);
    formData.append("end_date", document.getElementById("endDate").value);
    formData.append("status", document.getElementById("status").value);

    if (imageInput.files[0]) {
        formData.append("image", imageInput.files[0]);
    }

    const response = await fetch("/api/tours/create/",{
        method: "POST",

       headers: {
        "Authorization": `Bearer ${token}`,
    },

        body: formData,
    });
    const data =await response.json();
    const message= document.getElementById("message");

    if(response.ok){
        showMessage("Tour created successfully.", "success");
        setTimeout(() =>{
        window.location.href ="/tours/";
    },1200);
    } else{
        showMessage(Object.values(data).flat().join(" ") || "Unable to create tour.", "error");
    }
}

function showMessage(text, type) {
    const message = document.getElementById("message");
    const style = type === "success"
        ? "bg-green-100 border-green-400 text-green-700"
        : "bg-red-100 border-red-400 text-red-700";
    message.innerHTML = `<div class="border ${style} px-4 py-3 rounded">${escapeHtml(text)}</div>`;
}

function escapeHtml(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
}
