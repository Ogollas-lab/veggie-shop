// State
let products = [];
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentCategory = 'all';
let searchTerm = '';
let sortMode = 'default';

// DOM Elements
const productGrid = document.getElementById('productGrid');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const trackModal = document.getElementById('trackModal');
const trackForm = document.getElementById('trackForm');
const trackResult = document.getElementById('trackResult');
const displayOrderId = document.getElementById('displayOrderId');
const checkoutForm = document.getElementById('checkoutForm');
const successModal = document.getElementById('successModal');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartDrawer = document.getElementById('cartDrawer');
const cartOverlay = document.getElementById('cartOverlay');
const cartItemsContainer = document.getElementById('cartItems');
const cartCount = document.getElementById('cartCount');
const cartTotalPrice = document.getElementById('cartTotalPrice');
const checkoutBtn = document.getElementById('checkoutBtn');
const checkoutModal = document.getElementById('checkoutModal');
const closeCheckoutBtn = document.getElementById('closeCheckoutBtn');
const continueShoppingBtn = document.getElementById('continueShoppingBtn');
const checkoutSubtotal = document.getElementById('checkoutSubtotal');
const checkoutTotal = document.getElementById('checkoutTotal');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const closeMobileMenuBtn = document.getElementById('closeMobileMenuBtn');
const mobileNav = document.getElementById('mobileNav');
const mobileNavOverlay = document.getElementById('mobileNavOverlay');
const mobileLinks = document.querySelectorAll('.mobile-links a');

// Auth & Profile Elements
const authModal = document.getElementById('authModal');
const loginBtn = document.getElementById('loginBtn');
const closeAuthBtn = document.getElementById('closeAuthBtn');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');
const authUI = document.getElementById('authUI');
const userProfileNav = document.getElementById('userProfileNav');
const userNameNav = document.getElementById('userNameNav');
const logoutBtn = document.getElementById('logoutBtn');
const viewOrdersBtn = document.getElementById('viewOrdersBtn');
const userOrdersModal = document.getElementById('userOrdersModal');
const closeUserOrdersBtn = document.getElementById('closeUserOrdersBtn');
const userOrdersList = document.getElementById('userOrdersList');

// Localization
const langToggle = document.getElementById('langToggle');
let currentLang = localStorage.getItem('lang') || 'en';

// Auth State
let currentUser = JSON.parse(localStorage.getItem('user')) || null;
let authToken = localStorage.getItem('token') || null;

// Initialize
async function init() {
    setupEventListeners();
    setupAuthListeners();
    setupLanguage();
    checkAuthState();
    await fetchProducts();
    updateCart();
}

async function fetchProducts() {
    try {
        const response = await fetch('http://localhost:3000/api/products');
        if (!response.ok) throw new Error('Failed to fetch products');
        products = await response.json();
        updateFilteredProducts();
    } catch (error) {
        console.error('Error fetching products:', error);
        productGrid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">Sorry, we could not load the products at this time. Please make sure the backend server is running.</p>';
    }
}

function updateFilteredProducts() {
    let filtered = [...products];

    // Filter by category
    if (currentCategory !== 'all') {
        filtered = filtered.filter(p => p.category === currentCategory);
    }

    // Filter by search term
    if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
    }

    // Filter by Stock (only show in_stock)
    filtered = filtered.filter(p => p.in_stock === 1 || p.in_stock === true || p.in_stock === undefined);

    // Apply Sorting
    if (sortMode === 'price-low') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortMode === 'price-high') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortMode === 'name-az') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    renderProducts(filtered);
}

// Render Products
function renderProducts(productsToRender) {
    productGrid.innerHTML = '';
    
    if (productsToRender.length === 0) {
        productGrid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding: 2rem; color: var(--text-light);">No products found matching your search.</p>';
        return;
    }
    
    // Add fade-in animation slightly staggered
    productsToRender.forEach((product, index) => {
        const delay = index * 0.1;
        const card = document.createElement('div');
        card.className = 'product-card fade-in';
        card.style.animationDelay = `${delay}s`;
        
        const badgeHtml = product.badge ? `<span class="product-badge">${product.badge}</span>` : '';
        
        card.innerHTML = `
            <div class="product-img-wrapper">
                ${badgeHtml}
                <img src="${product.image}" alt="${product.name}" class="product-img">
                <div class="add-to-cart-overlay">
                    <button class="btn btn-primary add-to-cart-btn" data-id="${product.id}">
                        <i class="fa-solid fa-cart-plus"></i> Add to Cart
                    </button>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-title">${product.name}</h3>
                <div class="product-meta">
                    <span class="product-price">Ksh ${product.price.toFixed(2)}</span>
                    <span class="product-weight">${product.weight}</span>
                </div>
            </div>
        `;
        productGrid.appendChild(card);
    });

    // Add event listeners to newly created buttons
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Prevent fast double-clicks making UI jumpy
            const button = e.currentTarget;
            button.disabled = true;
            
            const productId = parseInt(button.dataset.id);
            addToCart(productId);
            
            // Visual feedback
            const originalHtml = button.innerHTML;
            button.innerHTML = '<i class="fa-solid fa-check"></i> Added';
            button.style.backgroundColor = 'var(--text-primary)';
            
            setTimeout(() => {
                button.innerHTML = originalHtml;
                button.disabled = false;
                button.style.backgroundColor = '';
            }, 1000);
        });
    });
}

// Cart Logic
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    const existingItem = cart.find(item => item.id === productId);

    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }

    updateCart();
    
    // Animation effect on cart button
    cartBtn.style.transform = 'scale(1.2)';
    setTimeout(() => {
        cartBtn.style.transform = 'scale(1)';
    }, 200);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCart();
}

function updateQuantity(productId, newQuantity) {
    if (newQuantity < 1) {
        removeFromCart(productId);
        return;
    }
    
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = newQuantity;
        updateCart();
    }
}

function updateCart() {
    // Calculate totals
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Persist cart
    localStorage.setItem('cart', JSON.stringify(cart));

    // Update UI
    cartCount.textContent = totalItems;
    cartTotalPrice.textContent = `Ksh ${totalPrice.toFixed(2)}`;
    
    // Manage disabled state of checkout button
    checkoutBtn.disabled = cart.length === 0;

    // Render cart items
    renderCartItems();
}

function renderCartItems() {
    const emptyMessage = cartItemsContainer.querySelector('.empty-cart-message');
    
    // Clear current items (but keep empty message)
    Array.from(cartItemsContainer.children).forEach(child => {
        if (!child.classList.contains('empty-cart-message')) {
            child.remove();
        }
    });

    if (cart.length === 0) {
        emptyMessage.style.display = 'block';
    } else {
        emptyMessage.style.display = 'none';
        
        cart.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item fade-in';
            cartItem.style.animationDuration = '0.3s';
            
            cartItem.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-info">
                    <h4 class="cart-item-title">${item.name}</h4>
                    <div class="cart-item-price">Ksh ${(item.price * item.quantity).toFixed(2)}</div>
                    <div class="qty-controls">
                        <button class="qty-btn minus" data-id="${item.id}"><i class="fa-solid fa-minus"></i></button>
                        <span>${item.quantity}</span>
                        <button class="qty-btn plus" data-id="${item.id}"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
                <button class="remove-btn" title="Remove Item" data-id="${item.id}"><i class="fa-solid fa-trash"></i></button>
            `;
            cartItemsContainer.appendChild(cartItem);
        });

        // Add event listeners to new buttons
        cartItemsContainer.querySelectorAll('.minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const item = cart.find(i => i.id === id);
                updateQuantity(id, item.quantity - 1);
            });
        });

        cartItemsContainer.querySelectorAll('.plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                const item = cart.find(i => i.id === id);
                updateQuantity(id, item.quantity + 1);
            });
        });

        cartItemsContainer.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.dataset.id);
                removeFromCart(id);
            });
        });
    }
}

// Event Listeners
function setupEventListeners() {
    // Contact Form Submission
    const contactPageForm = document.getElementById('contactPageForm');
    if (contactPageForm) {
        contactPageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const btn = contactPageForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Sending...';
            btn.disabled = true;

            setTimeout(() => {
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Message Sent!';
                btn.style.backgroundColor = 'var(--text-primary)';
                contactPageForm.reset();
                
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                    btn.style.backgroundColor = '';
                }, 3000);
            }, 1500);
        });
    }

    // Category Filtering
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentCategory = e.currentTarget.dataset.category;
            updateFilteredProducts();
        });
    });

    // Search Input
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            updateFilteredProducts();
        });
    }

    // Sort Dropdown
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            sortMode = e.target.value;
            updateFilteredProducts();
        });
    }

    // Cart Drawer Toggle
    cartBtn.addEventListener('click', openCart);
    closeCartBtn.addEventListener('click', closeCart);
    cartOverlay.addEventListener('click', closeCart);

    // Mobile Menu Toggles
    mobileMenuBtn.addEventListener('click', openMobileMenu);
    closeMobileMenuBtn.addEventListener('click', closeMobileMenu);
    mobileNavOverlay.addEventListener('click', closeMobileMenu);

    // Close mobile menu when a link is clicked
    mobileLinks.forEach(link => {
        link.addEventListener('click', closeMobileMenu);
    });

    // Checkout Flow
    checkoutBtn.addEventListener('click', () => {
        if (cart.length > 0) {
            closeCart();
            openCheckout();
        }
    });

    closeCheckoutBtn.addEventListener('click', closeModal);
    
    // Close modal when clicking on overlay
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
    });

    // Tracking Modal Toggles
    const trackOrderNav = document.getElementById('trackOrderNav');
    const trackOrderFooter = document.getElementById('trackOrderFooter');
    const trackOrderMobile = document.getElementById('trackOrderMobile');
    const closeTrackBtn = document.getElementById('closeTrackBtn');

    const openTrackModal = (e) => {
        e.preventDefault();
        trackModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    if (trackOrderNav) trackOrderNav.addEventListener('click', openTrackModal);
    if (trackOrderFooter) trackOrderFooter.addEventListener('click', openTrackModal);
    if (trackOrderMobile) trackOrderMobile.addEventListener('click', openTrackModal);
    if (closeTrackBtn) closeTrackBtn.addEventListener('click', () => {
        trackModal.classList.remove('active');
        document.body.style.overflow = '';
    });

    // Tracking Form Handler
    if (trackForm) {
        trackForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('trackEmail').value;
            const orderId = document.getElementById('trackOrderId').value;
            const btn = trackForm.querySelector('button');
            const originalText = btn.innerHTML;

            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Searching...';
            btn.disabled = true;

            try {
                const response = await fetch(`http://localhost:3000/api/orders/track?orderId=${orderId}&email=${email}`);
                const data = await response.json();

                if (!response.ok) throw new Error(data.error || 'Tracking failed');

                trackResult.style.display = 'block';
                const statusClass = `status-${data.status.toLowerCase()}`;
                
                trackResult.innerHTML = `
                    <div class="track-result-card">
                        <span class="status-badge ${statusClass}">${data.status}</span>
                        <div class="track-item">
                            <span class="label">Order ID:</span>
                            <span class="value">#${data.id}</span>
                        </div>
                        <div class="track-item">
                            <span class="label">Date:</span>
                            <span class="value">${new Date(data.order_date).toLocaleDateString()}</span>
                        </div>
                        <div class="track-item">
                            <span class="label">Items:</span>
                            <span class="value">${data.items_summary}</span>
                        </div>
                        <div class="track-item">
                            <span class="label">Total:</span>
                            <span class="value">Ksh ${data.total_price.toFixed(2)}</span>
                        </div>
                    </div>
                `;
            } catch (error) {
                trackResult.style.display = 'block';
                trackResult.innerHTML = `<p style="color: #ef4444; text-align: center;">${error.message}</p>`;
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // Checkout Flow Form Submission
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = checkoutForm.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
        btn.disabled = true;

        const amount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) + 300.00;
        const phone = document.getElementById('phone').value;

        const orderData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: phone,
            address: document.getElementById('address').value,
            subtotal: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            deliveryFee: 300.00,
            total: amount,
            userId: currentUser ? currentUser.id : null,
            items: cart.map(item => ({
                id: item.id,
                quantity: item.quantity,
                price: item.price
            }))
        };

        try {
            // 1. Initiate Paypack Payment
            btn.innerHTML = '<i class="fa-solid fa-mobile-screen-button fa-bounce"></i> Check your phone...';
            
            const payResponse = await fetch('http://localhost:3000/api/pay', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: amount,
                    phone: phone
                })
            });

            if (!payResponse.ok) {
                const errorData = await payResponse.json();
                throw new Error(errorData.error || 'Payment initiation failed');
            }

            console.log('Payment initiated');

            // 2. Save order to database
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Finalizing order...';
            const response = await fetch('http://localhost:3000/api/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(orderData)
            });

            if (!response.ok) {
                throw new Error('Failed to place order');
            }

            const data = await response.json();
            console.log('Order success:', data);

            // Display Order ID in success modal
            if (displayOrderId) {
                displayOrderId.textContent = `#${data.orderId}`;
            }

            // Success transition
            checkoutModal.classList.remove('active');
            successModal.classList.add('active');
            
            // Reset state
            cart = [];
            updateCart();
            checkoutForm.reset();
        } catch (error) {
            console.error('Order error:', error);
            alert('There was a problem placing your order. Please try again.');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    continueShoppingBtn.addEventListener('click', () => {
        successModal.classList.remove('active');
    });

}

function openCart() {
    cartDrawer.classList.add('active');
    cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling when cart is open
}

function closeCart() {
    cartDrawer.classList.remove('active');
    cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

function openCheckout() {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const delivery = 300.00;
    const total = subtotal + delivery;

    checkoutSubtotal.textContent = `Ksh ${subtotal.toFixed(2)}`;
    checkoutTotal.textContent = `Ksh ${total.toFixed(2)}`;
    
    checkoutModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    checkoutModal.classList.remove('active');
    successModal.classList.remove('active');
    document.body.style.overflow = '';
}

function openMobileMenu() {
    mobileNav.classList.add('active');
    mobileNavOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    mobileNav.classList.remove('active');
    mobileNavOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Navbar scroll shadow
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 10) {
        navbar.style.boxShadow = 'var(--shadow-md)';
    } else {
        navbar.style.boxShadow = 'none';
    }
});

// --- NEW AUTH & LOCALIZATION LOGIC ---

function setupAuthListeners() {
    loginBtn.addEventListener('click', () => {
        authModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    closeAuthBtn.addEventListener('click', () => {
        authModal.classList.remove('active');
        document.body.style.overflow = '';
    });

    showSignup.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        document.getElementById('authModalTitle').textContent = currentLang === 'en' ? 'Sign Up' : 'Jisajili';
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.style.display = 'none';
        loginForm.style.display = 'block';
        document.getElementById('authModalTitle').textContent = currentLang === 'en' ? 'Login' : 'Ingia';
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('http://localhost:3000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok) {
                currentUser = data.user;
                authToken = data.token;
                localStorage.setItem('user', JSON.stringify(currentUser));
                localStorage.setItem('token', authToken);
                checkAuthState();
                authModal.classList.remove('active');
                loginForm.reset();
                alert(currentLang === 'en' ? 'Welcome back!' : 'Karibu tena!');
            } else {
                alert(data.error);
            }
        } catch (err) {
            console.error('Login error:', err);
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        try {
            const response = await fetch('http://localhost:3000/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            if (response.ok) {
                alert(currentLang === 'en' ? 'Account created! Please login.' : 'Akaunti imeundwa! Tafadhali ingia.');
                showLogin.click();
            } else {
                const data = await response.json();
                alert(data.error);
            }
        } catch (err) {
            console.error('Signup error:', err);
        }
    });

    logoutBtn.addEventListener('click', () => {
        currentUser = null;
        authToken = null;
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        checkAuthState();
        alert(currentLang === 'en' ? 'Logged out successfully' : 'Umetoka kwa mafanikio');
    });

    viewOrdersBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openUserOrders();
    });

    closeUserOrdersBtn.addEventListener('click', () => {
        userOrdersModal.classList.remove('active');
        document.body.style.overflow = '';
    });

    langToggle.addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'sw' : 'en';
        localStorage.setItem('lang', currentLang);
        setupLanguage();
    });
}

function setupLanguage() {
    langToggle.textContent = currentLang.toUpperCase();
    const elements = document.querySelectorAll('[data-en]');
    elements.forEach(el => {
        // Use innerHTML for elements that might contain tags (like the auth-switch links)
        const content = currentLang === 'en' ? el.getAttribute('data-en') : el.getAttribute('data-sw');
        if (content.includes('<')) {
            el.innerHTML = content;
        } else {
            el.textContent = content;
        }
    });

    // Update placeholders
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.placeholder = currentLang === 'en' ? 'Search veggies...' : 'Tafuta mboga...';
    }
}

function checkAuthState() {
    if (currentUser && authToken) {
        authUI.style.display = 'none';
        userProfileNav.style.display = 'flex';
        userNameNav.textContent = currentUser.name.split(' ')[0];
        
        // Auto-fill checkout if elements exist
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const addressInput = document.getElementById('address');
        const phoneInput = document.getElementById('phone');
        
        if (nameInput) nameInput.value = currentUser.name;
        if (emailInput) emailInput.value = currentUser.email;
        if (addressInput && currentUser.address) addressInput.value = currentUser.address;
        if (phoneInput && currentUser.phone) phoneInput.value = currentUser.phone;
    } else {
        authUI.style.display = 'flex';
        userProfileNav.style.display = 'none';
    }
}

async function openUserOrders() {
    if (!currentUser || !authToken) return;

    userOrdersModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    userOrdersList.innerHTML = '<p style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading orders...</p>';

    try {
        const response = await fetch('http://localhost:3000/api/user/profile', {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        if (response.ok) {
            renderUserOrders(data.orders);
        } else {
            userOrdersList.innerHTML = `<p style="color:red; text-align:center;">${data.error}</p>`;
        }
    } catch (err) {
        console.error('Fetch orders error:', err);
        userOrdersList.innerHTML = '<p style="color:red; text-align:center;">Failed to load orders.</p>';
    }
}

function renderUserOrders(orders) {
    if (!orders || orders.length === 0) {
        userOrdersList.innerHTML = `
            <p class="empty-orders" data-en="You haven't placed any orders yet." data-sw="Bado hujaweka agizo lolote.">
                ${currentLang === 'en' ? "You haven't placed any orders yet." : "Bado hujaweka agizo lolote."}
            </p>`;
        return;
    }

    userOrdersList.innerHTML = '';
    orders.forEach(order => {
        const orderCard = document.createElement('div');
        orderCard.className = 'user-order-card';
        
        const date = new Date(order.order_date).toLocaleDateString();
        const statusClass = `status-${order.status ? order.status.toLowerCase().replace(' ', '-') : 'processing'}`;
        
        orderCard.innerHTML = `
            <div class="user-order-header">
                <span class="order-id">#${order.id}</span>
                <span class="order-date">${date}</span>
            </div>
            <div class="user-order-items">${order.items_summary}</div>
            <div class="user-order-footer">
                <span class="order-total">Ksh ${order.total_price.toFixed(2)}</span>
                <span class="order-status-badge ${statusClass}">${order.status || 'Processing'}</span>
            </div>
        `;
        userOrdersList.appendChild(orderCard);
    });
}

// Run Init
document.addEventListener('DOMContentLoaded', init);
