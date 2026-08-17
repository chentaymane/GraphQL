async function queryGraphQL(query, variables = {}) {
  const token = localStorage.getItem('jwt')
  const response = await fetch('https://learn.zone01oujda.ma/api/graphql-engine/v1/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });

  const result = await response.json();

  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(result.errors[0].message);
  }

  return result.data;
}

async function getUserInfo() {
  const query = `
  {
    user {
      id
      login
    }
  }
  `;
  const loginEl = document.getElementById('login');
  try {
    const data = await queryGraphQL(query);
    loginEl.textContent = data.user[0].login;
  } catch (err) {
    console.error('Failed to load user info:', err);
  }
}

async function getAvatar() {
  const query = `
  {
    user {
      avatarUrl
    }
  }
  `;
  const img = document.getElementById('avatar');
  try {
    const data = await queryGraphQL(query);
    img.src = data.user[0].avatarUrl;
  } catch (err) {
    console.error('Failed to load avatar:', err);
  }
}

async function getXp() {
  const query = `
  {
    transaction_aggregate(where: { type: { _eq: "xp" } }) {
      aggregate {
        sum { amount }
      }
    }
  }
  `;
  const xp = document.getElementById('xp');
  try {
    const data = await queryGraphQL(query);
    xp.textContent = data.transaction_aggregate.aggregate.sum.amount;
  } catch (err) {
    console.error('Failed to load XP:', err);
  }
}

async function getPassFail() {
  const query = `
  {
    passed: progress_aggregate(where: { grade: { _eq: 1 } }) {
      aggregate { count }
    }
    failed: progress_aggregate(where: { grade: { _eq: 0 } }) {
      aggregate { count }
    }
  }
  `;
  const passFailEl = document.getElementById('passfail');
  try {
    const data = await queryGraphQL(query);
    const passed = data.passed.aggregate.count;
    const failed = data.failed.aggregate.count;
    passFailEl.textContent = `Passed: ${passed} / Failed: ${failed}`;
  } catch (err) {
    console.error('Failed to load pass/fail:', err);
  }
}

async function getAuditRatio() {
  const query = `
  {
    up: transaction_aggregate(where: { type: { _eq: "up" } }) {
      aggregate { sum { amount } }
    }
    down: transaction_aggregate(where: { type: { _eq: "down" } }) {
      aggregate { sum { amount } }
    }
  }
  `;
  const auditEl = document.getElementById('audit');
  try {
    const data = await queryGraphQL(query);
    const up = data.up.aggregate.sum.amount || 0;
    const down = data.down.aggregate.sum.amount || 0;
    const ratio = down ? (up / down).toFixed(2) : 'N/A';
    auditEl.textContent = `Audit ratio: ${ratio}`;
  } catch (err) {
    console.error('Failed to load audit ratio:', err);
  }
}

function loadProfile() {
    getUserInfo();
    getAvatar();
    getXp();
    getPassFail();
    getAuditRatio();
}

if (localStorage.getItem('jwt')) {
    loadProfile();
}
