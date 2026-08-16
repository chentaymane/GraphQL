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
    window.location.href = 'index.html'
}
document.getElementById('login-btn').addEventListener('click', Login);