// State
let allProducts = [];
let allOrders = [];

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const productsTableBody = document.querySelector('#productsTable tbody');
const recentOrdersTableBody = document.querySelector('#recentOrdersTable tbody');
const fullOrdersTableBody = document.querySelector('#fullOrdersTable tbody');

// Stats Elements
const totalOrdersCount = document.getElementById('totalOrdersCount');
const totalRevenueAmount = document.getElementById('totalRevenueAmount');
const totalProductsCount = document.getElementById('totalProductsCount');

// Modal Elements
const addProductModal = document.getElementById('addProductModal');
const showAddProductModalBtn = document.getElementById('showAddProductModal');
const closeModalBtns = document.querySelectorAll('.close-modal');
const addProductForm = document.getElementById('addProductForm');

// Tabs Navigation
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        if (item.classList.contains('logout')) return;
        
        e.preventDefault();
        const tabName = item.getAttribute('data-tab');
        
        navItems.forEach(n => n.classList.remove('active'));
        item.classList.add('active');
        
        tabContents.forEach(tab => {
            tab.classList.remove('active');
            if (tab.id === tabName) tab.classList.add('active');
        });
    });
});

// Initialize Dashboard
async function initDashboard() {
    const isAllowed = await ensureAdminAccess();
    if (!isAllowed) {
        return;
    }

    await fetchProducts();
    await fetchOrders();
    updateStats();
    renderProducts();
    renderOrders();
}

async function ensureAdminAccess() {
    const token = sessionStorage.getItem('token');

    if (!token) {
        window.location.replace('index.html?adminLogin=1');
        return false;
    }

    try {
        const response = await fetch('/api/admin/me', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.status === 401) {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            window.location.replace('index.html?adminLogin=1');
            return false;
        }

        if (response.status === 403) {
            window.location.replace('index.html?adminDenied=1');
            return false;
        }

        if (!response.ok) throw new Error(`Admin verification failed (${response.status}).`);

        return true;
    } catch (error) {
        console.error('Admin access check failed:', error);
        document.body.innerHTML = '<main style="padding:2rem;font-family:system-ui"><h1>Admin portal unavailable</h1><p>Could not verify admin access. Please check the connection and reload.</p></main>';
        return false;
    }
}

// Fetch Data
async function fetchProducts() {
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch('/api/products', {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!response.ok) throw new Error(`Products request failed (${response.status}).`);
        const products = await response.json();
        allProducts = Array.isArray(products) ? products : [];
    } catch (err) {
        console.error('Error fetching products:', err);
    }
}

async function fetchOrders() {
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch('/api/admin/orders', {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`Orders request failed (${response.status}).`);
        const orders = await response.json();
        allOrders = Array.isArray(orders) ? orders : [];
    } catch (err) {
        console.error('Error fetching orders:', err);
    }
}

// Update Stats
function updateStats() {
    totalOrdersCount.innerText = allOrders.length;
    totalProductsCount.innerText = allProducts.length;
    
    const revenue = allOrders.reduce((sum, order) =>
        order.payment_status === 'paid' ? sum + Number(order.total_price || 0) : sum, 0);
    totalRevenueAmount.innerText = `Ksh ${revenue.toLocaleString()}`;
}

// Render Products
function renderProducts() {
    productsTableBody.innerHTML = '';
    allProducts.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${product.image}" class="product-thumb" alt="${product.name}"></td>
            <td>${product.name}</td>
            <td>Ksh ${product.price}</td>
            <td>${product.category}</td>
            <td>
                <label class="switch">
                    <input type="checkbox" ${product.in_stock ? 'checked' : ''} onchange="toggleStock(${product.id}, this.checked)">
                    <span class="slider"></span>
                </label>
            </td>
            <td>
                <button class="btn btn-secondary" onclick="deleteProduct(${product.id})" style="color: #ef4444"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        productsTableBody.appendChild(tr);
    });
}

// Render Orders
function renderOrders() {
    // Recent Orders (Overview)
    recentOrdersTableBody.innerHTML = '';
    allOrders.slice(0, 5).forEach(order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${order.id}</td>
            <td>${order.customer_name}</td>
            <td>${new Date(order.order_date).toLocaleDateString()}</td>
            <td>Ksh ${order.total_price}</td>
            <td>${formatPaymentStatus(order.payment_status)}</td>
        `;
        recentOrdersTableBody.appendChild(tr);
    });

    // Full Orders List
    fullOrdersTableBody.innerHTML = '';
    allOrders.forEach(order => {
        const tr = document.createElement('tr');
        const statusOptions = order.status === 'Pending Payment'
            ? ['Pending Payment', 'Payment Cancelled']
            : [...new Set([order.status, 'Cancelled'])];
        const selectHtml = `
            <select class="status-select" onchange="updateStatus(${order.id}, this.value)">
                ${statusOptions.map(opt => `<option value="${opt}" ${order.status === opt ? 'selected' : ''}>${opt === 'In Transit' ? 'Shipped' : opt}</option>`).join('')}
            </select>
        `;
        
        tr.innerHTML = `
            <td>#${order.id}</td>
            <td>${order.customer_name}</td>
            <td>
                <div style="font-size: 0.8rem">${order.customer_email}</div>
                <div style="font-size: 0.8rem; color: #64748b">${order.address}</div>
            </td>
            <td>${order.items_summary}</td>
            <td>${new Date(order.order_date).toLocaleString()}</td>
            <td><strong>Ksh ${order.total_price}</strong></td>
            <td>${formatPaymentStatus(order.payment_status)}</td>
            <td>${selectHtml}</td>
        `;
        fullOrdersTableBody.appendChild(tr);
    });
}

function formatPaymentStatus(paymentStatus) {
    if (paymentStatus === 'paid') return 'Paid';
    if (paymentStatus === 'payment_failed') return 'Payment Failed';
    if (paymentStatus === 'pending_payment') return 'Pending Payment';
    return 'Unverified';
}

// Actions
async function updateStatus(id, newStatus) {
    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch(`/api/admin/orders/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: newStatus })
        });
        if (response.ok) {
            console.log(`Status updated for order #${id}`);
        }
    } catch (err) {
        console.error('Error updating status:', err);
    }
}
async function toggleStock(id, status) {
    try {
        const token = sessionStorage.getItem('token');
        await fetch(`/api/admin/products/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ in_stock: status })
        });
        await fetchProducts();
    } catch (err) {
        console.error('Error toggling stock:', err);
    }
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to remove this product?')) return;
    
    // API for delete not implemented yet, but for now we can toggle stock or add endpoint later
    alert('Delete functionality can be added here. For now, try toggling stock visibility.');
}

// Modal Handlers
showAddProductModalBtn.addEventListener('click', () => addProductModal.classList.add('active'));
closeModalBtns.forEach(btn => btn.addEventListener('click', () => addProductModal.classList.remove('active')));

addProductForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newProduct = {
        name: document.getElementById('pName').value,
        price: parseFloat(document.getElementById('pPrice').value),
        weight: document.getElementById('pWeight').value,
        category: document.getElementById('pCategory').value,
        image: document.getElementById('pImage').value,
        badge: document.getElementById('pBadge').value || null
    };

    try {
        const token = sessionStorage.getItem('token');
        const response = await fetch('/api/admin/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(newProduct)
        });

        if (response.ok) {
            addProductModal.classList.remove('active');
            addProductForm.reset();
            await initDashboard();
        }
    } catch (err) {
        console.error('Error adding product:', err);
    }
});

// View All Orders shortcut
document.querySelector('.view-all-orders').addEventListener('click', () => {
    document.querySelector('[data-tab="orders"]').click();
});

// Start
initDashboard();
