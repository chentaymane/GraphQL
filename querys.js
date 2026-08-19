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

  const result = await response.json()

  if (result.errors) {
    console.error('GraphQL errors:', result.errors)
    throw new Error(result.errors[0].message)
  }

  return result.data
}

// 1000 xp -> 1 kB
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
  document.getElementById(id).textContent = value
}

// user identification (normal query)
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
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim()

    setText('login', user.login)
    setText('fullname', name)
    setText('info-id', user.id)
    setText('info-login', user.login)
    setText('info-name', name || '-')
    setText('info-email', user.email || '-')
    setText('info-campus', user.campus || '-')
    setText('info-since', formatDate(user.createdAt))

    // first letter, used if the avatar does not load
    document.getElementById('avatar-fallback').textContent = (name || user.login)[0].toUpperCase()
  } catch (err) {
    console.error('Failed to load user info:', err)
  }
}

// avatar picture
async function getAvatar() {
  const query = `
  {
    user {
      avatarUrl
    }
  }
  `
  const img = document.getElementById('avatar')
  const fallback = document.getElementById('avatar-fallback')

  // show the letter if the picture is missing
  img.addEventListener('error', () => {
    img.style.display = 'none'
    fallback.style.display = 'flex'
  })

  try {
    const data = await queryGraphQL(query)
    img.src = data.user[0].avatarUrl
  } catch (err) {
    console.error('Failed to load avatar:', err)
  }
}

// total xp (query with arguments)
async function getXp() {
  const query = `
  {
    transaction_aggregate(where: { type: { _eq: "xp" } }) {
      aggregate {
        count
        sum { amount }
      }
    }
  }
  `
  try {
    const data = await queryGraphQL(query)
    const total = data.transaction_aggregate.aggregate.sum.amount
    const count = data.transaction_aggregate.aggregate.count

    setText('xp', formatXP(total))
    setText('xp-raw', `${total} XP in ${count} transactions`)
  } catch (err) {
    console.error('Failed to load XP:', err)
  }
}

// level (query with a variable, the id comes from the jwt)
async function getLevel() {
  const query = `
  query ($userId: Int!) {
    transaction(
      where: { type: { _eq: "level" }, userId: { _eq: $userId } }
      order_by: { amount: desc }
      limit: 1
    ) {
      amount
    }
  }
  `
  try {
    const data = await queryGraphQL(query, { userId: getUserIdFromToken() })
    setText('level', data.transaction.length ? data.transaction[0].amount : '-')
  } catch (err) {
    console.error('Failed to load level:', err)
  }
}

// projects passed and failed
async function getPassFail() {
  const query = `
  {
    passed: progress_aggregate(where: { grade: { _gte: 1 } }) {
      aggregate { count }
    }
    failed: progress_aggregate(where: { grade: { _lt: 1 } }) {
      aggregate { count }
    }
  }
  `
  try {
    const data = await queryGraphQL(query)
    const passed = data.passed.aggregate.count
    const failed = data.failed.aggregate.count
    const total = passed + failed

    setText('success-rate', total ? Math.round((passed / total) * 100) + '%' : '-')
    setText('passfail', `${passed} passed / ${failed} failed`)
    drawPassFailGraph(passed, failed)
  } catch (err) {
    console.error('Failed to load pass/fail:', err)
  }
}

// audits : xp given (up) and xp received (down)
async function getAuditRatio() {
  const query = `
  {
    up: transaction_aggregate(where: { type: { _eq: "up" } }) {
      aggregate { count sum { amount } }
    }
    down: transaction_aggregate(where: { type: { _eq: "down" } }) {
      aggregate { count sum { amount } }
    }
  }
  `
  try {
    const data = await queryGraphQL(query)
    const up = data.up.aggregate.sum.amount || 0
    const down = data.down.aggregate.sum.amount || 0
    const ratio = down ? (up / down).toFixed(2) : '-'

    setText('audit', ratio)
    setText('audit-sub', `${formatXP(up)} up / ${formatXP(down)} down`)
    setText('audit-up', formatXP(up))
    setText('audit-down', formatXP(down))
    setText('audit-up-count', data.up.aggregate.count)
    setText('audit-down-count', data.down.aggregate.count)

    // green part of the small bar
    const share = up + down ? (up / (up + down)) * 100 : 50
    document.getElementById('ratio-fill').style.width = share + '%'
    setText('audit-note', ratio >= 1 ? 'Good ratio, keep it up.' : 'Audit more projects to raise your ratio.')
  } catch (err) {
    console.error('Failed to load audit ratio:', err)
  }
}

// xp over time (graph 1)
async function getXpOverTime() {
  const query = `
  {
    transaction(where: { type: { _eq: "xp" } }, order_by: { createdAt: asc }) {
      amount
      createdAt
      path
    }
  }
  `
  try {
    const data = await queryGraphQL(query)
    const transactions = data.transaction
    const cumulative = calculateCumulative(transactions)

    drawXpOverTimeGraph(cumulative, transactions)
  } catch (err) {
    console.error('Failed to load XP over time:', err)
  }
}

// best projects (nested query : transaction -> object)
async function getTopProjects() {
  const query = `
  {
    transaction(
      where: { type: { _eq: "xp" }, object: { type: { _eq: "project" } } }
      order_by: { amount: desc }
      limit: 8
    ) {
      amount
      object {
        name
      }
    }
  }
  `
  const list = document.getElementById('top-projects')
  try {
    const data = await queryGraphQL(query)
    const max = data.transaction[0].amount

    list.innerHTML = data.transaction.map(t => `
      <li>
        <div class="row">
          <span class="name">${t.object.name}</span>
          <span class="value">${formatXP(t.amount)}</span>
        </div>
        <div class="track"><span style="width:${(t.amount / max) * 100}%"></span></div>
      </li>
    `).join('')
  } catch (err) {
    list.innerHTML = '<li class="muted small">No project yet</li>'
    console.error('Failed to load top projects:', err)
  }
}

// skills, the type looks like skill_go, skill_js ...
async function getSkills() {
  const query = `
  {
    transaction(where: { type: { _like: "skill_%" } }, order_by: { amount: desc }) {
      type
      amount
    }
  }
  `
  const box = document.getElementById('skills')
  try {
    const data = await queryGraphQL(query)
    const best = {}

    // the list is sorted, so the first value of a skill is the best one
    for (const t of data.transaction) {
      const name = t.type.replace('skill_', '')
      if (!best[name]) best[name] = t.amount
    }

    box.innerHTML = Object.keys(best).slice(0, 8).map(name => `
      <div class="skill">
        <div class="row">
          <span class="name">${name}</span>
          <span class="value">${best[name]}%</span>
        </div>
        <div class="track"><span style="width:${best[name]}%"></span></div>
      </div>
    `).join('')
  } catch (err) {
    box.innerHTML = '<p class="muted small">No skill yet</p>'
    console.error('Failed to load skills:', err)
  }
}

// last projects (nested query : progress -> object)
async function getRecentActivity() {
  const query = `
  {
    progress(
      where: { object: { type: { _eq: "project" } } }
      order_by: { updatedAt: desc }
      limit: 10
    ) {
      grade
      updatedAt
      object {
        name
      }
    }
  }
  `
  const list = document.getElementById('recent')
  try {
    const data = await queryGraphQL(query)

    list.innerHTML = data.progress.map(p => {
      const pass = p.grade >= 1
      return `
        <li class="activity">
          <span class="badge ${pass ? 'pass' : 'fail'}">${pass ? 'PASS' : 'FAIL'}</span>
          <span class="name">${p.object.name}</span>
          <span class="muted small">${formatDate(p.updatedAt)}</span>
        </li>
      `
    }).join('')
  } catch (err) {
    list.innerHTML = '<li class="muted small">No activity yet</li>'
    console.error('Failed to load recent activity:', err)
  }
}

// load everything
function loadProfile() {
  getUserInfo()
  getAvatar()
  getXp()
  getLevel()
  getPassFail()
  getAuditRatio()
  getXpOverTime()
  getTopProjects()
  getSkills()
  getRecentActivity()
}

if (localStorage.getItem('jwt')) {
  window.addEventListener('load', loadProfile)
}
