let currentSearch = "";

let searchTimeout = null;

let currentPage = 1;

let totalTours = 0;

const toursPerPage = 10;

let selectedTourId = null;

let selectedTourTitle = "";


document.addEventListener("DOMContentLoaded", function () {

    checkAuthentication();

    setupSearch();

    setupPagination();

    setupTourActions();

    setupDeleteModal();

    setupShareModal();

});



function setupDeleteModal() {

    const confirmDeleteBtn = document.getElementById(
        "confirmDeleteBtn"
    );


    const cancelDeleteBtn = document.getElementById(
        "cancelDeleteBtn"
    );


    const closeDeleteModalBtn = document.getElementById(
        "closeDeleteModalBtn"
    );


    const deleteModalOverlay = document.getElementById(
        "deleteModalOverlay"
    );


    // Confirm deletion

    confirmDeleteBtn.addEventListener(
        "click",
        function () {

            deleteTour();

        }
    );


    // Cancel deletion

    cancelDeleteBtn.addEventListener(
        "click",
        closeDeleteModal
    );


    // Close button

    closeDeleteModalBtn.addEventListener(
        "click",
        closeDeleteModal
    );


    // Click outside modal

    deleteModalOverlay.addEventListener(
        "click",
        closeDeleteModal
    );

}

function openDeleteModal(tourId, tourTitle) {

    selectedTourId = tourId;

    selectedTourTitle = tourTitle;


    const deleteModal = document.getElementById(
        "deleteModal"
    );


    const deleteModalMessage = document.getElementById(
        "deleteModalMessage"
    );


    deleteModalMessage.textContent =
        `Are you sure you want to delete "${tourTitle}"?`;


    deleteModal.classList.remove(
        "hidden"
    );


    document.body.classList.add(
        "overflow-hidden"
    );

}

function closeDeleteModal() {

    const deleteModal = document.getElementById(
        "deleteModal"
    );


    deleteModal.classList.add(
        "hidden"
    );


    document.body.classList.remove(
        "overflow-hidden"
    );


    selectedTourId = null;

    selectedTourTitle = "";

}

async function deleteTour() {

    if (!selectedTourId) {

        return;

    }

    const tourIdToDelete =
        selectedTourId;


    const tourTitleToDelete =
        selectedTourTitle;


    const token = localStorage.getItem(
        "access_token"
    );


    const confirmDeleteBtn = document.getElementById(
        "confirmDeleteBtn"
    );


    const originalButtonText =
        confirmDeleteBtn.textContent;


    confirmDeleteBtn.disabled = true;

    confirmDeleteBtn.textContent =
        "Deleting...";


    try {

        const response = await fetch(
            `/api/tours/${selectedTourId}/`,
            {

                method: "DELETE",

                headers: {

                    "Authorization": `Bearer ${token}`,

                },

            }
        );


        // Token expired or invalid

        if (response.status === 401) {

            handleUnauthorized();

            return;

        }


        // Tour does not exist or user does not own it

        if (response.status === 404) {

            closeDeleteModal();


            showMessage(
                "Tour not found or you do not have permission to delete it.",
                "error"
            );


            loadTours();

            return;

        }


        // Successful deletion

        if (response.status === 204) {

            closeDeleteModal();


            showMessage(
                `"${tourTitleToDelete}" deleted successfully.`,
                "success"
            );


            handlePageAfterDeletion();

            return;

        }


        // Other server errors

        let data = null;


        try {

            data = await response.json();

        }

        catch {

            // No JSON response

        }


        showMessage(
            getApiErrorMessage(data),
            "error"
        );

    }

    catch (error) {

        console.error(
            "Error deleting tour:",
            error
        );


        showMessage(
            "Unable to delete the tour. Please try again.",
            "error"
        );

    }

    finally {

        confirmDeleteBtn.disabled = false;

        confirmDeleteBtn.textContent =
            originalButtonText;

    }

}

function handlePageAfterDeletion() {

    const totalPagesBeforeDeletion =
        Math.ceil(
            totalTours / toursPerPage
        );


    const totalToursAfterDeletion =
        totalTours - 1;


    const totalPagesAfterDeletion =
        Math.ceil(
            totalToursAfterDeletion /
            toursPerPage
        );


    if (
        currentPage > totalPagesAfterDeletion &&
        currentPage > 1
    ) {

        currentPage--;

    }


    totalTours =
        totalToursAfterDeletion;


    loadTours();

}

function setupTourActions() {

    const tableBody = document.getElementById(
        "tourTableBody"
    );


    tableBody.addEventListener(
        "click",
        function (event) {

            // Edit button

            const editButton =
                event.target.closest(".editTourBtn");


            if (editButton) {

                const tourId =
                    editButton.dataset.tourId;


                window.location.href =
                    `/tours/edit/${tourId}/`;

                return;

            }


            const copyButton = event.target.closest(".copyJoinCodeBtn");

            if (copyButton) {

                copyJoinCode(copyButton.dataset.joinCode);

                return;

            }


            const shareButton = event.target.closest(".shareJoinCodeBtn");

            if (shareButton) {

                shareTour(
                    shareButton.dataset.tourTitle,
                    shareButton.dataset.joinCode
                );

                return;

            }


            // Delete button

            const deleteButton =
                event.target.closest(".deleteTourBtn");


            if (deleteButton) {

                const tourId =
                    deleteButton.dataset.tourId;


                const tourTitle =
                    deleteButton.dataset.tourTitle;


                openDeleteModal(
                    tourId,
                    tourTitle
                );

            }

        }
    );

}

function setupSearch() {

    const searchForm = document.getElementById(
        "searchForm"
    );

    const searchInput = document.getElementById(
        "searchInput"
    );

    const clearSearchBtn = document.getElementById(
        "clearSearchBtn"
    );

    // Search when form is submitted

    searchForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();

            clearTimeout(searchTimeout);

            currentSearch = searchInput.value.trim();

            currentPage = 1;

            loadTours();

        }
    );

    clearSearchBtn.addEventListener(
        "click",
        function () {
            clearTimeout(searchTimeout);
            searchInput.value = "";
            currentSearch = "";
            currentPage = 1;
            loadTours();
        }
    );


    // Live Search with Debounce

    searchInput.addEventListener(
        "input",
        function () {

            clearTimeout(searchTimeout);


            searchTimeout = setTimeout(
                function () {

                    currentSearch = searchInput.value.trim();

                    currentPage = 1;

                    loadTours();

                },
                500
            );

        }
    );

}


function checkAuthentication() {

    const token = localStorage.getItem("access_token");

    if (!token) {

        window.location.href = "/login/";

        return;

    }

    loadTours();

}

function renderTours(tours) {

    const tableBody = document.getElementById(
        "tourTableBody"
    );

    tableBody.innerHTML = "";

    tours.forEach(function (tour) {
        const description = (tour.description || "No description")
            .replace(/\s+/g, " ")
            .trim();
        const descriptionPreview = description.length > 90
            ? `${description.slice(0, 90).trim()}...`
            : description;

        const row = `

            <tr class="hover:bg-slate-50 transition">

                <td class="whitespace-nowrap">

    ${
        tour.image
            ? `
                <img
                    src="${tour.image}"
                    alt="${escapeHtml(tour.title)}"
                    class="h-10 w-10 object-cover rounded-lg sm:h-16 sm:w-16"
                >
              `
            : `
                <div
                    class="h-10 w-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-400 sm:h-16 sm:w-16">

                    <i data-lucide="map" class="w-6 h-6"></i>

                </div>
              `
    }

</td>


                <td>



                    <div class="min-w-0 truncate text-xs font-semibold text-gray-800 sm:text-sm">

                        ${escapeHtml(tour.title)}

                    </div>

                    <div class="mt-1 line-clamp-2 min-w-0 text-[10px] leading-4 text-gray-500 sm:text-xs sm:leading-5" title="${escapeHtml(description)}">

                        ${escapeHtml(descriptionPreview)}

                    </div>

                </td>

                <td class="hidden text-gray-700 sm:table-cell">

                    ${escapeHtml(tour.destination)}

                </td>

                <td class="hidden whitespace-nowrap sm:table-cell">

                    <button
                        type="button"
                        class="copyJoinCodeBtn inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-2 font-mono text-xs font-bold tracking-wider text-brand-700 transition hover:bg-brand-100"
                        data-join-code="${escapeHtml(tour.join_code || "")}">

                        ${escapeHtml(tour.join_code || "------")}
                        <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    </button>

                </td>

                <td class="whitespace-nowrap text-right text-[10px] font-medium text-gray-800 sm:text-xs">

                    ${formatCurrency(tour.budget)}

                </td>

                <td class="hidden text-sm text-gray-600 sm:table-cell">

                    <div>

                        ${formatDate(tour.start_date)}

                    </div>

                    <div class="text-gray-400 my-1">

                        to

                    </div>

                    <div>

                        ${formatDate(tour.end_date)}

                    </div>

                </td>

                <td class="hidden sm:table-cell">

                    ${getStatusBadge(tour.status)}

                </td>

                <td class="overflow-visible text-center">

                    <div class="flex flex-wrap items-center justify-center gap-1.5">

                    <a  href="/tours/${tour.id}/"
                        class="inline-flex items-center justify-center gap-1 rounded-lg border border-accent-200 bg-accent-50 px-2 py-2 text-xs font-bold text-accent-700 transition hover:border-brand-600 hover:bg-brand-600 hover:text-white hover:shadow-md sm:px-2.5">

                        <i data-lucide="eye" class="w-3.5 h-3.5"></i>

                        <span class="hidden sm:inline">View</span>

                    </a>
                    
                    </div>

                </td>

            </tr>

        `;

        tableBody.insertAdjacentHTML(
            "beforeend",
            row
        );

    });

    if (window.lucide) {

        lucide.createIcons();

    }

}


async function copyTextToClipboard(text) {

    if (!text) {

        throw new Error("No join code available.");

    }

    if (navigator.clipboard && window.isSecureContext) {

        await navigator.clipboard.writeText(text);

        return;

    }

    const textArea = document.createElement("textarea");

    textArea.value = text;

    textArea.style.position = "fixed";

    textArea.style.opacity = "0";

    document.body.appendChild(textArea);

    textArea.select();

    const copied = document.execCommand("copy");

    textArea.remove();

    if (!copied) {

        throw new Error("Clipboard access was denied.");

    }

}


async function copyJoinCode(joinCode) {

    try {

        await copyTextToClipboard(joinCode);

        showMessage("Join code copied to clipboard.", "success");

    }

    catch (error) {

        console.error("Unable to copy join code:", error);

        showMessage("Unable to copy the join code. Please copy it manually.", "error");

    }

}


let activeShare = null;


function shareTour(tourTitle, joinCode) {

    if (!joinCode) {

        showMessage("A join code is not available for this tour.", "error");

        return;

    }

    const inviteLink = new URL("/tours/join/", window.location.origin);

    inviteLink.searchParams.set("code", joinCode);

    const shareText = `Join my tour "${tourTitle}" on PayTogether: ${inviteLink.toString()}`;

    activeShare = {
        title: tourTitle,
        link: inviteLink.toString(),
        text: shareText,
    };

    document.getElementById("shareTourName").textContent = tourTitle;
    document.getElementById("shareLinkInput").value = activeShare.link;
    document.getElementById("shareWhatsAppBtn").href =
        `https://wa.me/?text=${encodeURIComponent(activeShare.text)}`;
    document.getElementById("shareTelegramBtn").href =
        `https://t.me/share/url?url=${encodeURIComponent(activeShare.link)}&text=${encodeURIComponent(`Join my tour "${tourTitle}" on PayTogether`)}`;
    document.getElementById("shareEmailBtn").href =
        `mailto:?subject=${encodeURIComponent(`Join ${tourTitle} on PayTogether`)}&body=${encodeURIComponent(activeShare.text)}`;
    document.getElementById("shareFacebookBtn").href =
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(activeShare.link)}`;
    document.getElementById("shareXBtn").href =
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(activeShare.text)}`;
    document.getElementById("shareSmsBtn").href =
        `sms:?&body=${encodeURIComponent(activeShare.text)}`;
    document.getElementById("shareLinkedInBtn").href =
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(activeShare.link)}`;
    document.getElementById("shareRedditBtn").href =
        `https://www.reddit.com/submit?url=${encodeURIComponent(activeShare.link)}&title=${encodeURIComponent(`Join ${tourTitle} on PayTogether`)}`;
    document.getElementById("moreShareOptions").classList.add("hidden");
    document.getElementById("shareNativeBtn").setAttribute("aria-expanded", "false");

    document.getElementById("shareModal").classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
}


function setupShareModal() {

    const modal = document.getElementById("shareModal");
    const closeButton = document.getElementById("closeShareModalBtn");
    const overlay = document.getElementById("shareModalOverlay");
    const copyButton = document.getElementById("copyShareLinkBtn");
    const nativeButton = document.getElementById("shareNativeBtn");

    function closeShareModal() {

        modal.classList.add("hidden");
        document.body.classList.remove("overflow-hidden");
        activeShare = null;

    }

    closeButton.addEventListener("click", closeShareModal);
    overlay.addEventListener("click", closeShareModal);

    copyButton.addEventListener("click", async function () {

        if (!activeShare) return;

        try {

            await copyTextToClipboard(activeShare.link);
            copyButton.textContent = "Copied!";

            setTimeout(function () {

                copyButton.innerHTML = '<i data-lucide="copy" class="w-4 h-4"></i> Copy';

                if (window.lucide) lucide.createIcons();

            }, 1500);

        }

        catch (error) {

            console.error("Unable to copy invitation link:", error);
            showMessage("Unable to copy the invitation link.", "error");

        }

    });

    nativeButton.addEventListener("click", function () {

        const moreOptions = document.getElementById("moreShareOptions");
        const isOpen = !moreOptions.classList.contains("hidden");

        moreOptions.classList.toggle("hidden", isOpen);
        nativeButton.setAttribute("aria-expanded", String(!isOpen));

    });

}


function formatCurrency(amount) {

    const number = Number(amount || 0);

    return new Intl.NumberFormat(
        "en-PK",
        {
            style: "currency",
            currency: "PKR",
            minimumFractionDigits: 2,
        }
    ).format(number);

}


function formatDate(dateString) {

    if (!dateString) {

        return "-";

    }

    const date = new Date(
        `${dateString}T00:00:00`
    );

    return new Intl.DateTimeFormat(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
        }
    ).format(date);

}


function getStatusBadge(status) {

    const statusMap = {

        planned: {
            label: "Planned",
            classes: "bg-blue-100 text-blue-700"
        },

        ongoing: {
            label: "Ongoing",
            classes: "bg-yellow-100 text-yellow-700"
        },

        completed: {
            label: "Completed",
            classes: "bg-green-100 text-green-700"
        },

        cancelled: {
            label: "Cancelled",
            classes: "bg-red-100 text-red-700"
        }

    };


    const statusData = statusMap[status] || {

        label: status || "Unknown",
        classes: "bg-gray-100 text-gray-700"

    };


    return `

        <span
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusData.classes}">

            ${escapeHtml(statusData.label)}

        </span>

    `;

}


function escapeHtml(value) {

    const text = String(value ?? "");

    const div = document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


async function loadTours() {

    const token = localStorage.getItem("access_token");

    
    showLoading();

    const params = new URLSearchParams();

    params.set("page", currentPage);
    

    if (currentSearch.trim() !== "") {

        params.set(
            "search",
            currentSearch.trim()
        );

    }

    let apiUrl = `/api/tours/?${params.toString()}`;

    // if (currentSearch.trim() !== "") {

    //     apiUrl += `?search=${encodeURIComponent(
    //         currentSearch.trim()
    //     )}`;
        

    // }
    
    try {

        const response = await fetch(apiUrl, {

            method: "GET",

            headers: {

                "Authorization": `Bearer ${token}`,

                // "Content-Type": "application/json",

            },
            

        });


        if (response.status === 401) {

            handleUnauthorized();

            return;

        }


        if (!response.ok) {

            throw new Error(
                "Unable to load tours."
            );

        }


        const data = await response.json();

        console.log("Tour API Response:", data);

        totalTours = data.count;

        if (data.count === 0) {

            showEmptyState();

            updatePagination(null, null);

            return;

        }


        showTableContainer();


        renderTours(data.results);

        updatePagination(
            data.next,
            data.previous
        );

        

    }

    catch (error) {

        

        console.error(
            "Error loading tours:",
            error
        );

        showError(
            "Unable to load tours. Please try again."
        );

    }

}





function setupPagination() {

    const previousPageBtn = document.getElementById(
        "previousPageBtn"
    );

    const nextPageBtn = document.getElementById(
        "nextPageBtn"
    );


    previousPageBtn.addEventListener(
        "click",
        function () {

            if (currentPage > 1) {

                currentPage--;

                loadTours();

            }

        }
    );


    nextPageBtn.addEventListener(
        "click",
        function () {

            const totalPages = Math.ceil(
                totalTours / toursPerPage
            );


            if (currentPage < totalPages) {

                currentPage++;

                loadTours();

            }

        }
    );

}


function updatePagination(nextUrl, previousUrl) {

    const paginationContainer = document.getElementById(
        "paginationContainer"
    );

    const previousPageBtn = document.getElementById(
        "previousPageBtn"
    );

    const nextPageBtn = document.getElementById(
        "nextPageBtn"
    );

    const currentPageInfo = document.getElementById(
        "currentPageInfo"
    );

    const paginationInfo = document.getElementById(
        "paginationInfo"
    );


    if (totalTours === 0) {

        paginationContainer.classList.add("hidden");

        return;

    }


    paginationContainer.classList.remove("hidden");


    const totalPages = Math.ceil(
        totalTours / toursPerPage
    );


    const startItem =
        ((currentPage - 1) * toursPerPage) + 1;


    const endItem = Math.min(
        currentPage * toursPerPage,
        totalTours
    );


    paginationInfo.textContent =
        `Showing ${startItem}–${endItem} of ${totalTours} tours`;


    currentPageInfo.textContent =
        `Page ${currentPage} of ${totalPages}`;


    previousPageBtn.disabled = !previousUrl;

    nextPageBtn.disabled = !nextUrl;

}



function showLoading() {

    document
        .getElementById("loadingState")
        .classList
        .remove("hidden");


    document
        .getElementById("emptyState")
        .classList
        .add("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .add("hidden");

    document
        .getElementById("paginationContainer")
        .classList
        .add("hidden");


    document
        .getElementById("messageArea")
        .innerHTML = "";

}


function showEmptyState() {

    document
        .getElementById("loadingState")
        .classList
        .add("hidden");


    document
        .getElementById("emptyState")
        .classList
        .remove("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .add("hidden");

    document
    .getElementById("paginationContainer")
    .classList
    .add("hidden");


    const title = document.getElementById(
        "emptyStateTitle"
    );

    const message = document.getElementById(
        "emptyStateMessage"
    );

    const button = document.getElementById(
        "emptyStateButton"
    );


    if (currentSearch.trim() !== "") {

        title.textContent = "No Matching Tours";

        message.textContent =
            `We couldn't find any tours matching "${currentSearch}".`;

        button.classList.add("hidden");

    }

    else {

        title.textContent = "No Tours Found";

        message.textContent =
            "You haven't created any tours yet.";

        button.classList.remove("hidden");

    }

}

function showTableContainer() {

    document
        .getElementById("loadingState")
        .classList
        .add("hidden");


    document
        .getElementById("emptyState")
        .classList
        .add("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .remove("hidden");

}


function showMessage(message, type) {

    const messageArea = document.getElementById(
        "messageArea"
    );


    const styles = {

        success:
            "bg-green-100 border border-green-300 text-green-700",

        error:
            "bg-red-100 border border-red-300 text-red-700"

    };


    messageArea.innerHTML = `

        <div class="${styles[type] || styles.error} px-5 py-4 rounded-lg">

            ${escapeHtml(message)}

        </div>

    `;

}


function handleUnauthorized() {

    localStorage.removeItem("access_token");

    localStorage.removeItem("refresh_token");


    window.location.href = "/login/";

}


function showError(message) {

    document
        .getElementById("loadingState")
        .classList
        .add("hidden");


    document
        .getElementById("emptyState")
        .classList
        .add("hidden");


    document
        .getElementById("tableContainer")
        .classList
        .add("hidden");


    document
        .getElementById("messageArea")
        .innerHTML = `

            <div class="bg-red-100 border border-red-300 text-red-700 px-5 py-4 rounded-lg">

                ${message}

            </div>

        `;

}
