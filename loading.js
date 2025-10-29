//const frames = ['|', '/', '-', '\\'];
const frames = ["⠙", "⠘", "⠰", "⠴", "⠤", "⠦", "⠆", "⠃", "⠋", "⠉"];
let i = 0;
let intervalId;

function startLoading(message = "Loading...") {
  intervalId = setInterval(() => {
    process.stdout.clearLine(0); // Clear the current line
    process.stdout.cursorTo(0); // Move cursor to the beginning of the line
    process.stdout.write(`${frames[i++ % frames.length]} ${message} `);
  }, 100); // Update every 100ms
}

function stopLoading() {
  clearInterval(intervalId);
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
}

module.exports = {
    startLoading,
    stopLoading
}