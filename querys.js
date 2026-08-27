// send a query to the graphql endpoint
async function queryGraphQL(query, variables = {}) {
  const token = localStorage.getItem('jwt')
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  })

  const result = await response.json().catch(() => null)
  const message = result && result.errors && result.errors[0].message

  if (response.status === 401 || (message && /jwt/i.test(message))) {
    Logout()
    throw new Error('Session expired, please log in again')
  }

  if (!response.ok || !result) throw new Error(`Request failed (${response.status})`)
  if (message) throw new Error(message)

  return result.data
}

function userId() {
  return getUserIdFromToken()
}

// 1000 xp -> 1 kB
function formatXP(xp) {
  if (xp >= 1000000) return (xp / 1000000).toFixed(2) + ' MB'
  if (xp >= 1000) return Math.round(xp / 1000) + ' kB'
  return xp + ' B'
}

function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function setText(id, value) {
  const node = document.getElementById(id)
  if (node) node.textContent = value
}

// initials right away, swapped for the real photo once (if) it loads
function setAvatar(name, avatarUrl) {
  const avatar = document.getElementById('avatar')
  avatar.style.backgroundImage = ''
  avatar.textContent = name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()

  if (!avatarUrl) return
  const img = new Image()
  img.onload = () => {
    avatar.style.backgroundImage = `url(${avatarUrl})`
    avatar.textContent = ''
  }
  img.src = avatarUrl
}

// ------------------------------------------------------------------------
//  QUERIES

// user identification and avatar
async function getUserInfo() {
  const query = `
  query ($userId: Int!) {
    user(where: { id: { _eq: $userId } }) {
      id
      login
      firstName
      lastName
      email
      campus
      createdAt
      avatarUrl
    }
  }
  `
  try {
    const data = await queryGraphQL(query, { userId: userId() })
    const user = data.user[0]
    if (!user) throw new Error('no user returned')

    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim()

    setText('login', user.login)
    setText('fullname', name)
    setText('info-id', user.id)
    setText('info-login', user.login)
    setText('info-name', name || '-')
    setText('info-email', user.email || '-')
    setText('info-campus', user.campus || '-')
    setText('info-since', formatDate(user.createdAt))

    setAvatar(name || user.login, user.avatarUrl)
  } catch (err) {
    console.error('Failed to load user info:', err)
  }
}

// module level, scoped to the Module event
async function getLevel() {
  const query = `
  query ($userId: Int!) {
    transaction(
      where: {
        type: { _eq: "level" }
        userId: { _eq: $userId }
        event: { object: { name: { _eq: "Module" } } }
      }
      order_by: { amount: desc }
      limit: 1
    ) {
      amount
    }
  }
  `
  try {
    const data = await queryGraphQL(query, { userId: userId() })
    setText('level', data.transaction.length ? data.transaction[0].amount : '-')
  } catch (err) {
    console.error('Failed to load level:', err)
  }
}

// total xp, and the xp graph
async function getXp() {
  const query = `
  query ($userId: Int!) {
    transaction(
      where: {
        type: { _eq: "xp" }
        userId: { _eq: $userId }
        event: { object: { name: { _eq: "Module" } } }
      }
      order_by: { createdAt: asc }
    ) {
      amount
      createdAt
    }
  }
  `
  try {
    const transactions = (await queryGraphQL(query, { userId: userId() })).transaction
    const cumulative = calculateCumulative(transactions)
    const total = cumulative.length ? cumulative[cumulative.length - 1] : 0

    setText('xp', formatXP(total))
    drawXpOverTimeGraph(cumulative, transactions)
  } catch (err) {
    console.error('Failed to load XP:', err)
  }
}

// projects: success rate and the pass/fail graph
async function getProjects() {
  const query = `
  query ($userId: Int!) {
    progress(
      where: {
        userId: { _eq: $userId }
        object: { type: { _eq: "project" } }
        event: { object: { name: { _eq: "Module" } } }
      }
      order_by: { updatedAt: desc }
    ) {
      grade
      object {
        id
      }
    }
  }
  `
  try {
    const rows = (await queryGraphQL(query, { userId: userId() })).progress
    const graded = rows.filter(p => p.grade !== null)

    const seen = new Set()
    let passed = 0
    let failed = 0
    for (const p of graded) {
      if (seen.has(p.object.id)) continue
      seen.add(p.object.id)
      if (p.grade >= 1) passed++
      else failed++
    }

    const total = passed + failed
    setText('success-rate', total ? ((passed / total) * 100).toFixed(1) + '%' : '-')
    drawPassFailGraph(passed, failed)
  } catch (err) {
    console.error('Failed to load projects:', err)
  }
}

// audit ratio: xp given over xp received
async function getAuditRatio() {
  const query = `
  query ($userId: Int!) {
    up: transaction_aggregate(where: { type: { _eq: "up" }, userId: { _eq: $userId } }) {
      aggregate { sum { amount } }
    }
    down: transaction_aggregate(where: { type: { _eq: "down" }, userId: { _eq: $userId } }) {
      aggregate { sum { amount } }
    }
  }
  `
  try {
    const data = await queryGraphQL(query, { userId: userId() })
    const up = data.up.aggregate.sum.amount || 0
    const down = data.down.aggregate.sum.amount || 0
    const ratio = down ? up / down : null
    setText('audit', ratio === null ? '-' : ratio.toFixed(1))
  } catch (err) {
    console.error('Failed to load audit ratio:', err)
  }
}

// load everything
function loadProfile() {
  getUserInfo()
  getLevel()
  getXp()
  getProjects()
  getAuditRatio()
}

if (localStorage.getItem('jwt')) {
  window.addEventListener('load', loadProfile)
}
