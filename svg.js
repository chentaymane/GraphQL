// the colors live in style.css, the markup only carries class names

// graph 1: projects pass / fail, one ring, the pass slice drawn over the fail one
function drawPassFailGraph(passed, failed) {
    const svg = document.getElementById('passfail-graph')
    const total = passed + failed

    if (!total) {
        svg.innerHTML = `<text class="empty" x="100" y="75" text-anchor="middle">No projects yet</text>`
        return
    }

    const r = 50
    const around = 2 * Math.PI * r                  // the whole ring
    const passLength = (passed / total) * around    // the part of it that passed

    svg.innerHTML = `
        <circle class="ring fail" cx="100" cy="70" r="${r}" />
        <circle class="ring pass" cx="100" cy="70" r="${r}"
                stroke-dasharray="${passLength} ${around}"
                transform="rotate(-90 100 70)" />

        <text class="ring-value" x="100" y="70" text-anchor="middle">${Math.round((passed / total) * 100)}%</text>
        <text class="ring-sub" x="100" y="86" text-anchor="middle">PASS</text>

        <text class="bar-value pass" x="58" y="150" text-anchor="middle">${passed} PASS</text>
        <text class="bar-value fail" x="142" y="150" text-anchor="middle">${failed} FAIL</text>
    `
}

// graph 2: audit ratio, two bars growing from left to right
function drawAuditGraph(up, down) {
    const svg = document.getElementById('audit-graph')
    const left = 90              // the labels sit in the space before the bars
    const maxBar = 380
    const max = Math.max(up, down, 1)

    function bar(y, value, label, kind) {
        const width = (value / max) * maxBar
        return `
          <text class="bar-label" x="${left - 12}" y="${y + 24}" text-anchor="end">${label}</text>
          <rect class="bar ${kind}" x="${left}" y="${y}" width="${width}" height="34" rx="4" />
          <text class="bar-value ${kind}" x="${left + width + 10}" y="${y + 24}">${formatXP(value)}</text>
        `
    }

    svg.innerHTML = `
        ${bar(16, up, 'DONE', 'up')}
        ${bar(70, down, 'RECEIVED', 'down')}
    `
}
