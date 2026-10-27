// If already logged in, skip straight to the medical issues page
if (localStorage.getItem('neutrix_authenticated') === 'true') {
    const profileDone = localStorage.getItem('neutrix_hospital_profile') || localStorage.getItem('neutrix_patient_name');
    window.location.replace(profileDone ? 'issues.html' : 'profile.html');
}

document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value;
    const feedback = document.getElementById('loginFeedback');

    const testEmail = "team@neutrinos.com";
    const testPassword = "neutrixpassword123";

    if (email === testEmail && password === testPassword) {
        feedback.innerHTML = `<div class="alert-success" style="padding: 10px; margin-top: 15px; text-align: center;">✓ Access Granted! Opening your workspace...</div>`;

        localStorage.setItem('neutrix_authenticated', 'true');
        localStorage.setItem('neutrix_user_role', 'patient'); // Standardize as patient globally

        // First login: fill in the profile once. After that: go straight to My Medical Issues.
        const hasProfile = !!(localStorage.getItem('neutrix_hospital_profile') || localStorage.getItem('neutrix_patient_name'));
        setTimeout(() => {
            window.location.href = hasProfile ? 'issues.html' : 'profile.html';
        }, 1000);
    } else {
        feedback.innerHTML = `<div class="alert-danger" style="padding: 10px; margin-top: 15px; text-align: center;">✗ Invalid email address or password. Try again.</div>`;
    }
});
