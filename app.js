const DEFAULT_API_BASE = "http://kg1clqqc9zi1meq787vqdwi0.46.224.151.129.sslip.io";

const state = {
    apiBase: localStorage.getItem("karabiber_api_base") || DEFAULT_API_BASE,
    token: localStorage.getItem("karabiber_token") || "",
    user: parseJSON(localStorage.getItem("karabiber_user")),
    products: [],
    categories: [],
    cart: parseJSON(localStorage.getItem("karabiber_cart")) || [],
    selectedCategory: "",
    search: "",
    selectedColor: { id: "crimson", name: "Crimson", hex: "#DC2626", productCode: "KRB-CR" },
    originalImageUrl: "",
    resultImageUrl: "",
    showingOriginal: false,
};

const colors = [
    { id: "crimson", name: "Crimson", hex: "#DC2626", productCode: "KRB-CR" },
    { id: "blue", name: "Ocean", hex: "#2563EB", productCode: "KRB-BL" },
    { id: "black", name: "Obsidian", hex: "#111827", productCode: "KRB-BK" },
    { id: "silver", name: "Silver", hex: "#D1D5DB", productCode: "KRB-SV" },
    { id: "white", name: "Pearl", hex: "#F8FAFC", productCode: "KRB-WH" },
    { id: "green", name: "Forest", hex: "#166534", productCode: "KRB-GR" },
    { id: "orange", name: "Copper", hex: "#C2410C", productCode: "KRB-CP" },
    { id: "yellow", name: "Solar", hex: "#FACC15", productCode: "KRB-YL" },
];

const els = {};

document.addEventListener("DOMContentLoaded", () => {
    bindElements();
    bindEvents();
    renderAuth();
    renderProfile();
    renderColorPalette();
    renderCartCount();
    setView("store");
    checkConnection();
    loadCatalog();
});

function bindElements() {
    [
        "apiBase", "saveApiBase", "connectionStatus", "cartCount", "openCart", "viewTitle",
        "searchInput", "refreshCatalog", "categoryList", "catalogState", "productsGrid",
        "vehicleImage", "vehiclePreview", "emptyPreview", "processingOverlay", "toggleOriginal",
        "downloadPreview", "colorPalette", "customColor", "generatePreview", "aiState",
        "barcodeForm", "barcodeInput", "barcodeResult", "authCard", "profileName",
        "profileEmail", "profileToken", "productDialog", "cartDialog", "toast"
    ].forEach((id) => {
        els[id] = document.getElementById(id);
    });
    els.apiBase.value = state.apiBase;
}

function bindEvents() {
    document.querySelectorAll(".nav-button").forEach((button) => {
        button.addEventListener("click", () => setView(button.dataset.view));
    });

    els.saveApiBase.addEventListener("click", () => {
        state.apiBase = normalizeApiBase(els.apiBase.value);
        els.apiBase.value = state.apiBase;
        localStorage.setItem("karabiber_api_base", state.apiBase);
        checkConnection();
        loadCatalog();
    });

    els.refreshCatalog.addEventListener("click", loadCatalog);
    els.searchInput.addEventListener("input", (event) => {
        state.search = event.target.value.trim().toLowerCase();
        renderProducts();
    });
    els.openCart.addEventListener("click", renderCart);
    els.vehicleImage.addEventListener("change", onVehicleImageSelected);
    els.customColor.addEventListener("input", (event) => {
        state.selectedColor = { id: "custom", name: "Custom", hex: event.target.value, productCode: "CUSTOM" };
        renderColorPalette();
    });
    els.generatePreview.addEventListener("click", generatePreview);
    els.toggleOriginal.addEventListener("click", toggleOriginal);
    els.downloadPreview.addEventListener("click", downloadPreview);
    els.barcodeForm.addEventListener("submit", lookupBarcode);
}

function setView(viewName) {
    const titles = {
        store: "Magaza",
        ai: "AI Renk Onizleme",
        scanner: "Barkod Sorgu",
        profile: "Profil ve Giris",
    };

    document.querySelectorAll(".nav-button").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.view === viewName);
    });
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-active"));
    document.getElementById(`${viewName}View`).classList.add("is-active");
    els.viewTitle.textContent = titles[viewName] || "KarabiberOto";
}

async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }
    if (state.token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${state.token}`);
    }

    const response = await fetch(`${state.apiBase}${path}`, { ...options, headers });
    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await response.json() : await response.text();

    if (!response.ok) {
        const detail = typeof data === "object" ? data.detail || JSON.stringify(data) : data;
        throw new Error(detail || `HTTP ${response.status}`);
    }
    return data;
}

async function checkConnection() {
    setConnection("neutral", "Baglanti kontrol ediliyor");
    try {
        await api("/health", { headers: { Authorization: "" } });
        setConnection("ok", "Backend bagli");
    } catch (error) {
        setConnection("error", "Backend baglanamadi");
    }
}

function setConnection(type, text) {
    els.connectionStatus.className = `status ${type}`;
    els.connectionStatus.textContent = text;
}

async function loadCatalog() {
    els.catalogState.textContent = "Katalog yukleniyor...";
    try {
        const [products, categories] = await Promise.all([
            api("/products/"),
            api("/products/categories"),
        ]);
        state.products = products.map(normalizeProduct);
        state.categories = categories;
        els.catalogState.textContent = `${state.products.length} urun listelendi.`;
        renderCategories();
        renderProducts();
    } catch (error) {
        state.products = [];
        state.categories = [];
        renderCategories();
        renderProducts();
        els.catalogState.textContent = `Katalog alinamadi: ${error.message}`;
    }
}

function renderCategories() {
    const allButton = categoryButton({ id: "", name: "Tum urunler" });
    els.categoryList.replaceChildren(allButton, ...state.categories.map(categoryButton));
}

function categoryButton(category) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-button${state.selectedCategory === category.id ? " is-active" : ""}`;
    button.textContent = category.name;
    button.addEventListener("click", () => {
        state.selectedCategory = state.selectedCategory === category.id ? "" : category.id;
        renderCategories();
        renderProducts();
    });
    return button;
}

function renderProducts() {
    const products = state.products.filter((product) => {
        const categoryMatch = !state.selectedCategory || product.category_id === state.selectedCategory;
        const searchSource = `${product.name} ${product.description} ${product.grade} ${product.category_id}`.toLowerCase();
        return categoryMatch && (!state.search || searchSource.includes(state.search));
    });

    if (!products.length) {
        els.productsGrid.innerHTML = `<div class="state-line">Gosterilecek urun yok.</div>`;
        return;
    }

    els.productsGrid.replaceChildren(...products.map(productCard));
}

function productCard(product) {
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = `
        <img class="product-image" src="${escapeAttr(product.image_url)}" alt="${escapeAttr(product.name)}" loading="lazy">
        <div>
            <h3>${escapeHTML(product.name)}</h3>
            <div class="meta">${escapeHTML(product.grade || product.description || product.category_id)}</div>
        </div>
        <div class="product-footer">
            <span class="price">${formatPrice(product.price)}</span>
            <span class="swatch" style="background:${escapeAttr(product.color_hex)}"></span>
        </div>
        <div class="product-footer">
            <button class="button secondary" type="button" data-action="detail">Detay</button>
            <button class="button primary" type="button" data-action="cart">Sepete Ekle</button>
        </div>
    `;
    card.querySelector('[data-action="detail"]').addEventListener("click", () => showProduct(product));
    card.querySelector('[data-action="cart"]').addEventListener("click", () => addToCart(product));
    return card;
}

function showProduct(product) {
    els.productDialog.innerHTML = `
        <div class="dialog-header">
            <h2>${escapeHTML(product.name)}</h2>
            <button class="close-button" type="button" aria-label="Kapat">×</button>
        </div>
        <div class="dialog-body">
            <img class="product-image" src="${escapeAttr(product.image_url)}" alt="${escapeAttr(product.name)}">
            <p class="meta">${escapeHTML(product.description || "-")}</p>
            <p><span class="swatch" style="background:${escapeAttr(product.color_hex)}"></span> ${escapeHTML(product.color_hex)}</p>
            <p><strong>${formatPrice(product.price)}</strong></p>
            <button class="button primary" type="button">Sepete Ekle</button>
        </div>
    `;
    els.productDialog.querySelector(".close-button").addEventListener("click", () => els.productDialog.close());
    els.productDialog.querySelector(".button.primary").addEventListener("click", () => {
        addToCart(product);
        els.productDialog.close();
    });
    els.productDialog.showModal();
}

function addToCart(product) {
    const existing = state.cart.find((item) => item.product.id === product.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        state.cart.push({ product, quantity: 1 });
    }
    persistCart();
    toast("Urun sepete eklendi.");
}

function renderCart() {
    const body = state.cart.length
        ? state.cart.map((item, index) => `
            <div class="cart-item">
                <img src="${escapeAttr(item.product.image_url)}" alt="${escapeAttr(item.product.name)}">
                <div>
                    <strong>${escapeHTML(item.product.name)}</strong>
                    <div class="meta">${formatPrice(item.product.price)}</div>
                    <div class="quantity-control">
                        <button type="button" data-cart-minus="${index}">−</button>
                        <span>${item.quantity}</span>
                        <button type="button" data-cart-plus="${index}">+</button>
                    </div>
                </div>
                <strong class="price">${formatPrice(item.product.price * item.quantity)}</strong>
            </div>
        `).join("")
        : `<p class="state-line">Sepet bos.</p>`;

    els.cartDialog.innerHTML = `
        <div class="dialog-header">
            <h2>Sepet</h2>
            <button class="close-button" type="button" aria-label="Kapat">×</button>
        </div>
        <div class="dialog-body">
            ${body}
            <div class="cart-total"><span>Toplam</span><span>${formatPrice(cartTotal())}</span></div>
            <button class="button primary" type="button" ${state.cart.length ? "" : "disabled"}>Siparisi Tamamla</button>
        </div>
    `;
    els.cartDialog.querySelector(".close-button").addEventListener("click", () => els.cartDialog.close());
    els.cartDialog.querySelectorAll("[data-cart-minus]").forEach((button) => {
        button.addEventListener("click", () => updateCart(Number(button.dataset.cartMinus), -1));
    });
    els.cartDialog.querySelectorAll("[data-cart-plus]").forEach((button) => {
        button.addEventListener("click", () => updateCart(Number(button.dataset.cartPlus), 1));
    });
    els.cartDialog.querySelector(".button.primary").addEventListener("click", () => {
        state.cart = [];
        persistCart();
        els.cartDialog.close();
        toast("Siparis alindi. Backend siparis endpointi eklenince buradan kaydedilebilir.");
    });
    els.cartDialog.showModal();
}

function updateCart(index, delta) {
    const item = state.cart[index];
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) state.cart.splice(index, 1);
    persistCart();
    renderCart();
}

function persistCart() {
    localStorage.setItem("karabiber_cart", JSON.stringify(state.cart));
    renderCartCount();
}

function renderCartCount() {
    els.cartCount.textContent = state.cart.reduce((sum, item) => sum + item.quantity, 0);
}

function cartTotal() {
    return state.cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
}

function renderColorPalette() {
    els.colorPalette.replaceChildren(...colors.map((color) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `color-button${state.selectedColor.hex === color.hex ? " is-active" : ""}`;
        button.innerHTML = `<span class="color-dot" style="background:${color.hex}"></span><span>${color.name}</span>`;
        button.addEventListener("click", () => {
            state.selectedColor = color;
            els.customColor.value = color.hex;
            renderColorPalette();
        });
        return button;
    }));
}

function onVehicleImageSelected(event) {
    const [file] = event.target.files;
    if (!file) return;
    revokeImageUrls();
    state.originalImageUrl = URL.createObjectURL(file);
    state.resultImageUrl = "";
    state.showingOriginal = true;
    els.vehiclePreview.src = state.originalImageUrl;
    els.vehiclePreview.alt = file.name;
    els.vehiclePreview.parentElement.classList.add("has-image");
    els.emptyPreview.style.display = "none";
    els.generatePreview.disabled = false;
    els.toggleOriginal.disabled = true;
    els.downloadPreview.disabled = true;
    els.aiState.textContent = "";
}

async function generatePreview() {
    const [file] = els.vehicleImage.files;
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("color_name", state.selectedColor.name);
    formData.append("color_hex", state.selectedColor.hex);

    els.processingOverlay.classList.add("is-active");
    els.generatePreview.disabled = true;
    els.aiState.textContent = "AI onizleme olusturuluyor...";

    try {
        const result = await api("/ai/recolor-car", { method: "POST", body: formData });
        if (state.resultImageUrl) URL.revokeObjectURL(state.resultImageUrl);
        state.resultImageUrl = `data:${result.mime_type || "image/png"};base64,${result.image_base64}`;
        state.showingOriginal = false;
        els.vehiclePreview.src = state.resultImageUrl;
        els.toggleOriginal.disabled = false;
        els.downloadPreview.disabled = false;
        els.aiState.textContent = `Onizleme hazir. Eslesen urun kodu: ${state.selectedColor.productCode}`;
    } catch (error) {
        els.aiState.textContent = `Onizleme olusturulamadi: ${error.message}`;
    } finally {
        els.processingOverlay.classList.remove("is-active");
        els.generatePreview.disabled = false;
    }
}

function toggleOriginal() {
    if (!state.resultImageUrl || !state.originalImageUrl) return;
    state.showingOriginal = !state.showingOriginal;
    els.vehiclePreview.src = state.showingOriginal ? state.originalImageUrl : state.resultImageUrl;
}

function downloadPreview() {
    if (!state.resultImageUrl) return;
    const link = document.createElement("a");
    link.href = state.resultImageUrl;
    link.download = "karabiberoto-renk-onizleme.png";
    link.click();
}

async function lookupBarcode(event) {
    event.preventDefault();
    const code = els.barcodeInput.value.trim();
    if (!code) return;

    els.barcodeResult.innerHTML = `<p class="state-line">Barkod sorgulaniyor...</p>`;
    try {
        const product = normalizeProduct(await api(`/products/barcode/${encodeURIComponent(code)}`));
        els.barcodeResult.replaceChildren(productCard(product));
    } catch (error) {
        els.barcodeResult.innerHTML = `<p class="state-line">Bu barkodla eslesen urun bulunamadi.</p>`;
    }
}

function renderAuth(mode = "login") {
    const isLogin = mode === "login";
    if (state.user) {
        els.authCard.innerHTML = `
            <h2>Hesap</h2>
            <p>${escapeHTML(state.user.name)} olarak giris yapildi.</p>
            <button class="button secondary" type="button">Cikis Yap</button>
        `;
        els.authCard.querySelector("button").addEventListener("click", logout);
        return;
    }

    els.authCard.innerHTML = `
        <div class="auth-tabs">
            <button class="${isLogin ? "is-active" : ""}" type="button" data-auth-mode="login">Giris</button>
            <button class="${!isLogin ? "is-active" : ""}" type="button" data-auth-mode="register">Kayit</button>
        </div>
        <form id="authForm">
            ${isLogin ? "" : `<input id="authName" type="text" placeholder="Ad soyad" autocomplete="name">`}
            <input id="authEmail" type="email" placeholder="E-posta" autocomplete="email" required>
            <input id="authPassword" type="password" placeholder="Sifre" autocomplete="${isLogin ? "current-password" : "new-password"}" required minlength="6">
            <button class="button primary" type="submit">${isLogin ? "Giris Yap" : "Kayit Ol"}</button>
            <p id="authState" class="state-line"></p>
        </form>
    `;
    els.authCard.querySelectorAll("[data-auth-mode]").forEach((button) => {
        button.addEventListener("click", () => renderAuth(button.dataset.authMode));
    });
    els.authCard.querySelector("#authForm").addEventListener("submit", (event) => submitAuth(event, mode));
}

async function submitAuth(event, mode) {
    event.preventDefault();
    const authState = els.authCard.querySelector("#authState");
    const payload = {
        email: els.authCard.querySelector("#authEmail").value,
        password: els.authCard.querySelector("#authPassword").value,
    };
    const nameInput = els.authCard.querySelector("#authName");
    if (nameInput) payload.name = nameInput.value;

    authState.textContent = "Islem yapiliyor...";
    try {
        const result = await api(`/auth/${mode}`, {
            method: "POST",
            body: JSON.stringify(payload),
            headers: { Authorization: "" },
        });
        state.token = result.token;
        state.user = result.user;
        localStorage.setItem("karabiber_token", state.token);
        localStorage.setItem("karabiber_user", JSON.stringify(state.user));
        renderAuth();
        renderProfile();
        toast("Giris basarili.");
    } catch (error) {
        authState.textContent = error.message;
    }
}

function logout() {
    state.token = "";
    state.user = null;
    localStorage.removeItem("karabiber_token");
    localStorage.removeItem("karabiber_user");
    renderAuth();
    renderProfile();
}

function renderProfile() {
    els.profileName.textContent = state.user?.name || "Misafir";
    els.profileEmail.textContent = state.user?.email || "Giris yapilmadi";
    els.profileToken.textContent = state.token ? `${state.token.slice(0, 20)}...` : "Yok";
}

function normalizeProduct(product) {
    return {
        id: product.id || product._id || crypto.randomUUID(),
        name: product.name || "Urun",
        description: product.description || "",
        price: Number(product.price || 0),
        category_id: product.category_id || "all",
        image_url: product.image_url || "",
        grade: product.grade || "",
        color_hex: product.color_hex || "#ffffff",
        product_type: product.product_type || "",
        barcode: product.barcode || "",
        in_stock: product.in_stock !== false,
    };
}

function parseJSON(value) {
    try {
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
}

function normalizeApiBase(value) {
    return (value || DEFAULT_API_BASE).trim().replace(/\/+$/, "");
}

function formatPrice(value) {
    return `${new Intl.NumberFormat("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value || 0))} TL`;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
    }[char]));
}

function escapeAttr(value) {
    return escapeHTML(value);
}

function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("is-visible");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2200);
}

function revokeImageUrls() {
    if (state.originalImageUrl) URL.revokeObjectURL(state.originalImageUrl);
    if (state.resultImageUrl && state.resultImageUrl.startsWith("blob:")) URL.revokeObjectURL(state.resultImageUrl);
}
