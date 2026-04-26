const authContent = document.getElementById('auth-content');
const heroText = document.getElementById('hero-text');
let refreshPromise = null;

const parseResponse = async (res) => {
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        return null;
    }

    return res.json();
};

const refreshSession = async () => {
    if (!refreshPromise) {
        refreshPromise = fetch('/api/auth/refresh', {
            method: 'POST',
            credentials: 'same-origin'
        }).then(async (res) => {
            const data = await parseResponse(res);
            if (!res.ok) {
                throw new Error(data?.error || 'Session refresh failed');
            }
            return data;
        }).finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
};

const apiFetch = async (url, options = {}, allowRetry = true) => {
    const headers = { ...options.headers };
    if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
        ...options,
        credentials: 'same-origin',
        headers
    });

    if (res.status === 401 && allowRetry && url !== '/api/auth/refresh') {
        try {
            await refreshSession();
            return apiFetch(url, options, false);
        } catch (error) {
            throw new Error('Session expired');
        }
    }

    const data = await parseResponse(res);
    if (!res.ok) throw new Error(data?.error || 'Identity error');
    return data;
};

const views = {
    login: () => `
        <h1>Sign In</h1>
        <p class="subtitle">Access your intentional archive.</p>
        <form id="loginForm">
            <div class="form-group">
                <label>Identity (Email)</label>
                <input type="email" name="email" placeholder="email@example.com" required>
            </div>
            <div class="form-group">
                <label>Security (Password)</label>
                <input type="password" name="password" placeholder="Password" required>
            </div>
            <button type="submit">ENTER ARCHIVE</button>
        </form>
        <div class="footer-links">
            <p>New here? <a href="#" id="link-register">Create Identity</a></p>
            <p style="margin-top: 10px;"><a href="#" id="link-forgot">Forgot Password?</a></p>
        </div>
    `,
    register: () => `
        <h1>Create Identity</h1>
        <p class="subtitle">Join the collection of focused minds.</p>
        <form id="registerForm">
            <div class="form-group">
                <label>Username</label>
                <input type="text" name="username" placeholder="Archaic" required>
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" name="email" placeholder="email@example.com" required>
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" name="password" placeholder="Password" required>
            </div>
            <button type="submit">BEGIN JOURNEY</button>
        </form>
        <div class="footer-links">
            <p>Already joined? <a href="#" id="link-login">Sign In</a></p>
        </div>
    `,
    forgot: () => `
        <h1>Recovery</h1>
        <p class="subtitle">Regain access to your archives.</p>
        <form id="forgotForm">
            <div class="form-group">
                <label>Your Registered Email</label>
                <input type="email" name="email" placeholder="email@example.com" required>
            </div>
            <button type="submit">SEND RECOVERY CODE</button>
        </form>
        <div class="footer-links">
            <p><a href="#" id="link-login">Back to Sign In</a></p>
        </div>
    `,
    verify: (email) => `
        <h1>Verification</h1>
        <p class="subtitle">Enter the code sent to ${email}</p>
        <form id="verifyForm">
            <input type="hidden" name="email" value="${email}">
            <div class="form-group">
                <label>6-Digit Code</label>
                <input type="text" name="otp" placeholder="000000" maxlength="6" required>
            </div>
            <button type="submit">VERIFY IDENTITY</button>
        </form>
    `,
    reset: (email) => `
        <h1>New Security</h1>
        <p class="subtitle">Define your new access key.</p>
        <form id="resetForm">
            <input type="hidden" name="email" value="${email}">
            <div class="form-group">
                <label>Recovery Code</label>
                <input type="text" name="otp" placeholder="000000" required>
            </div>
            <div class="form-group">
                <label>New Password</label>
                <input type="password" name="password" placeholder="Password" required>
            </div>
            <button type="submit">UPDATE SECURITY</button>
        </form>
    `
};

window.showView = function(viewName, data = null) {
    if (!authContent) return;

    authContent.classList.add('fade-out');

    const params = new URLSearchParams(window.location.search);
    const redirectUri = params.get('redirect');

    setTimeout(() => {
        authContent.innerHTML = views[viewName](data);
        authContent.classList.remove('fade-out');
        authContent.classList.add('fade-in');

        if (heroText) {
            if (viewName === 'register') heroText.innerText = 'Every great story starts with a single intention.';
            if (viewName === 'forgot' || viewName === 'reset') heroText.innerText = 'Security is the ability to recover what was lost.';
            if (viewName === 'login') heroText.innerText = 'The best way to predict the future is to create it.';
        }

        // Keep the redirect parameter alive when clicking "Create Identity" or "Sign In"
        if (redirectUri) {
            document.querySelectorAll('.footer-links a').forEach(link => {
                const url = new URL(link.href, window.location.href);
                url.searchParams.set('redirect', redirectUri);
                // We handle this in showView navigation logic usually, 
                // but just in case they are real links:
                if (link.id === 'link-register' || link.id === 'link-login') {
                    // These are handled by attachNavigation, so we just need to ensure 
                    // the URL search stays consistent.
                }
            });
        }

        attachNavigation();
        attachListeners();
    }, 400);
};

function getPendingEmail() {
    const params = new URLSearchParams(window.location.search);
    return params.get('email') || sessionStorage.getItem('pendingVerificationEmail') || '';
}

function syncVerifyEmailContext() {
    const verifyForm = document.getElementById('verifyForm');
    if (!verifyForm) return;

    const email = getPendingEmail();
    const emailField = verifyForm.elements.email || document.getElementById('email');
    if (emailField && email) {
        emailField.value = email;
    }

    const emailHint = document.getElementById('verifyEmailHint');
    if (emailHint) {
        emailHint.innerText = email
            ? `Verifying ${email}`
            : 'Open this page from registration, or add ?email=you@example.com';
    }
}

function attachNavigation() {
    const navLinks = {
        'link-register': 'register',
        'link-login': 'login',
        'link-forgot': 'forgot'
    };

    Object.entries(navLinks).forEach(([id, view]) => {
        const link = document.getElementById(id);
        if (link && !link.dataset.bound) {
            link.dataset.bound = 'true';
            link.addEventListener('click', (e) => {
                e.preventDefault();
                window.showView(view);
            });
        }
    });
}

function attachListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm && !loginForm.dataset.bound) {
        loginForm.dataset.bound = 'true';
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const data = await apiFetch('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ email: e.target.email.value, password: e.target.password.value })
                }, false);
                
                const params = new URLSearchParams(window.location.search);
                const redirectUri = params.get('redirect');
                if (redirectUri) {
                    // Append the token to the redirect URI so the other app can use it!
                    const separator = redirectUri.includes('?') ? '&' : '?';
                    window.location.href = `${redirectUri}${separator}sso_token=${data.token}`;
                } else {
                    window.location.href = 'dashboard.html';
                }
            } catch (err) {
                alert(err.message);
            }
        });
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm && !registerForm.dataset.bound) {
        registerForm.dataset.bound = 'true';
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target.email.value;
            try {
                await apiFetch('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ username: e.target.username.value, email, password: e.target.password.value })
                }, false);

                sessionStorage.setItem('pendingVerificationEmail', email);
                
                const params = new URLSearchParams(window.location.search);
                const redirectUri = params.get('redirect');
                const redirectSuffix = redirectUri ? `&redirect=${encodeURIComponent(redirectUri)}` : '';

                if (authContent) {
                    window.showView('verify', email);
                } else {
                    window.location.href = `verify.html?email=${encodeURIComponent(email)}${redirectSuffix}`;
                }
            } catch (err) {
                alert(err.message);
            }
        });
    }

    const verifyForm = document.getElementById('verifyForm');
    if (verifyForm && !verifyForm.dataset.bound) {
        verifyForm.dataset.bound = 'true';
        syncVerifyEmailContext();
        verifyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await apiFetch('/api/auth/verify', {
                    method: 'POST',
                    body: JSON.stringify({ email: e.target.email.value, otp: e.target.otp.value })
                }, false);
                sessionStorage.removeItem('pendingVerificationEmail');
                alert('Verified! Redirecting...');
                
                const params = new URLSearchParams(window.location.search);
                const redirectUri = params.get('redirect');
                if (redirectUri) {
                    window.location.href = redirectUri;
                } else if (authContent) {
                    window.showView('login');
                } else {
                    window.location.href = 'index.html';
                }
            } catch (err) {
                alert(err.message);
            }
        });
    }

    const forgotForm = document.getElementById('forgotForm');
    if (forgotForm && !forgotForm.dataset.bound) {
        forgotForm.dataset.bound = 'true';
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = e.target.email.value;
            try {
                await apiFetch('/api/auth/forgotpassword', {
                    method: 'POST',
                    body: JSON.stringify({ email })
                }, false);
                window.showView('reset', email);
            } catch (err) {
                alert(err.message);
            }
        });
    }

    const resetForm = document.getElementById('resetForm');
    if (resetForm && !resetForm.dataset.bound) {
        resetForm.dataset.bound = 'true';
        resetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await apiFetch('/api/auth/resetpassword', {
                    method: 'PUT',
                    body: JSON.stringify({ email: e.target.email.value, otp: e.target.otp.value, password: e.target.password.value })
                }, false);
                sessionStorage.removeItem('pendingVerificationEmail');
                alert('Security Updated. Please Sign In.');
                window.showView('login');
            } catch (err) {
                alert(err.message);
            }
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && !logoutBtn.dataset.bound) {
        logoutBtn.dataset.bound = 'true';
        logoutBtn.addEventListener('click', async () => {
            try {
                await apiFetch('/api/auth/logout', { method: 'POST' }, false);
            } catch (err) {
                console.error(err.message);
            } finally {
                window.location.href = 'index.html';
            }
        });
    }
}

async function bootstrapProtectedPage() {
    const page = document.body?.dataset?.page;
    if (!page) return;

    try {
        const data = await apiFetch('/api/auth/me');
        const user = data.user;
        const token = data.token;

        // SSO Auto-Redirect: If we are already logged in and came from another app, jump back with the token!
        const params = new URLSearchParams(window.location.search);
        const redirectUri = params.get('redirect');
        if (redirectUri && token) {
            const separator = redirectUri.includes('?') ? '&' : '?';
            window.location.href = `${redirectUri}${separator}sso_token=${token}`;
            return; // Stop execution here
        }

        document.querySelectorAll('[data-user="username"]').forEach((el) => {
            el.innerText = user.username;
        });
        document.querySelectorAll('[data-user="email"]').forEach((el) => {
            el.innerText = user.email;
        });
        document.querySelectorAll('[data-user="status"]').forEach((el) => {
            el.innerText = user.accountStatus || 'active';
        });
        document.querySelectorAll('[data-user="verified"]').forEach((el) => {
            el.innerText = user.isVerified ? 'Verified' : 'Pending';
        });
        document.querySelectorAll('[data-user="avatar"]').forEach((el) => {
            if (el.tagName === 'IMG') {
                el.src = user.avatar;
                el.alt = `${user.username} avatar`;
            }
        });
        document.querySelectorAll('[data-user="created-at"]').forEach((el) => {
            el.innerText = new Date(user.createdAt).toLocaleDateString();
        });
        document.querySelectorAll('[data-user="last-login"]').forEach((el) => {
            el.innerText = user.lastLogin
                ? new Date(user.lastLogin).toLocaleString()
                : 'First successful sign-in pending';
        });
        document.querySelectorAll('[data-user-initial]').forEach((el) => {
            el.innerText = user.username?.[0]?.toUpperCase() || '?';
        });
    } catch (err) {
        // Only redirect to login if we aren't already there (to avoid loops)
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            window.location.href = 'index.html';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    attachNavigation();
    attachListeners();
    syncVerifyEmailContext();
    bootstrapProtectedPage();

    if (authContent) {
        window.showView('login');
    }
});
