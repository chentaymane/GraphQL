const SIGNIN_URL = 'https://learn.zone01oujda.ma/api/auth/signin'
const GRAPHQL_URL = 'https://learn.zone01oujda.ma/api/graphql-engine/v1/graphql'

// ask the jwt with username/email and password
async function Login() {
    const email_user = document.getElementById('identifier').value
    const password = document.getElementById('password').value

    // btoa() only accepts latin1, so encode to utf-8 bytes first
    const credentials = btoa(String.fromCharCode(...new TextEncoder().encode(`${email_user}:${password}`)))

    const res = await fetch(SIGNIN_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`
        }
    })

    if (!res.ok) {
        throw new Error('Invalid username/email or password')
    }

    const token = await res.json()
    localStorage.setItem('jwt', token)
    showProfile()
    loadProfile()
}

function showProfile() {
    document.getElementById('login-section').hidden = true
    document.getElementById('profile-section').hidden = false
}

function Logout() {
    localStorage.removeItem('jwt')
    window.location.reload()
}

// there is a token, so show the profile.
// if it turns out to be expired or broken the first query logs us back out
if (localStorage.getItem('jwt')) {
    showProfile()
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    document.getElementById('error-msg').textContent = ''
    try {
        await Login()
    } catch (err) {
        document.getElementById('error-msg').textContent = err.message
    }
})

document.getElementById('logout-btn').addEventListener('click', Logout)
