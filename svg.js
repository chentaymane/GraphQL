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