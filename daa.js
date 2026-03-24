const stepLog = document.querySelector(".step-log");

function updateVisualization() {
  visualBox.innerHTML = `<p>${steps[currentStep]}</p>`;
  stepLog.innerText = `Current Step: ${steps[currentStep]}`;
}