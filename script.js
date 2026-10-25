/* ==================================
   RABESH ART PORTFOLIO
   Gallery + Local Artwork Upload
================================== */

const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("artImage");
const fileLabel = document.getElementById("fileLabel");
const titleInput = document.getElementById("artTitle");
const categoryInput = document.getElementById("artCategory");
const descriptionInput = document.getElementById("artDescription");

const imagePreview = document.getElementById("imagePreview");
const previewContainer = document.getElementById("previewContainer");
const removePreviewButton = document.getElementById("removePreview");

const gallery = document.getElementById("artGrid");
const emptyState = document.getElementById("emptyState");

const publishButton = document.getElementById("publishButton");
const formMessage = document.getElementById("formMessage");

const modal = document.getElementById("artModal");
const modalImage = document.getElementById("modalImage");
const modalTitle = document.getElementById("modalTitle");
const modalCategory = document.getElementById("modalCategory");
const modalDescription = document.getElementById("modalDescription");
const modalClose = document.getElementById("modalClose");

let selectedFile = null;
let previewURL = null;
let activeFilter = "All";

const imageURLs = new Map();

const MAX_FILE_SIZE = 10 * 1024 * 1024;


/* ==================================
   1. OPEN THE LOCAL DATABASE
================================== */

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("RabeshArtPortfolio", 1);

        request.onupgradeneeded = () => {
            const database = request.result;

            if (!database.objectStoreNames.contains("artworks")) {
                database.createObjectStore("artworks", {
                    keyPath: "id",
                    autoIncrement: true
                });
            }
        };

        request.onsuccess = () => resolve(request.result);

        request.onerror = () => reject(request.error);
    });
}


async function databaseRequest(mode, operation) {
    const database = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = database.transaction("artworks", mode);
        const store = transaction.objectStore("artworks");

        let request;

        try {
            request = operation(store);
        } catch (error) {
            database.close();
            reject(error);
            return;
        }

        let result;

        if (request) {
            request.onsuccess = () => {
                result = request.result;
            };

            request.onerror = () => {
                reject(request.error);
            };
        }

        transaction.oncomplete = () => {
            database.close();
            resolve(result);
        };

        transaction.onerror = () => {
            database.close();
            reject(transaction.error);
        };

        transaction.onabort = () => {
            database.close();
            reject(transaction.error || new Error("Database operation failed."));
        };
    });
}


function getAllArtworks() {
    return databaseRequest("readonly", store => store.getAll());
}


function saveArtwork(artwork) {
    return databaseRequest("readwrite", store => store.add(artwork));
}


function removeArtwork(id) {
    return databaseRequest("readwrite", store => store.delete(id));
}


/* ==================================
   2. IMAGE PREVIEW
================================== */

function clearPreview() {
    selectedFile = null;

    fileInput.value = "";
    fileLabel.textContent = "Choose your artwork";

    previewContainer.hidden = true;
    imagePreview.removeAttribute("src");

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
        previewURL = null;
    }
}


fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];

    if (!file) {
        return;
    }

    const validTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!validTypes.includes(file.type)) {
        clearPreview();
        showMessage("Please select a JPG, PNG, or WebP image.");
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        clearPreview();
        showMessage("The image must be smaller than 10 MB.");
        return;
    }

    if (previewURL) {
        URL.revokeObjectURL(previewURL);
    }

    selectedFile = file;
    previewURL = URL.createObjectURL(file);

    imagePreview.src = previewURL;
    previewContainer.hidden = false;
    fileLabel.textContent = file.name;

    showMessage("Image selected successfully.");
});


removePreviewButton.addEventListener("click", () => {
    clearPreview();
    showMessage("Image removed. Choose another image.");
});


function showMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.style.color = isError ? "#ff8c8c" : "";
}


/* ==================================
   3. COMPRESS LARGE IMAGES
================================== */

async function prepareImage(file) {
    const image = new Image();
    const temporaryURL = URL.createObjectURL(file);

    try {
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(
                new Error("Unable to read this image.")
            );

            image.src = temporaryURL;
        });

        const maxDimension = 1600;

        const scale = Math.min(
            1,
            maxDimension / Math.max(image.width, image.height)
        );

        const canvas = document.createElement("canvas");

        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));

        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Unable to process this image.");
        }

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
        );

        return await new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Image compression failed."));
                }
            }, "image/webp", 0.85);
        });

    } finally {
        URL.revokeObjectURL(temporaryURL);
    }
}


/* ==================================
   4. UPLOAD AND SAVE ARTWORK
================================== */

form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedFile) {
        showMessage("Please choose an artwork image first.", true);
        return;
    }

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const category = categoryInput.value;

    if (!title) {
        showMessage("Please enter an artwork title.", true);
        return;
    }

    publishButton.disabled = true;
    publishButton.textContent = "Saving your artwork...";

    try {
        const imageBlob = await prepareImage(selectedFile);

        const artwork = {
            title,
            description,
            category,
            imageBlob,
            createdAt: new Date().toISOString()
        };

        await saveArtwork(artwork);

        form.reset();
        clearPreview();

        showMessage("Your artwork has been added to the gallery!");

        await renderGallery();

        document.getElementById("gallery").scrollIntoView({
            behavior: "smooth"
        });

    } catch (error) {
        console.error(error);

        showMessage(
            "Could not save your artwork. Check browser storage and try again.",
            true
        );

    } finally {
        publishButton.disabled = false;
        publishButton.innerHTML = 'Add to my gallery <span>↗</span>';
    }
});


/* ==================================
   5. CREATE GALLERY CARDS
================================== */

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = text;
    }

    return element;
}


function getImageURL(artwork) {
    if (!imageURLs.has(artwork.id)) {
        const url = URL.createObjectURL(artwork.imageBlob);
        imageURLs.set(artwork.id, url);
    }

    return imageURLs.get(artwork.id);
}


function formatDate(dateString) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString("en", {
        month: "short",
        year: "numeric"
    });
}


function createArtworkCard(artwork) {
    const card = createElement("article", "art-card");

    const imageWrap = createElement("div", "art-image-wrap");

    imageWrap.tabIndex = 0;
    imageWrap.setAttribute(
        "aria-label",
        `View artwork: ${artwork.title}`
    );

    const image = createElement("img", "art-image");

    image.src = getImageURL(artwork);
    image.alt = artwork.title;
    image.loading = "lazy";

    const overlay = createElement("div", "art-overlay");

    const overlayTitle = createElement("span", "", artwork.title);
    const openIcon = createElement("span", "art-open-icon", "↗");

    overlay.append(overlayTitle, openIcon);
    imageWrap.append(image, overlay);

    imageWrap.addEventListener("click", () => {
        openArtwork(artwork);
    });

    imageWrap.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openArtwork(artwork);
        }
    });

    const info = createElement("div", "art-info");

    const category = createElement(
        "span",
        "art-category",
        artwork.category
    );

    const infoTop = createElement("div", "art-info-top");

    const title = createElement("h3", "", artwork.title);

    const date = createElement(
        "time",
        "",
        formatDate(artwork.createdAt)
    );

    infoTop.append(title, date);

    info.append(category, infoTop);

    if (artwork.description) {
        info.append(
            createElement("p", "", artwork.description)
        );
    }

    const deleteButton = createElement(
        "button",
        "delete-art",
        "Delete artwork ×"
    );

    deleteButton.type = "button";

    deleteButton.addEventListener("click", async () => {
        const confirmed = window.confirm(
            `Delete "${artwork.title}" from this browser?`
        );

        if (!confirmed) {
            return;
        }

        try {
            await removeArtwork(artwork.id);

            const url = imageURLs.get(artwork.id);

            if (url) {
                URL.revokeObjectURL(url);
                imageURLs.delete(artwork.id);
            }

            await renderGallery();

        } catch (error) {
            console.error(error);
            showMessage("Unable to delete this artwork.", true);
        }
    });

    info.append(deleteButton);
    card.append(imageWrap, info);

    return card;
}


/* ==================================
   6. DISPLAY AND FILTER ARTWORKS
================================== */

async function renderGallery() {
    const artworks = await getAllArtworks();

    gallery.replaceChildren();

    const filteredArtworks = artworks
        .filter(artwork => {
            return activeFilter === "All" ||
                artwork.category === activeFilter;
        })
        .sort((a, b) => b.id - a.id);

    filteredArtworks.forEach((artwork, index) => {
        const card = createArtworkCard(artwork);

        card.style.animationDelay = `${Math.min(index, 8) * 60}ms`;

        gallery.append(card);
    });

    emptyState.hidden = filteredArtworks.length > 0;

    if (artworks.length > 0 && filteredArtworks.length === 0) {
        emptyState.querySelector("h3").textContent =
            "Nothing in this collection yet.";

        emptyState.querySelector("p").textContent =
            "Try another category or upload a new artwork.";

        emptyState.querySelector(".primary-button").textContent =
            "Add artwork ↗";

    } else if (artworks.length === 0) {
        emptyState.querySelector("h3").textContent =
            "Your gallery starts here.";

        emptyState.querySelector("p").textContent =
            "Every artist begins with a blank canvas. Upload your first artwork to bring this space to life.";

        emptyState.querySelector(".primary-button").textContent =
            "Add your first artwork ↗";
    }
}


document.querySelectorAll(".filter-btn").forEach(button => {
    button.addEventListener("click", async () => {
        activeFilter = button.dataset.filter;

        document.querySelectorAll(".filter-btn").forEach(item => {
            item.classList.toggle("active", item === button);
        });

        try {
            await renderGallery();
        } catch (error) {
            console.error(error);
            showMessage("Unable to load the gallery.", true);
        }
    });
});


/* ==================================
   7. FULL-SIZE ARTWORK VIEWER
================================== */

function openArtwork(artwork) {
    modalImage.src = getImageURL(artwork);
    modalImage.alt = artwork.title;

    modalTitle.textContent = artwork.title;
    modalCategory.textContent = artwork.category;

    modalDescription.textContent =
        artwork.description || "A piece from the Rabesh art collection.";

    modal.showModal();
}


modalClose.addEventListener("click", () => {
    modal.close();
});


modal.addEventListener("click", event => {
    if (event.target === modal) {
        modal.close();
    }
});


/* ==================================
   8. START THE WEBSITE
================================== */

async function startPortfolio() {
    try {
        await renderGallery();
    } catch (error) {
        console.error(error);

        showMessage(
            "The gallery could not load. Try refreshing the page.",
            true
        );
    }
}

startPortfolio();
