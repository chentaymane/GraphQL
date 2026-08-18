function drawPassFailGraph(passed, failed) {
    const maxValue = Math.max(passed, failed);
    const canvasHeight = 150;

    const passedHeight = (passed / maxValue) * canvasHeight;
    const failedHeight = (failed / maxValue) * canvasHeight;

    const passedY = canvasHeight - passedHeight;
    const failedY = canvasHeight - failedHeight;

    const svg = document.getElementById('passfail-graph');

    svg.innerHTML = `
        <rect x="30" y="${passedY}" width="50" height="${passedHeight}" fill="green" />
        <rect x="100" y="${failedY}" width="50" height="${failedHeight}" fill="red" />
    `;
}
function calculateCumulative(transactions) {
    let total = 0;
    const cumulative = [];
    for (const t of transactions) {
        total = total + t.amount;
        cumulative.push(total);
    }
    return cumulative;
}
function drawXpOverTimeGraph(cumulative) {
    const svg = document.getElementById('xp-graph');
    const width = 300;
    const height = 150;
    const maxValue = Math.max(...cumulative);

    const points = cumulative.map((value, index) => {
        const x = (index / (cumulative.length - 1)) * width;
        const y = height - (value / maxValue) * height;
        return `${x},${y}`;
    }).join(' ');

    svg.innerHTML = `<polyline points="${points}" fill="none" stroke="#667eea" stroke-width="2" />`;
}