//  HELPERS 

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

  // a dead token answers 401 with an html body, so never assume json
  const result = await response.json().catch(() => null)

  // hasura says "JWTExpired" / "Could not verify JWT" instead of a 401
  const message = result && result.errors && result.errors[0].message
  if (response.status === 401 || (message && /jwt/i.test(message))) {
    Logout()
    throw new Error('Session expired, please log in again')
  }

  if (!response.ok || !result) throw new Error(`Request failed (${response.status})`)
  // throw, never return Logout() : the callers read .data off what comes back
  if (message) throw new Error(message)

  return result.data
}

// every query is scoped to the logged in user : the endpoint also exposes the
// other students rows, so without this the totals are the whole campus
function userId() {
  return getUserIdFromToken()
}

// 1000 xp -> 1 kB (665 kB, but 1.62 MB : kB is rounded, MB keeps 2 decimals)
function formatXP(xp) {
  if (xp >= 1000000) return (xp / 1000000).toFixed(2) + ' MB'
  if (xp >= 1000) return Math.round(xp / 1000) + ' kB'
  return xp + ' B'
}

// 2021-07-26... -> 26 Jul 2021
function formatDate(date) {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// put a text inside an element
function setText(id, value) {
  const node = document.getElementById(id)
  if (node) node.textContent = value
}

// a name coming from the api must never be trusted inside innerHTML
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// keep the best amount of each name, biggest first
// a Map is used on purpose : a plain object reorders keys that look like
// numbers, which would shuffle the bars of a project named "01" or "2048"
function bestByName(rows, nameOf) {
  const best = new Map()
  for (const row of rows) {
    const name = nameOf(row)
    // `!best[name]` used to drop a real 0, so test the key itself
    if (!best.has(name) || row.amount > best.get(name)) best.set(name, row.amount)
  }
  return [...best].map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
}

// a user with no avatar (or a dead avatar url) used to render as a broken
// image showing its alt text, so fall back to the initials drawn as an svg
function initialsAvatar(name, login) {
  const source = (name || login || '?').trim()
  const initials = source.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" fill="#272c18"/>` +
    `<text x="48" y="63" text-anchor="middle" font-family="Inter, sans-serif"` +
    ` font-size="38" font-weight="700" fill="#d9e021">${escapeHtml(initials)}</text></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// one "name ..... value" line with its bar, used by the skills
function barRow(name, value, percent) {
  return `
    <div class="row">
      <span class="name">${escapeHtml(name)}</span>
      <span class="value">${value}</span>
    </div>
    <div class="track"><span style="width:${percent}%"></span></div>
  `
}

// ------------------------------------------------------------------------------------
//  QUERIES 

// user identification and avatar (normal query)
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
    const avatar = document.getElementById('avatar')
    const fallback = initialsAvatar(name, user.login)
    avatar.onerror = () => { avatar.onerror = null; avatar.src = fallback }
    avatar.src = user.avatarUrl || fallback
  } catch (err) {
    console.error('Failed to load user info:', err)
  }
}

// module level (query with a variable, the id comes from the jwt)
// scoped to the Module event like the XP, otherwise a piscine level
// transaction can win the `order_by amount desc` and show the wrong number
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
// the total is summed from the same rows the graph draws, so the number on the
// card and the last point of the curve can never disagree
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
    setText('xp-raw', `${total} XP in ${transactions.length} transactions`)
    drawXpOverTimeGraph(cumulative, transactions)
  } catch (err) {
    console.error('Failed to load XP:', err)
  }
}

// projects : success rate, the pass/fail graph and the recent activity
// progress has one row per attempt : an unfinished attempt has a null grade and
// is not a failure, and only the newest row of a project decides pass/fail,
// otherwise a retry you eventually passed still counts as a fail
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
      updatedAt
      object {
        id
        name
      }
    }
  }
  `
  const list = document.getElementById('recent')
  try {
    const rows = (await queryGraphQL(query, { userId: userId() })).progress

    // a project still in progress has no grade yet, it is neither pass nor fail
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
    setText('passfail', `${passed} passed / ${failed} failed`)
    drawPassFailGraph(passed, failed)

    // the activity feed shows every graded attempt, newest first
    list.innerHTML = graded.slice(0, 10).map(p => {
      const pass = p.grade >= 1
      return `
        <li class="activity">
          <span class="badge ${pass ? 'pass' : 'fail'}">${pass ? 'PASS' : 'FAIL'}</span>
          <span class="name">${escapeHtml(p.object.name)}</span>
          <span class="muted small">${formatDate(p.updatedAt)}</span>
        </li>
      `
    }).join('') || '<li class="muted small">No activity yet</li>'
  } catch (err) {
    list.innerHTML = '<li class="muted small">No activity yet</li>'
    console.error('Failed to load projects:', err)
  }
}

// audit ratio : xp given (up) over xp received (down)
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
    const diff = up - down

    // one decimal, like the platform : 1.37 shows as 1.4
    setText('audit', ratio === null ? '-' : ratio.toFixed(1))
    // the platform shows the ratio then the difference, eg "1.7 + 12 kB"
    setText('audit-sub', `${diff >= 0 ? '+' : '-'} ${formatXP(Math.abs(diff))}`)
  } catch (err) {
    console.error('Failed to load audit ratio:', err)
  }
}

// skills, the type looks like skill_go, skill_js ...
async function getSkills() {
  const query = `
  query ($userId: Int!) {
    transaction(
      where: { type: { _like: "skill_%" }, userId: { _eq: $userId } }
      order_by: { amount: desc }
    ) {
      type
      amount
    }
  }
  `
  const box = document.getElementById('skills')
  try {
    const data = await queryGraphQL(query, { userId: userId() })

    const best = bestByName(data.transaction, t => t.type.replace('skill_', '')).slice(0, 8)

    if (!best.length) {
      box.innerHTML = '<p class="muted small">No skill yet</p>'
      return
    }

    box.innerHTML = best
      .map(s => `<div class="skill">${barRow(s.name, s.amount + '%', s.amount)}</div>`)
      .join('')
  } catch (err) {
    box.innerHTML = '<p class="muted small">No skill yet</p>'
    console.error('Failed to load skills:', err)
  }
}

// load everything
function loadProfile() {
  getUserInfo()
  getLevel()
  getXp()
  getProjects()
  getAuditRatio()
  getSkills()
}

if (localStorage.getItem('jwt')) {
  window.addEventListener('load', loadProfile)
}
