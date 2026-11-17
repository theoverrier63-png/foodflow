#!/usr/bin/env node
// Compatibility shim: the platform supervisor launches `yarn expo start --port 3000`.
// This project is now a pure Vite web app, so we ignore the Expo arguments and
// start the Vite dev server on port 3000 instead.
const { spawn } = require("child_process");
const path = require("path");

const viteBin = path.join(__dirname, "..", "node_modules", ".bin", "vite");
const child = spawn(viteBin, ["--host", "0.0.0.0", "--port", "3000", "--strictPort"], {
  stdio: "inherit",
  cwd: path.join(__dirname, ".."),
});

const forward = (sig) => () => child.kill(sig);
["SIGINT", "SIGTERM", "SIGHUP"].forEach((s) => process.on(s, forward(s)));
child.on("exit", (code) => process.exit(code ?? 0));
