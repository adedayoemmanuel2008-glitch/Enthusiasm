const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (pass) => pass.length >= 6;

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. DYNAMIC MESSAGE HANDLING
    // Displays errors/messages from the URL (e.g., /login?message=Account+Created)
    const urlParams = new URLSearchParams(window.location.search);
    const message = urlParams.get('message');
    const error = urlParams.get('error');
    const msgContainer = document.getElementById('message-container');

    if (msgContainer) {
        if (message) {
            msgContainer.innerText = message;
            msgContainer.style.color = "#27ae60"; // Green for success
        } else if (error) {
            msgContainer.innerText = error;
            msgContainer.style.color = "#ff4444"; // Red for errors
        }
    }

    // 2. REGISTRATION FORM VALIDATION
    const regForm = document.querySelector('form[action="/register"]');
    if (regForm) {
        regForm.addEventListener('submit', (e) => {
            const email = regForm.querySelector('#email').value;
            const password = regForm.querySelector('#password').value;
            const courses = regForm.querySelectorAll('input[name="courses"]:checked');

            if (!validateEmail(email)) {
                alert('⚠️ Please enter a valid email address.');
                e.preventDefault();
            } else if (!validatePassword(password)) {
                alert('⚠️ Password must be at least 6 characters.');
                e.preventDefault();
            } else if (courses.length === 0) {
                alert('⚠️ Please select at least one course track.');
                e.preventDefault();
            }
        });
    }

    // 3. LOGIN FORM VALIDATION
    const loginForm = document.querySelector('form[action="/login"]');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            const email = loginForm.querySelector('#email').value;
            if (!validateEmail(email)) {
                alert('⚠️ Please enter a valid email.');
                e.preventDefault();
            }
        });
    }

    // 4. ATTENDANCE CONFIRMATION
    // Target forms that have an attendance button
    const attendanceForm = document.querySelector('form[action^="/mark-attendance"]');
    if (attendanceForm) {
        attendanceForm.addEventListener('submit', (e) => {
            const confirmed = confirm('Confirm your attendance for today?');
            if (!confirmed) e.preventDefault();
        });
    }

    // 5. JWT TOKEN STORAGE
    // If a token is in the URL (first login), save it for future requests
    const token = urlParams.get('token');
    if (token) {
        localStorage.setItem('enthusiasmToken', token);
    }

    // 6. PASSWORD MATCH (For Reset Password Page)
    const resetForm = document.getElementById('resetForm');
    if (resetForm) {
        resetForm.addEventListener('submit', (e) => {
            const p1 = document.getElementById('password').value;
            const p2 = document.getElementById('confirmPassword').value;
            if (p1 !== p2) {
                alert("⚠️ Passwords do not match!");
                e.preventDefault();
            }
        });
    }
});