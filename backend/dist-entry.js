const fs = require("fs");
const path = require("path");

const candidates = [
  path.join(__dirname, "dist", "src", "main.js"),
  path.join(__dirname, "dist", "main.js"),
];

const target = candidates.find((p) => fs.existsSync(p));

if (!target) {
  console.error("Could not find NestJS entrypoint. Searched locations:", candidates);
  process.exit(1);
}

require(target);
