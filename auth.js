const SIGNIN_URL = 'https://learn.zone01oujda.ma/api/auth/signin'
const GRAPHQL_URL = 'https://learn.zone01oujda.ma/api/graphql-engine/v1/graphql'

// ask the jwt with username/email and password
async function Login() {
    const email_user = document.getElementById('identifier').value
    const password = document.getElementById('password').value

    const res = await fetch(SIGNIN_URL, {
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
    showProfile()
    loadProfile()
}

// the id of the user is inside the jwt
function getUserIdFromToken() {
    const token = localStorage.getItem('jwt')
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Number(payload.sub)
}

function showProfile() {
    document.getElementById('login-section').style.display = 'none'
    document.getElementById('profile-section').style.display = 'block'
}



function Logout() {
    localStorage.removeItem('jwt')
    window.location.reload()
}

// already logged in, log out if the jwt is invalid or expired
const token = localStorage.getItem('jwt')
if (token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.exp * 1000 < Date.now()) throw new Error('expired')
        showProfile()
    } catch {
        Logout()
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
        await Login()
    } catch (err) {
        document.getElementById('error-msg').textContent = err.message
    }
})

document.getElementById('logout-btn').addEventListener('click', Logout)
