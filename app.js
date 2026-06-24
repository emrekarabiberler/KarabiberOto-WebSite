const API_PROTOCOL = window.location.protocol === "https:" ? "https:" : "http:";
const DEFAULT_API_BASE = `${API_PROTOCOL}//api.karabiberoto.com.tr`;

const state = {
    apiBase: DEFAULT_API_BASE,
    token: localStorage.getItem("karabiber_token") || "",
    user: parseJSON(localStorage.getItem("karabiber_user")),
    products: [],
    categories: [],
    cart: parseJSON(localStorage.getItem("karabiber_cart")) || [],
    orders: parseJSON(localStorage.getItem("karabiber_orders")) || [],
    favorites: parseJSON(localStorage.getItem("karabiber_favorites")) || [],
    selectedCategory: "",
    search: "",
    minPrice: "",
    maxPrice: "",
    selectedColor: { id: "crimson", name: "Crimson", hex: "#DC2626", productCode: "KRB-CR" },
    originalImageUrl: "",
    resultImageUrl: "",
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
    renderFavoriteCount();
    setView("store");
    loadCatalog();
});

function bindElements() {
    [
        "cartCount", "favoriteCount", "homeLogo", "openCart", "openFavorites", "viewTitle",
        "searchInput", "refreshCatalog", "filterCategoryList", "clearCategoryFilter", "resetPriceFilter",
        "minPriceInput", "maxPriceInput", "catalogState", "productsGrid",
        "vehicleImage", "vehiclePreview", "emptyPreview", "processingOverlay",
        "colorPalette", "customColor", "generatePreview", "aiState",
        "authCard", "profileName",
        "profileEmail", "productDialog", "authDialog", "favoritesDialog", "ordersDialog", "cartDialog", "toast"
    ].forEach((id) => {
        els[id] = document.getElementById(id);
    });
}

function bindEvents() {
    document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
        button.addEventListener("click", () => setView(button.dataset.view));
    });

    els.homeLogo.addEventListener("click", (event) => {
        event.preventDefault();
        setView("store");
    });

    els.refreshCatalog.addEventListener("click", loadCatalog);
    els.clearCategoryFilter.addEventListener("click", () => selectCategory(""));
    els.resetPriceFilter.addEventListener("click", resetPriceFilter);
    els.minPriceInput.addEventListener("input", updatePriceFilter);
    els.maxPriceInput.addEventListener("input", updatePriceFilter);
    els.searchInput.addEventListener("input", (event) => {
        state.search = event.target.value.trim().toLowerCase();
        renderProducts();
    });
    els.openCart.addEventListener("click", renderCart);
    els.openFavorites.addEventListener("click", renderFavorites);
    els.vehicleImage.addEventListener("change", onVehicleImageSelected);
    els.customColor.addEventListener("input", (event) => {
        state.selectedColor = { id: "custom", name: "Custom", hex: event.target.value, productCode: "CUSTOM" };
        renderColorPalette();
    });
    els.generatePreview.addEventListener("click", generatePreview);
}

function setView(viewName) {
    if (viewName === "profile" && !state.user) {
        openAuthDialog();
        return;
    }

    const titles = {
        store: "Mağaza",
        ai: "AI Renk Önizleme",
        profile: "Hesap",
    };

    document.querySelectorAll(".nav-button[data-view]").forEach((button) => {
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

async function loadCatalog() {
    els.catalogState.textContent = "Katalog yükleniyor...";
    try {
        const [products, categories] = await Promise.all([
            api("/products/"),
            api("/products/categories"),
        ]);
        const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
        state.categories = categories.map(normalizeCategory);
        state.products = products.map((product) => normalizeProduct(product, categoryNameById));
        els.catalogState.textContent = `${state.products.length} ürün listelendi.`;
        renderCategories();
        renderProducts();
    } catch (error) {
        state.products = [];
        state.categories = [];
        renderCategories();
        renderProducts();
        els.catalogState.textContent = "Ürünler şu an yüklenemedi. Lütfen tekrar deneyin.";
    }
}

function renderCategories() {
    renderFilterCategories();
}

function renderFilterCategories() {
    if (!els.filterCategoryList) return;

    if (!state.categories.length) {
        els.filterCategoryList.innerHTML = `<p class="state-line">Kategori yok.</p>`;
        return;
    }

    els.filterCategoryList.replaceChildren(...state.categories.map((category) => {
        const label = document.createElement("label");
        label.className = "check-row";
        label.innerHTML = `
            <span>${escapeHTML(category.name)}</span>
            <input type="checkbox" ${state.selectedCategory === category.id ? "checked" : ""}>
        `;
        label.querySelector("input").addEventListener("change", (event) => {
            selectCategory(event.target.checked ? category.id : "");
        });
        return label;
    }));
}

function selectCategory(categoryId) {
    state.selectedCategory = categoryId;
    renderCategories();
    renderProducts();
}

function renderProducts() {
    const products = state.products.filter((product) => {
        const categoryMatch = !state.selectedCategory || product.category_id === state.selectedCategory;
        const minPrice = state.minPrice === "" ? 0 : Number(state.minPrice);
        const maxPrice = state.maxPrice === "" ? Infinity : Number(state.maxPrice);
        const priceMatch = product.price >= minPrice && product.price <= maxPrice;
        const searchSource = `${product.name} ${product.description} ${product.grade} ${product.category_id} ${product.barcode}`.toLowerCase();
        return categoryMatch && priceMatch && (!state.search || searchSource.includes(state.search));
    });

    if (!products.length) {
        els.productsGrid.innerHTML = `<div class="empty-store">Gösterilecek ürün yok.</div>`;
        els.catalogState.textContent = "Seçilen filtrelere uygun ürün yok.";
        return;
    }

    els.catalogState.textContent = `${products.length} ürün gösteriliyor.`;
    els.productsGrid.replaceChildren(...products.map(productCard));
}

function productCard(product) {
    const card = document.createElement("article");
    card.className = "product-card";
    const isFavorite = isFavoriteProduct(product.id);
    card.innerHTML = `
        <button class="favorite-button${isFavorite ? " is-active" : ""}" type="button" aria-label="${isFavorite ? "Favorilerden çıkar" : "Favorilere ekle"}">${isFavorite ? "♥" : "♡"}</button>
        <div class="product-media">
            <img class="product-image" src="${escapeAttr(product.image_url)}" alt="${escapeAttr(product.name)}" loading="lazy">
        </div>
        <div class="product-info">
            <h3>${escapeHTML(product.name)}</h3>
            <div class="meta">${escapeHTML(product.grade || product.description || product.category_id)}</div>
            <div class="product-footer">
                <button class="price-pill" type="button" data-action="cart">
                    <span>🛒</span>
                    <strong>${formatPrice(product.price)}</strong>
                </button>
                <button class="button secondary" type="button" data-action="detail">Detay</button>
            </div>
        </div>
    `;
    card.querySelector(".favorite-button").addEventListener("click", () => toggleFavorite(product));
    card.querySelector('[data-action="detail"]').addEventListener("click", () => showProduct(product));
    card.querySelector('[data-action="cart"]').addEventListener("click", () => addToCart(product));
    return card;
}

function updatePriceFilter() {
    state.minPrice = els.minPriceInput.value;
    state.maxPrice = els.maxPriceInput.value;
    renderProducts();
}

function resetPriceFilter() {
    state.minPrice = "";
    state.maxPrice = "";
    els.minPriceInput.value = "";
    els.maxPriceInput.value = "";
    renderProducts();
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
    const stock = getStockCount(product);
    if (stock <= 0) {
        toast("Stokta tükenmiştir.");
        return;
    }
    const existing = state.cart.find((item) => item.product.id === product.id);
    if (existing) {
        if (existing.quantity >= stock) {
            toast("Stokta tükenmiştir.");
            return;
        }
        existing.quantity += 1;
    } else {
        state.cart.push({ product, quantity: 1 });
    }
    persistCart();
    toast("Urun sepete eklendi.");
}

function toggleFavorite(product) {
    const existingIndex = state.favorites.findIndex((item) => item.id === product.id);
    if (existingIndex >= 0) {
        state.favorites.splice(existingIndex, 1);
        toast("Ürün favorilerden çıkarıldı.");
    } else {
        state.favorites.push(product);
        toast("Ürün favorilere eklendi.");
    }
    persistFavorites();
    renderProducts();
}

function renderFavorites() {
    const body = state.favorites.length
        ? state.favorites.map((product, index) => `
            <div class="cart-item">
                <img src="${escapeAttr(product.image_url)}" alt="${escapeAttr(product.name)}">
                <div>
                    <strong>${escapeHTML(product.name)}</strong>
                    <div class="meta">${escapeHTML(product.grade || product.category_id || "")}</div>
                    <div class="meta">${formatPrice(product.price)}</div>
                </div>
                <button class="close-button" type="button" data-favorite-remove="${index}" aria-label="Favorilerden çıkar">×</button>
            </div>
        `).join("")
        : `<p class="state-line">Favori ürün yok.</p>`;

    els.favoritesDialog.innerHTML = `
        <div class="dialog-header">
            <h2>Favoriler</h2>
            <button class="close-button" type="button" aria-label="Kapat">×</button>
        </div>
        <div class="dialog-body">
            ${body}
        </div>
    `;
    els.favoritesDialog.querySelector(".dialog-header .close-button").addEventListener("click", () => els.favoritesDialog.close());
    els.favoritesDialog.querySelectorAll("[data-favorite-remove]").forEach((button) => {
        button.addEventListener("click", () => {
            state.favorites.splice(Number(button.dataset.favoriteRemove), 1);
            persistFavorites();
            renderFavorites();
            renderProducts();
        });
    });
    els.favoritesDialog.showModal();
}

function persistFavorites() {
    localStorage.setItem("karabiber_favorites", JSON.stringify(state.favorites));
    renderFavoriteCount();
}

function renderFavoriteCount() {
    els.favoriteCount.textContent = state.favorites.length;
}

function isFavoriteProduct(productId) {
    return state.favorites.some((product) => product.id === productId);
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
    els.cartDialog.querySelector(".button.primary").addEventListener("click", completePurchase);
    els.cartDialog.showModal();
}

function updateCart(index, delta) {
    const item = state.cart[index];
    if (!item) return;
    if (delta > 0 && item.quantity >= getStockCount(item.product)) {
        toast("Stokta tükenmiştir.");
        return;
    }
    item.quantity += delta;
    if (item.quantity <= 0) state.cart.splice(index, 1);
    persistCart();
    renderCart();
}

async function completePurchase() {
    if (!state.cart.length) return;

    try {
        const response = await fetch(`${state.apiBase}/products/purchase`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: state.cart.map((item) => ({
                    product_id: item.product.id,
                    quantity: item.quantity,
                })),
            }),
        });

        if (!response.ok) {
            const errorMessage = response.status === 409 ? "Stokta tükenmiştir." : await response.text();
            throw new Error(errorMessage);
        }

        recordOrder(state.cart);
        state.cart = [];
        persistCart();
        els.cartDialog.close();
        toast("Sipariş alındı.");
        await loadCatalog();
    } catch (error) {
        toast(error.message || "Stokta tükenmiştir.");
    }
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

function recordOrder(cartItems) {
    if (!cartItems.length) return;

    const products = cartItems.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        image_url: item.product.image_url,
        quantity: item.quantity,
        unit_price: item.product.price,
        total: item.product.price * item.quantity,
    }));

    const order = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        customer_name: state.user?.name || "Misafir",
        customer_email: state.user?.email || "",
        products,
        total: products.reduce((sum, product) => sum + product.total, 0),
    };

    state.orders = [order, ...state.orders].slice(0, 50);
    persistOrders();
}

function persistOrders() {
    localStorage.setItem("karabiber_orders", JSON.stringify(state.orders));
}

function renderOrders() {
    const body = state.orders.length
        ? state.orders.map((order) => `
            <article class="order-card">
                <div class="order-card-head">
                    <div>
                        <strong>Sipariş #${escapeHTML(order.id.slice(0, 6).toUpperCase())}</strong>
                        <div class="meta">${formatDate(order.created_at)}</div>
                    </div>
                    <strong>${formatPrice(order.total)}</strong>
                </div>
                <div class="order-products">
                    ${order.products.map((product) => `
                        <div class="order-product">
                            <img src="${escapeAttr(product.image_url || "")}" alt="${escapeAttr(product.name)}">
                            <div>
                                <strong>${escapeHTML(product.name)}</strong>
                                <div class="meta">${product.quantity} adet x ${formatPrice(product.unit_price)}</div>
                            </div>
                            <strong>${formatPrice(product.total)}</strong>
                        </div>
                    `).join("")}
                </div>
            </article>
        `).join("")
        : `<p class="state-line">Henüz sipariş yok. Sepeti tamamladığında ürünler burada görünecek.</p>`;

    els.ordersDialog.innerHTML = `
        <div class="dialog-header">
            <h2>Siparişlerim</h2>
            <button class="close-button" type="button" aria-label="Kapat">×</button>
        </div>
        <div class="dialog-body">
            ${body}
        </div>
    `;
    els.ordersDialog.querySelector(".close-button").addEventListener("click", () => els.ordersDialog.close());
    els.ordersDialog.showModal();
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
    els.vehiclePreview.src = state.originalImageUrl;
    els.vehiclePreview.alt = file.name;
    els.vehiclePreview.parentElement.classList.add("has-image");
    els.emptyPreview.style.display = "none";
    els.generatePreview.disabled = false;
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
        els.vehiclePreview.src = state.resultImageUrl;
        els.aiState.textContent = `Onizleme hazir. Eslesen urun kodu: ${state.selectedColor.productCode}`;
    } catch (error) {
        els.aiState.textContent = `Onizleme olusturulamadi: ${error.message}`;
    } finally {
        els.processingOverlay.classList.remove("is-active");
        els.generatePreview.disabled = false;
    }
}

function renderAuth(mode = "login") {
    renderAccountActions();
}

function renderAccountActions() {
    if (!state.user) {
        els.authCard.innerHTML = `
            <h2>Hesap</h2>
            <p class="state-line">Siparişlerini ve favorilerini yönetmek için giriş yap.</p>
            <button class="button primary" type="button">Giriş Yap</button>
        `;
        els.authCard.querySelector("button").addEventListener("click", () => openAuthDialog());
        return;
    }

    els.authCard.innerHTML = `
        <h2>Hesap işlemleri</h2>
        <p>${escapeHTML(state.user.name)} olarak giriş yapıldı.</p>
        <div class="account-actions">
            <button class="button secondary" type="button" data-account-action="orders">Siparişlerim</button>
            <button class="button secondary" type="button" data-account-action="favorites">Favorilerim</button>
            <button class="button primary" type="button" data-account-action="logout">Çıkış Yap</button>
        </div>
    `;
    els.authCard.querySelector('[data-account-action="orders"]').addEventListener("click", renderOrders);
    els.authCard.querySelector('[data-account-action="favorites"]').addEventListener("click", renderFavorites);
    els.authCard.querySelector('[data-account-action="logout"]').addEventListener("click", logout);
}

function openAuthDialog(mode = "login") {
    renderAuthForm(els.authDialog, mode);
    els.authDialog.showModal();
}

function renderAuthForm(container, mode = "login") {
    const isLogin = mode === "login";
    container.innerHTML = `
        <div class="dialog-header">
            <h2>${isLogin ? "Giriş Yap" : "Kayıt Ol"}</h2>
            <button class="close-button" type="button" aria-label="Kapat">×</button>
        </div>
        <div class="dialog-body">
            <div class="auth-tabs">
                <button class="${isLogin ? "is-active" : ""}" type="button" data-auth-mode="login">Giriş</button>
                <button class="${!isLogin ? "is-active" : ""}" type="button" data-auth-mode="register">Kayıt</button>
            </div>
            <form class="auth-form">
                ${isLogin ? "" : `<input name="name" type="text" placeholder="Ad soyad" autocomplete="name">`}
                <input name="email" type="email" placeholder="E-posta" autocomplete="email" required>
                <input name="password" type="password" placeholder="Şifre" autocomplete="${isLogin ? "current-password" : "new-password"}" required minlength="6">
                <button class="button primary" type="submit">${isLogin ? "Giriş Yap" : "Kayıt Ol"}</button>
                <p class="state-line" data-auth-state></p>
            </form>
        </div>
    `;
    container.querySelector(".close-button").addEventListener("click", () => container.close());
    container.querySelectorAll("[data-auth-mode]").forEach((button) => {
        button.addEventListener("click", () => renderAuthForm(container, button.dataset.authMode));
    });
    container.querySelector(".auth-form").addEventListener("submit", (event) => submitAuth(event, mode, container));
}

async function submitAuth(event, mode, container) {
    event.preventDefault();
    const form = event.currentTarget;
    const authState = container.querySelector("[data-auth-state]");
    const payload = {
        email: form.elements.email.value,
        password: form.elements.password.value,
    };
    const nameInput = form.elements.name;
    if (nameInput) payload.name = nameInput.value;

    authState.textContent = "İşlem yapılıyor...";
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
        if (container.open) container.close();
        setView("profile");
        toast("Giriş başarılı.");
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
    setView("store");
}

function renderProfile() {
    els.profileName.textContent = state.user?.name || "Misafir";
    els.profileEmail.textContent = state.user?.email || "Giriş yapılmadı";
}

function normalizeCategory(category) {
    const name = category.name || category.id || "Kategori";
    return {
        ...category,
        id: name,
        name,
    };
}

function normalizeProduct(product, categoryNameById = new Map()) {
    const rawCategoryId = product.category_id || "all";
    const categoryName = categoryNameById.get(rawCategoryId) || rawCategoryId;

    return {
        id: product.id || product._id || crypto.randomUUID(),
        name: product.name || "Urun",
        description: product.description || "",
        price: Number(product.price || 0),
        category_id: categoryName,
        image_url: product.image_url || "",
        grade: product.grade || "",
        color_hex: product.color_hex || "#ffffff",
        product_type: product.product_type || "",
        barcode: product.barcode || "",
        stock: getStockCount(product),
        stock_count: getStockCount(product),
        in_stock: getStockCount(product) > 0,
    };
}

function getStockCount(product) {
    const stock = Number(product?.stock ?? product?.stock_count);
    if (Number.isFinite(stock)) {
        return Math.max(0, Math.trunc(stock));
    }
    return product?.in_stock === false ? 0 : 1;
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

function formatDate(value) {
    return new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
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
