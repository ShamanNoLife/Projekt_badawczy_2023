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
                alert("Animacja rozpoczęta!");
                startAnimation();
            }, 1 * 1 * 1000);

        }, 1 * 60 * 1000);
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
        if (animationProgress >= animationDuration) {
            animationProgress = 0;
        }
        animationFrameId = requestAnimationFrame(animate);
    }

    animate();
}


function adjustCanvasSize(canvas, context, data) {
    const maxHeight = window.innerHeight - 40;

    const canvasSize = calculateCanvasSize(data, 300);
    const adjustedHeight = Math.min(canvasSize.height, maxHeight);

    setCanvasSize(canvas, adjustedHeight);

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

function setCanvasSize(canvas, height) {
    const width = 1200;
    canvas.width = width;
    canvas.height = height;
}

async function loadCSVData() {
    try {
        const response = await fetch('data.csv');
        const csvData = await response.text();
        processData(csvData);

        var heartRateCanvasSize = calculateCanvasSize(heartRateData, 100);
        setCanvasSize(heartRateCanvas, heartRateCanvasSize.width, heartRateCanvasSize.height);

        var gsrCanvasSize = calculateCanvasSize(gsrData, 100);
        setCanvasSize(gsrCanvas, gsrCanvasSize.width, gsrCanvasSize.height);

        var emgCanvasSize = calculateCanvasSize(emgData, 100);
        setCanvasSize(emgCanvas, emgCanvasSize.width, emgCanvasSize.height);

        drawCharts();
    } catch (error) {

    }
}

function processData(csvData) {
    var rows = csvData.trim().split('\n');

    heartRateData = [];
    gsrData = [];
    emgData = [];

    rows.forEach(function (row) {
        var columns = row.split(',');
        heartRateData.push(parseInt(columns[0]));
        emgData.push(parseInt(columns[1]));
        gsrData.push(parseInt(columns[2]));
    });
    console.log("Parsed CSV Data:");
    console.log("Heart Rate Data:", heartRateData);
    console.log("GSR Data:", gsrData);
    console.log("EMG Data:", emgData);
}

function drawCharts() {
    var yMaxHeartRate = Math.max(...heartRateData);
    var yMinHeartRate = Math.min(...heartRateData);
    var yMaxGSR = Math.max(...gsrData);
    var yMinGSR = Math.min(...gsrData);
    var yMaxEMG = Math.max(...emgData);
    var yMinEMG = Math.min(...emgData);

    heartRateContext.clearRect(0, 0, heartRateCanvas.width, heartRateCanvas.height);
    drawHeartRateChart();

    gsrContext.clearRect(0, 0, gsrCanvas.width, gsrCanvas.height);
    drawGSRChart();

    emgContext.clearRect(0, 0, emgCanvas.width, emgCanvas.height);
    drawEMGChart();

    drawAxisLabels(heartRateContext, heartRateCanvas, yMaxHeartRate, yMinHeartRate, false);
    drawAxisLabels(gsrContext, gsrCanvas, yMaxGSR, yMinGSR, false);
    drawAxisLabels(emgContext, emgCanvas, yMaxEMG, yMinEMG, false);
}

function drawAxisLabels(context, canvas, yMax, yMin, drawXLabels) {
    var yScale = (canvas.height - 40) / (yMax - yMin);
    var yAxisLabelInterval = (yMax - yMin) / 5; 

    context.font = "16px Arial";

    for (var i = 0; i <= 5; i++) {
        var label = Math.round(yMin + i * yAxisLabelInterval);
        var yPos = canvas.height - 20 - i * ((canvas.height - 40) / 5);
        context.fillText(label.toString(), 20, yPos);
    }

    if (drawXLabels) {
        for (var i = 0; i <= 5; i++) {
            var xPos = 20 + i * ((canvas.width - 40) / 5);
            context.fillText(i.toString(), xPos, canvas.height - 20);
        }
    }
}

function drawHeartRateChart() {
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
    if (pointsToDraw > heartRateData.length) {
        pointsToDraw = pointsToDraw % heartRateData.length;
    }

    heartRateData.slice(pointsToDraw).forEach(function (point, index) {
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

function drawGSRChart() {
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
    if (pointsToDraw > gsrData.length) {
        pointsToDraw = pointsToDraw % gsrData.length;
    }

    gsrData.slice(pointsToDraw).forEach(function (point, index) {
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

function drawEMGChart() {
    emgContext.clearRect(0, 0, emgCanvas.width, emgCanvas.height);

    var yMin = Math.min(...emgData);
    var yMax = Math.max(...emgData);
    var yScale = (emgCanvas.height - 40) / (yMax - yMin);

    var xOffset = (emgCanvas.width - 40) / (emgData.length - 1); 

    emgContext.beginPath();
    emgContext.moveTo(20, emgCanvas.height - 20);
    emgContext.lineTo(20, 20);
    emgContext.stroke();

    emgContext.beginPath();
    emgContext.moveTo(20, emgCanvas.height - 20);
    emgContext.lineTo(emgCanvas.width - 20, emgCanvas.height - 20);
    emgContext.stroke();

    emgContext.beginPath();
    emgContext.strokeStyle = "#00ff00"; // Green color 
    emgContext.lineWidth = 2;

    var pointsToDraw = Math.floor((animationProgress / animationDuration) * emgData.length);
    if (pointsToDraw > emgData.length) {
        pointsToDraw = pointsToDraw % emgData.length;
    }

    emgData.slice(pointsToDraw).forEach(function (point, index) {
        var xPos = 20 + index * xOffset;
        var yPos = emgCanvas.height - 20 - (point - yMin) * yScale;

        if (index === 0) {
            emgContext.moveTo(xPos, yPos);
        } else {
            emgContext.lineTo(xPos, yPos);
        }

        emgContext.arc(xPos, yPos, 3, 0, 2 * Math.PI);
    });

    emgContext.stroke();
}


function saveMeasurement() {
    var csvContent = "Heart Rate,EMG,GSR\n";

    for (var i = 0; i < heartRateData.length; i++) {
        csvContent += heartRateData[i] + "," + emgData[i] + "," + gsrData[i] + "\n";
    }

    var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    var link = document.createElement("a");
    var fileName = "sensor_data.csv";

    link.href = window.URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);
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
