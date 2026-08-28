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

// the payload of the jwt, null when the token is missing, broken or expired
function getPayload() {
    try {
        const token = localStorage.getItem('jwt')
        // the middle part is the payload, in base64url
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        if (payload.exp * 1000 < Date.now()) return null
        return payload
    } catch {
        return null
    }
}

// the stored token, or null when it is not usable
function getValidToken() {
    return getPayload() ? localStorage.getItem('jwt') : null
}

// the id of the user is inside the jwt
function getUserIdFromToken() {
    const payload = getPayload()
    if (!payload) {
        Logout()
        throw new Error('Session expired, please log in again')
    }
    return Number(payload.sub)
}

function showProfile() {
    document.getElementById('login-section').hidden = true
    document.getElementById('profile-section').hidden = false
}

function Logout() {
    localStorage.removeItem('jwt')
    window.location.reload()
}

// already logged in, but the token can be broken or expired
if (localStorage.getItem('jwt')) {
    if (getValidToken()) showProfile()
    else Logout()
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
