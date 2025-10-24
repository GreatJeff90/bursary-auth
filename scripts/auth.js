// scripts/auth.js - Complete fixed version
const API_BASE_URL = 'http://localhost:5000/api';

// DOM Elements (add these at the top)
let successText, successMessage, signupForm, passwordStrengthBar;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize DOM elements if they exist on the page
    successText = document.getElementById('successText');
    successMessage = document.getElementById('successMessage');
    signupForm = document.getElementById('signupForm');
    passwordStrengthBar = document.getElementById('passwordStrengthBar');
    
    // Test backend connection on load
    testBackendConnection();
});

// Utility functions
function getAuthToken() {
    return localStorage.getItem('authToken');
}

function setAuthToken(token) {
    localStorage.setItem('authToken', token);
}

function removeAuthToken() {
    localStorage.removeItem('authToken');
}

function getUserData() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}

// Test backend connection
async function testBackendConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/test`);
        const data = await response.json();
        console.log("✅ Backend connection:", data.status);
        return true;
    } catch (error) {
        console.error("❌ Backend connection failed:", error);
        return false;
    }
}

// Form utility functions
function clearErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
    });
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
    } else {
        console.error(`Error element #${elementId} not found`);
    }
}

function setLoadingState(button, isLoading) {
    if (!button) return;
    
    const btnText = button.querySelector('.btn-text');
    const btnLoading = button.querySelector('.btn-loading');
    
    if (isLoading) {
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
        button.disabled = true;
    } else {
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
        button.disabled = false;
    }
}

function getEnteredOtp() {
    const otpDigits = document.querySelectorAll('.otp-digit');
    if (!otpDigits.length) return '';
    
    return Array.from(otpDigits).map(digit => digit.value).join('');
}

// Updated login function
async function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('loginBtn');

    console.log("🔍 Login attempt:", { username, password }); 
    
    clearErrors();
    
    if (!username || !password) {
        showError('passwordError', 'Please fill in all fields');
        return;
    }
    
    setLoadingState(loginBtn, true);
    
    try {
        console.log("🔍 Sending login request to:", `${API_BASE_URL}/login`);
        
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });
        
        console.log("🔍 Login response status:", response.status);
        
        const data = await response.json();
        console.log("🔍 Login response data:", data);
        
        if (data.success) {
            // Store user ID for OTP verification
            sessionStorage.setItem('pendingUserId', data.user_id);
            sessionStorage.setItem('userEmail', data.email);
            
            console.log("🔍 Stored pending user:", data.user_id);
            console.log("🔍 Redirecting to OTP page...");
            
            // Redirect to OTP page
            window.location.href = 'otp-verification.html';
        } else {
            showError('passwordError', data.message);
        }
    } catch (error) {
        showError('passwordError', 'Network error. Please try again.');
        console.error('Login error:', error);
    } finally {
        setLoadingState(loginBtn, false);
    }
}

// Updated signup function
async function handleSignup() {
    const fullName = document.getElementById('fullName')?.value.trim();
    const studentId = document.getElementById('studentId')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const signupBtn = document.getElementById('signupBtn');
    
    if (!fullName || !studentId || !email || !newPassword || !confirmPassword || !signupBtn) {
        console.error("❌ Signup form elements not found");
        return;
    }
    
    clearErrors();
    
    // Validation
    let isValid = true;
    
    if (!fullName) {
        showError('fullNameError', 'Please enter your full name');
        isValid = false;
    }
    
    if (!studentId) {
        showError('studentIdError', 'Please enter your student ID');
        isValid = false;
    }
    
    if (!email) {
        showError('emailError', 'Please enter your university email');
        isValid = false;
    } else if (!email.endsWith('@uniport.edu.ng')) {
        showError('emailError', 'Please use your official university email');
        isValid = false;
    }
    
    if (!newPassword) {
        showError('newPasswordError', 'Please create a password');
        isValid = false;
    } else if (newPassword.length < 8) {
        showError('newPasswordError', 'Password must be at least 8 characters');
        isValid = false;
    }
    
    if (!confirmPassword) {
        showError('confirmPasswordError', 'Please confirm your password');
        isValid = false;
    } else if (newPassword !== confirmPassword) {
        showError('confirmPasswordError', 'Passwords do not match');
        isValid = false;
    }
    
    if (!isValid) return;
    
    setLoadingState(signupBtn, true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                studentId,
                fullName,
                email,
                password: newPassword
            })
        });
        
        const data = await response.json();
        console.log("🔍 Signup response:", data);
        
        if (data.success && successText && successMessage) {
            successText.textContent = data.message;
            successMessage.style.display = 'flex';
            signupForm.reset();
            if (passwordStrengthBar) {
                passwordStrengthBar.style.width = '0';
            }
            
            setTimeout(() => {
                switchTab('login');
            }, 3000);
        } else {
            showError('emailError', data.message);
        }
    } catch (error) {
        showError('emailError', 'Network error. Please try again.');
        console.error('Signup error:', error);
    } finally {
        setLoadingState(signupBtn, false);
    }
}

// Updated OTP verification
async function handleOtpVerification() {
    const enteredOtp = getEnteredOtp();
    const verifyBtn = document.getElementById('verifyBtn');
    const userId = sessionStorage.getItem('pendingUserId');

    console.log("🔍 OTP Verification:", { userId, enteredOtp }); 
    
    if (!enteredOtp || enteredOtp.length !== 6) {
        showError('otpError', 'Please enter the complete 6-digit code');
        return;
    }
    
    if (!userId) {
        showError('otpError', 'Session expired. Please login again.');
        return;
    }
    
    setLoadingState(verifyBtn, true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/verify-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: userId,
                otp: enteredOtp
            })
        });
        
        const data = await response.json();
        console.log("🔍 OTP verification response:", data);
        
        if (data.success) {
            // Store authentication token and user data
            setAuthToken(data.token);
            localStorage.setItem('userData', JSON.stringify(data.user));
            
            // Clear pending session
            sessionStorage.removeItem('pendingUserId');
            sessionStorage.removeItem('userEmail');
            
            console.log("🔍 Login successful, redirecting to dashboard...");
            
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            showError('otpError', data.message);
        }
    } catch (error) {
        showError('otpError', 'Network error. Please try again.');
        console.error('OTP verification error:', error);
    } finally {
        setLoadingState(verifyBtn, false);
    }
}

// Dashboard initialization
async function initializeDashboard() {
    const token = getAuthToken();
    
    if (!token) {
        console.log("❌ No auth token, redirecting to login");
        window.location.href = 'index.html';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/dashboard`, {
            headers: {
                'Authorization': `Bearer ${token}`  // Fixed: Added Bearer prefix
            }
        });
        
        const data = await response.json();
        console.log("🔍 Dashboard data:", data);
        
        if (data.success) {
            // Update dashboard with real data
            updateDashboard(data);
        } else {
            // Token invalid, redirect to login
            console.log("❌ Invalid token, redirecting to login");
            removeAuthToken();
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

function updateDashboard(data) {
    // Update user info
    const userDisplayName = document.getElementById('userDisplayName');
    const sidebarUserName = document.getElementById('sidebarUserName');
    
    if (userDisplayName) userDisplayName.textContent = data.user.full_name;
    if (sidebarUserName) sidebarUserName.textContent = data.user.full_name;
    
    // Update stats
    const statCards = document.querySelectorAll('.stat-card');
    if (statCards.length >= 2) {
        statCards[0].querySelector('.stat-value').textContent = 
            `₦${data.stats.total_disbursed?.toLocaleString() || '0'}`;
        statCards[1].querySelector('.stat-value').textContent = 
            data.stats.active_applications || '0';
    }
    
    // Update recent activity
    updateActivityList(data.recent_activity);
}

function updateActivityList(activities) {
    const activityList = document.querySelector('.activity-list');
    if (!activityList) return;
    
    activityList.innerHTML = '';
    
    activities.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = `activity-item ${activity.status}`;
        activityItem.innerHTML = `
            <div class="activity-icon">
                <i class="fas fa-${getActivityIcon(activity.action)}"></i>
            </div>
            <div class="activity-details">
                <strong>${activity.action}</strong>
                <span>${formatTimestamp(activity.timestamp)} • ${activity.details || ''}</span>
            </div>
        `;
        activityList.appendChild(activityItem);
    });
}

function getActivityIcon(action) {
    const icons = {
        'Login': 'sign-in-alt',
        'OTP Verification': 'envelope',
        'Password Change': 'sync-alt',
        'Security Check': 'shield-alt',
        'Successful Login': 'check'
    };
    return icons[action] || 'info-circle';
}

function formatTimestamp(timestamp) {
    try {
        const date = new Date(timestamp);
        return date.toLocaleString();
    } catch (e) {
        return 'Just now';
    }
}

// Tab switching function (for login/signup pages)
function switchTab(tab) {
    const loginTab = document.querySelector('[data-tab="login"]');
    const signupTab = document.querySelector('[data-tab="signup"]');
    const tabIndicator = document.getElementById('tabIndicator');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const successMessage = document.getElementById('successMessage');
    
    if (!loginTab || !signupTab) return;
    
    if (tab === 'login') {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        if (tabIndicator) tabIndicator.classList.remove('signup');
        if (loginForm) loginForm.classList.remove('hidden');
        if (signupForm) signupForm.classList.add('hidden');
        if (successMessage) successMessage.style.display = 'none';
    } else {
        loginTab.classList.remove('active');
        signupTab.classList.add('active');
        if (tabIndicator) tabIndicator.classList.add('signup');
        if (loginForm) loginForm.classList.add('hidden');
        if (signupForm) signupForm.classList.remove('hidden');
    }
}

// Updated logout function
async function logout() {
    const token = getAuthToken();
    
    if (token) {
        try {
            await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    // Clear all storage
    removeAuthToken();
    localStorage.removeItem('userData');
    sessionStorage.clear();
    
    // Redirect to login
    window.location.href = 'index.html';
}