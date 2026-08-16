async function Login() {
    const email_user = document.getElementById('identifier').value
    const password = document.getElementById('password').value

    const res = await fetch('https://learn.zone01oujda.ma/api/auth/signin', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${btoa(`${email_user}:${password}`)}`
        }
    })

    if (!res.ok) {
        throw new Error('Invalid username/email or password')
    }
   const token = await res.json()
    localStorage.setItem('jwt', token)
    showProfile();
}

function showProfile() {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('profile-section').style.display = 'block';
}

function Logout() {
    localStorage.removeItem('jwt');
    window.location.reload();
}

if (localStorage.getItem('jwt')) {
    showProfile();
}

document.getElementById('login-btn').addEventListener('click', Login);
document.getElementById('logout-btn').addEventListener('click', Logout);