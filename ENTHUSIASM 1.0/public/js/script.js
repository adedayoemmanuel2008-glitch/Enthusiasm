// Client-side JavaScript for dynamic interactions and validations

// Email validation function
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Password strength check
function validatePassword(password) {
  return password.length >= 6;
}

// Updated for JWT
document.addEventListener('DOMContentLoaded', () => {
  // For registration form
  const regForm = document.querySelector('form[action="/register"]');
  if (regForm) {
    const passwordInput = regForm.querySelector('input[name="password"]');
    if (passwordInput) {
      passwordInput.addEventListener('blur', () => {
        if (!validatePassword(passwordInput.value)) {
          alert('Password must be at least 6 characters.');
        }
      });
    }

    regForm.addEventListener('submit', (e) => {
      const courses = regForm.querySelectorAll('input[name="courses"]:checked');
      if (courses.length === 0) {
        alert('Please select at least one course.');
        e.preventDefault();
      }
    });
  }

  // For login form
  const loginForm = document.querySelector('form[action="/login"]');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      const email = loginForm.querySelector('input[name="email"]').value;
      if (!validateEmail(email)) {
        alert('Please enter a valid email.');
        e.preventDefault();
      }
    });
  }

  // Dynamic hover effects for buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
  });

  // For dashboard: Confirm attendance
  const attendanceBtn = document.querySelector('button[name="mark-attendance"]');
  if (attendanceBtn) {
    attendanceBtn.addEventListener('click', (e) => {
      if (!confirm('Mark yourself as attended?')) e.preventDefault();
    });
  }
});