// send a query to the graphql endpoint, the jwt goes in as Bearer.
// the server is the one that judges the token, so anything it refuses
// means the token is gone, forged or expired: log out and start over
async function queryGraphQL(query) {
  const token = localStorage.getItem('jwt')
  if (!token) {
    Logout()
    throw new Error('Not logged in')
  }

  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query })
  })

  if (!response.ok) {
    Logout()
    throw new Error('Session expired, please log in again')
  }

  const result = await response.json()
  if (result.errors) {
    Logout()
    throw new Error(result.errors[0].message)
  }

  return result.data
}

// 1000 xp -> 1 kB, written the way the platform writes it:
// MB keeps two cut decimals, kB is a whole number: 3.69 MB, 665 kB, 250 B
function formatXP(xp) {
  if (xp >= 1000000) return cutMB(xp) + ' MB'
  if (xp >= 1000) return Math.round(xp / 1000) + ' kB'
  return Math.round(xp) + ' B'
}

// two decimals, CUT and not rounded, no trailing zeros:
// 3 699 000 is 3.69 MB, never 3.7 MB
function cutMB(xp) {
  return String(Math.floor(xp / 10000) / 100)
}

function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function setText(id, value) {
  const node = document.getElementById(id)
  if (node) node.textContent = value
}

// ------------------------------------------------------------------------
//  QUERIES

// user identification.
// NORMAL query: no arguments, the jwt already limits the rows to its owner
async function getUserInfo() {
  const query = `
  {
    user {
      id
      login
      firstName
      lastName
      email
      campus
      createdAt
    }
  }
  `
  try {
    const data = await queryGraphQL(query)
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
  } catch (err) {
    console.error('Failed to load user info:', err)
  }
}

// module level.
// query with ARGUMENTS: filtered by type and event, highest first
async function getLevel() {
  const query = `
  {
    transaction(
      where: {
        type: { _eq: "level" }
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
    const data = await queryGraphQL(query)
    setText('level', data.transaction.length ? data.transaction[0].amount : '-')
  } catch (err) {
    console.error('Failed to load level:', err)
  }
}

// total xp.
// query with ARGUMENTS, ordered by date
async function getXp() {
  const query = `
  {
    transaction(
      where: {
        type: { _eq: "xp" }
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
    const transactions = (await queryGraphQL(query)).transaction
    const total = transactions.reduce((sum, t) => sum + t.amount, 0)

    setText('xp', formatXP(total))
  } catch (err) {
    console.error('Failed to load XP:', err)
  }
}

// projects: success rate and the pass/fail graph.
// NESTED query: each progress row also brings its object
async function getProjects() {
  const query = `
  {
    progress(
      where: {
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
    const rows = (await queryGraphQL(query)).progress
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

// audit ratio: xp given over xp received.
// the user row already holds the totals the platform itself shows,
// the two aliased aggregates in the same query are the fallback
async function getAuditRatio() {
  const query = `
  {
    user {
      auditRatio
      totalUp
      totalDown
    }
    up: transaction_aggregate(where: { type: { _eq: "up" } }) {
      aggregate { sum { amount } }
    }
    down: transaction_aggregate(where: { type: { _eq: "down" } }) {
      aggregate { sum { amount } }
    }
  }
  `
  try {
    const data = await queryGraphQL(query)
    const me = data.user[0] || {}

    // prefer the platform totals so the page shows the same MB as the profile,
    // ?? and not ||, a real total of 0 must not fall back to the aggregate
    const up = me.totalUp ?? data.up.aggregate.sum.amount ?? 0
    const down = me.totalDown ?? data.down.aggregate.sum.amount ?? 0
    const ratio = me.auditRatio ?? (down ? up / down : null)

    setText('audit', ratio === null ? '-' : ratio.toFixed(1))
    drawAuditGraph(up, down)
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
