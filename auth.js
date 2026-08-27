const SIGNIN_URL = 'https://learn.zone01oujda.ma/api/auth/signin'
const GRAPHQL_URL = 'https://learn.zone01oujda.ma/api/graphql-engine/v1/graphql'

// btoa() only accepts latin1, so encode to UTF-8 bytes first
function toBase64(str) {
    const bytes = new TextEncoder().encode(str)
    let binary = ''
    bytes.forEach(b => binary += String.fromCharCode(b))
    return btoa(binary)
}

// a jwt is base64URL, not base64
function fromBase64Url(part) {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
}

// ask the jwt with username/email and password
async function Login() {
    const email_user = document.getElementById('identifier').value.trim()
    const password = document.getElementById('password').value

    if (!email_user || !password) {
        throw new Error('Please fill in both fields')
    }

    const res = await fetch(SIGNIN_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${toBase64(`${email_user}:${password}`)}`
        }
    })

    const body = await res.json().catch(() => null)

    if (!res.ok) {
        throw new Error((body && body.error) || 'Invalid username/email or password')
    }

    const token = typeof body === 'string' ? body : body && (body.token || body.jwt)
    if (!token) throw new Error('No token returned by the server')

    localStorage.setItem('jwt', token)
    showProfile()
    loadProfile()
}

// the middle part of the jwt holds the user id and the expiry date
function getTokenPayload() {
    const token = localStorage.getItem('jwt')
    const parts = (token || '').split('.')
    if (parts.length !== 3) throw new Error('malformed token')
    return JSON.parse(fromBase64Url(parts[1]))
}

function getUserIdFromToken() {
    const payload = getTokenPayload()
    const claims = payload['https://hasura.io/jwt/claims'] || {}
    const id = Number(payload.sub ?? claims['x-hasura-user-id'])
    if (!Number.isFinite(id)) throw new Error('no user id in the token')
    return id
}

function showProfile() {
    document.getElementById('login-section').style.display = 'none'
    document.getElementById('profile-section').style.display = 'block'
}

let loggingOut = false
function Logout() {
    if (loggingOut) return
    loggingOut = true
    localStorage.removeItem('jwt')
    window.location.reload()
}

// already logged in, log out if the jwt is invalid or expired
if (localStorage.getItem('jwt')) {
    try {
        if (getTokenPayload().exp * 1000 < Date.now()) throw new Error('expired')
        getUserIdFromToken()
        showProfile()
    } catch {
        Logout()
    }
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const error = document.getElementById('error-msg')
    const button = document.getElementById('login-btn')
    error.textContent = ''
    button.disabled = true
    try {
        await Login()
    } catch (err) {
        error.textContent = err.message
    } finally {
        button.disabled = false
    }
})

document.getElementById('logout-btn').addEventListener('click', Logout)
