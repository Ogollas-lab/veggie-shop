const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');

const appDirectory = path.resolve(__dirname, '..');
const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'veggie-shop-payment-test-'));
const databasePath = path.join(tempDirectory, 'test.db');
const adminEmail = 'payment-test-admin@example.invalid';
const adminPassword = 'test-only-admin-password-123';
let serverProcess;
let baseUrl;
let createdOrderId;

async function findFreePort() {
    const listener = net.createServer();
    listener.listen(0, '127.0.0.1');
    await once(listener, 'listening');
    const { port } = listener.address();
    await new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
    return port;
}

async function waitForServer() {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        if (serverProcess.exitCode !== null) {
            throw new Error('Test server exited before becoming ready.');
        }

        try {
            const response = await fetch(`${baseUrl}/api/products`);
            if (response.ok && (await response.json()).length > 0) return;
        } catch {
            await delay(100);
        }
    }

    throw new Error('Test server did not become ready.');
}

async function login(email, password) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    return { response, body: await response.json() };
}

before(async () => {
    const port = await findFreePort();
    baseUrl = `http://127.0.0.1:${port}`;
    serverProcess = spawn(process.execPath, [path.join(appDirectory, 'server.js')], {
        cwd: appDirectory,
        env: {
            ...process.env,
            NODE_ENV: 'test',
            PORT: String(port),
            DATABASE_PATH: databasePath,
            JWT_SECRET: 'test-only-jwt-secret-that-is-not-used-outside-tests',
            ADMIN_EMAIL: adminEmail,
            ADMIN_PASSWORD: adminPassword,
            PAYPACK_CLIENT_ID: '',
            PAYPACK_CLIENT_SECRET: '',
            EMAIL_HOST: '',
            EMAIL_USER: '',
            EMAIL_PASS: '',
        },
        stdio: 'ignore',
    });

    await waitForServer();
});

after(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
        const exited = once(serverProcess, 'exit');
        serverProcess.kill();
        await exited;
    }

    fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('Paypack initiation stays disabled for KES', async () => {
    const response = await fetch(`${baseUrl}/api/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 900, phone: '+254700000000' }),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.code, 'KES_PAYMENT_PROVIDER_UNAVAILABLE');
});

test('order total comes from database and status remains pending', async () => {
    const productsResponse = await fetch(`${baseUrl}/api/products`);
    const products = await productsResponse.json();
    const product = products[0];
    const response = await fetch(`${baseUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Test Customer',
            email: 'payment-test-customer@example.invalid',
            address: 'Test address',
            items: [{ id: product.id, quantity: 2, price: 0 }],
            subtotal: 0,
            deliveryFee: 0,
            total: 0,
            amount: 1,
            status: 'Paid',
            payment_status: 'paid',
        }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.subtotal, Number(product.price) * 2);
    assert.equal(body.deliveryFee, 300);
    assert.equal(body.total, Number(product.price) * 2 + 300);
    assert.equal(body.payment_status, 'pending_payment');
    createdOrderId = body.orderId;

    const trackResponse = await fetch(
        `${baseUrl}/api/orders/track?orderId=${createdOrderId}&email=payment-test-customer%40example.invalid`
    );
    const trackedOrder = await trackResponse.json();
    assert.equal(trackResponse.status, 200);
    assert.equal(trackedOrder.status, 'Pending Payment');
    assert.equal(trackedOrder.payment_status, 'pending_payment');
});

test('admin and customer cannot convert a pending order into paid or fulfillment', async () => {
    let adminLogin;
    for (let attempt = 0; attempt < 20; attempt += 1) {
        adminLogin = await login(adminEmail, adminPassword);
        if (adminLogin.response.ok) break;
        await delay(100);
    }
    assert.equal(adminLogin.response.status, 200);

    const adminHeaders = {
        Authorization: `Bearer ${adminLogin.body.token}`,
        'Content-Type': 'application/json',
    };
    let response = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'Processing' }),
    });
    assert.equal(response.status, 409);

    response = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'Paid' }),
    });
    assert.equal(response.status, 400);

    response = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'Payment Cancelled' }),
    });
    assert.equal(response.status, 200);

    response = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'Processing' }),
    });
    assert.equal(response.status, 409);

    const ordersResponse = await fetch(`${baseUrl}/api/admin/orders`, { headers: adminHeaders });
    const orders = await ordersResponse.json();
    const preexistingOrder = orders.find((order) => order.id !== createdOrderId);
    if (preexistingOrder) {
        response = await fetch(`${baseUrl}/api/admin/orders/${preexistingOrder.id}/status`, {
            method: 'PATCH',
            headers: adminHeaders,
            body: JSON.stringify({ status: 'Delivered' }),
        });
        assert.equal(response.status, 409);
    }

    const customerEmail = 'payment-test-customer@example.invalid';
    response = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Customer', email: customerEmail, password: 'test-only-customer-password' }),
    });
    assert.equal(response.status, 201);

    const customerLogin = await login(customerEmail, 'test-only-customer-password');
    assert.equal(customerLogin.response.status, 200);
    response = await fetch(`${baseUrl}/api/admin/orders/${createdOrderId}/status`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${customerLogin.body.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'Paid' }),
    });
    assert.equal(response.status, 403);
});

test('admin revenue is restricted to verified paid records', () => {
    const adminScript = fs.readFileSync(path.join(appDirectory, 'admin-script.js'), 'utf8');
    assert.match(adminScript, /order\.payment_status === 'paid'/);
});