var isMeasuring = false;
var heartRateCanvas;
var heartRateContext;
var gsrCanvas;
var gsrContext;
var emgCanvas;
var emgContext;
var heartRateData = [];
var gsrData = [];
var emgData = [];
var animationFrameId;
var animationProgress = 0;
var animationDuration = 1000;

function toggleMeasurement() {
    var button = document.getElementById("measurementButton");
    if (!isMeasuring) {
        button.innerHTML = "Zatrzymaj pomiar";
        alert("Pomiar rozpocznie się za 2 minuty!");

        document.getElementById("heartRateCanvas").classList.remove("hidden");
        document.getElementById("gsrCanvas").classList.remove("hidden");
        document.getElementById("emgCanvas").classList.remove("hidden");

        measurementTimeout = setTimeout(async function () {
            alert("Rozpoczęto wczytywanie danych!");
            await loadCSVData();

            setTimeout(function () {
                alert("Pomiar rozpoczęty!");
                startAnimation();
            }, 1 * 60 * 1);

        }, 1 * 60 * 1);
    } else {
        button.innerHTML = "Rozpocznij pomiar";
        alert("Pomiar zatrzymany!");

        document.getElementById("heartRateCanvas").classList.add("hidden");
        document.getElementById("gsrCanvas").classList.add("hidden");
        document.getElementById("emgCanvas").classList.add("hidden");

        cancelAnimationFrame(animationFrameId);
    }

    isMeasuring = !isMeasuring;
}

async function startAnimation() {
    animationProgress = 0;
    function animate() {
        drawCharts();
        animationProgress += 1;
        animationFrameId = requestAnimationFrame(animate);
    }

    animate();
}


function adjustCanvasSize(canvas, context, data) {
    const maxWidth = window.innerWidth - 40; 
    const maxHeight = window.innerHeight - 40; 

    const canvasSize = calculateCanvasSize(data, 300); 
    const adjustedWidth = Math.min(canvasSize.width, maxWidth);
    const adjustedHeight = Math.min(canvasSize.height, maxHeight);

    setCanvasSize(canvas, adjustedWidth, adjustedHeight);

    drawCharts();
}

window.addEventListener('resize', function () {
    adjustCanvasSize(heartRateCanvas, heartRateContext, heartRateData);
    adjustCanvasSize(gsrCanvas, gsrContext, gsrData);
    adjustCanvasSize(emgCanvas, emgContext, emgData);
});

function calculateCanvasSize(data, minWidth) {
    var padding = 40;

    var maxDataValue = Math.max.apply(null, data);

    var canvasWidth = Math.max(data.length * 20, minWidth);
    var canvasHeight = Math.max(maxDataValue + padding+40, 300);

    return {
        width: canvasWidth + padding,
        height: canvasHeight + padding
    };
}

function setCanvasSize(canvas, width, height) {
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").canvas.width = width;
    canvas.getContext("2d").canvas.height = height;S
}

async function loadCSVData() {
    try {
        const response = await fetch('data.csv');
        const csvData = await response.text();
        processData(csvData);

        var heartRateCanvasSize = calculateCanvasSize(heartRateData, 300);
        setCanvasSize(heartRateCanvas, heartRateCanvasSize.width, heartRateCanvasSize.height);

        var gsrCanvasSize = calculateCanvasSize(gsrData, 300);
        setCanvasSize(gsrCanvas, gsrCanvasSize.width, gsrCanvasSize.height);

        var emgCanvasSize = calculateCanvasSize(emgData, 300);
        setCanvasSize(emgCanvas, emgCanvasSize.width, emgCanvasSize.height);

        drawCharts();
    } catch (error) {
        console.error('Error fetching CSV data:', error);
    }
}

function processData(csvData) {
    var rows = csvData.trim().split('\n');

    heartRateData = [];
    gsrData = [];
    emgData = [];

    rows.forEach(function (row) {
        var columns = row.split(',');
        gsrData.push(parseInt(columns[0]));
        emgData.push(parseInt(columns[1]));
        heartRateData.push(parseInt(columns[2]));
    });

    console.log("Parsed CSV Data:");
    console.log("Heart Rate Data:", heartRateData);
    console.log("GSR Data:", gsrData);
    console.log("EMG Data:", emgData);
}

function drawCharts() {
    console.log("Drawing Charts...");

    gsrContext.clearRect(0, 0, gsrCanvas.width, gsrCanvas.height);
    drawGSRChart();

    emgContext.clearRect(0, 0, emgCanvas.width, emgCanvas.height);
    drawEMGChart();

    heartRateContext.clearRect(0, 0, heartRateCanvas.width, heartRateCanvas.height);
    drawHeartRateChart();
}

function drawHeartRateChart() {
    console.log("Animating Heart Rate");
    heartRateContext.clearRect(0, 0, heartRateCanvas.width, heartRateCanvas.height);

    var yMin = Math.min(...heartRateData);
    var yMax = Math.max(...heartRateData);
    var yScale = (heartRateCanvas.height - 40) / (yMax - yMin);

    heartRateContext.beginPath();
    heartRateContext.moveTo(20, heartRateCanvas.height - 20);
    heartRateContext.lineTo(20, 20);
    heartRateContext.stroke();

    heartRateContext.beginPath();
    heartRateContext.moveTo(20, heartRateCanvas.height - 20);
    heartRateContext.lineTo(heartRateCanvas.width - 20, heartRateCanvas.height - 20);
    heartRateContext.stroke();

    heartRateContext.beginPath();
    heartRateContext.strokeStyle = "#e74c3c"; // Red color
    heartRateContext.lineWidth = 2;

    var pointsToDraw = Math.floor((animationProgress / animationDuration) * heartRateData.length);
    pointsToDraw = Math.min(pointsToDraw, heartRateData.length);

    heartRateData.slice(0, pointsToDraw).forEach(function (point, index) {
        var xPos = 20 + index * ((heartRateCanvas.width - 40) / (heartRateData.length - 1));
        var yPos = heartRateCanvas.height - 20 - (point - yMin) * yScale;

        if (index === 0) {
            heartRateContext.moveTo(xPos, yPos);
        } else {
            heartRateContext.lineTo(xPos, yPos);
        }

        heartRateContext.arc(xPos, yPos, 3, 0, 2 * Math.PI);
    });

    heartRateContext.stroke();
}


function drawEMGChart() {
    console.log("Animating EMG");
    emgContext.clearRect(0, 0, emgCanvas.width, emgCanvas.height);

    var yMin = 0;
    var yMax = 100;
    var yScale = (emgCanvas.height - 40) / (yMax - yMin);

    emgContext.fillStyle = "#2ecc71"; // Green color

    var barWidth = 50;
    var xPos = (emgCanvas.width - barWidth) / 2;

    var currentIndex = Math.floor((animationProgress / animationDuration) * emgData.length);
    currentIndex = Math.min(currentIndex, emgData.length - 1);

    var originalValue = emgData[currentIndex];

    var barHeight = originalValue * yScale;
    var yPos = emgCanvas.height - 20 - barHeight;
    emgContext.fillRect(xPos, yPos, barWidth, barHeight);
}

function drawGSRChart() {
    console.log("Animating GSR");
    gsrContext.clearRect(0, 0, gsrCanvas.width, gsrCanvas.height);

    var yMin = Math.min(...gsrData);
    var yMax = Math.max(...gsrData);
    var yScale = (gsrCanvas.height - 40) / (yMax - yMin);

    gsrContext.beginPath();
    gsrContext.moveTo(20, gsrCanvas.height - 20);
    gsrContext.lineTo(20, 20);
    gsrContext.stroke();

    gsrContext.beginPath();
    gsrContext.moveTo(20, gsrCanvas.height - 20);
    gsrContext.lineTo(gsrCanvas.width - 20, gsrCanvas.height - 20);
    gsrContext.stroke();

    gsrContext.beginPath();
    gsrContext.strokeStyle = "#3498db"; // Blue color
    gsrContext.lineWidth = 2;

    var pointsToDraw = Math.floor((animationProgress / animationDuration) * gsrData.length);
    pointsToDraw = Math.min(pointsToDraw, gsrData.length);

    gsrData.slice(0, pointsToDraw).forEach(function (point, index) {
        var xPos = 20 + index * ((gsrCanvas.width - 40) / (gsrData.length - 1));
        var yPos = gsrCanvas.height - 20 - (point - yMin) * yScale;

        if (index === 0) {
            gsrContext.moveTo(xPos, yPos);
        } else {
            gsrContext.lineTo(xPos, yPos);
        }

        gsrContext.arc(xPos, yPos, 3, 0, 2 * Math.PI);
    });

    gsrContext.stroke();
}

window.onload = function () {
    heartRateCanvas = document.getElementById("heartRateCanvas");
    gsrCanvas = document.getElementById("gsrCanvas");
    emgCanvas = document.getElementById("emgCanvas");

    heartRateContext = heartRateCanvas.getContext("2d");
    gsrContext = gsrCanvas.getContext("2d");
    emgContext = emgCanvas.getContext("2d");

    adjustCanvasSize(heartRateCanvas, heartRateContext, heartRateData);
    adjustCanvasSize(gsrCanvas, gsrContext, gsrData);
    adjustCanvasSize(emgCanvas, emgContext, emgData);
};
