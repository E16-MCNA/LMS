import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const LOG_FILE = "C:\\Users\\Admin\\.gemini\\antigravity\\scratch\\browser_logs.txt";

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWebSocketUrl() {
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch("http://127.0.0.1:9222/json/list");
      const list = await response.json();
      const page = list.find(item => item.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch (e) {
      // ignore
    }
    await delay(500);
  }
  throw new Error("Could not find chrome debugging page websocket URL");
}

async function main() {
  const outputLines = [];
  function log(msg) {
    console.log(msg);
    outputLines.push(msg);
  }

  log("Starting Chrome in headless mode...");
  const chrome = spawn(CHROME_PATH, [
    "--headless",
    "--disable-gpu",
    "--remote-debugging-port=9222",
    "http://localhost:3100"
  ]);

  try {
    const wsUrl = await getWebSocketUrl();
    log("Connected to Chrome via WebSocket: " + wsUrl);

    const ws = new WebSocket(wsUrl);

    let nextMsgId = 1;
    const pendingRequests = new Map();

    function sendCommand(method, params = {}) {
      const id = nextMsgId++;
      return new Promise((resolve, reject) => {
        pendingRequests.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    ws.onopen = async () => {
      await sendCommand("Console.enable");
      await sendCommand("Runtime.enable");
      log("Domains enabled. Listening for browser events...");
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pendingRequests.has(msg.id)) {
        const { resolve, reject } = pendingRequests.get(msg.id);
        pendingRequests.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method === "Runtime.exceptionThrown") {
        const details = msg.params.exceptionDetails;
        const text = details.exception ? details.exception.description : details.text;
        log("[BROWSER EXCEPTION] " + text);
      } else if (msg.method === "Console.messageAdded") {
        const details = msg.params.message;
        log(`[BROWSER CONSOLE ${details.level.toUpperCase()}] ${details.text}`);
      }
    };

    // Wait for page load
    await delay(5000);

    // Evaluate root innerHTML
    const evalResult = await sendCommand("Runtime.evaluate", {
      expression: "document.getElementById('root').innerHTML",
      returnByValue: true
    });

    log("\n--- ROOT INNER HTML ---");
    log(evalResult.result.value || "[EMPTY]");
    log("-----------------------\n");

    ws.close();
  } catch (err) {
    log("Test failed with error: " + err.message);
  } finally {
    log("Terminating Chrome...");
    chrome.kill();
    fs.writeFileSync(LOG_FILE, outputLines.join("\n"));
    console.log("Logs saved to " + LOG_FILE);
  }
}

main();
