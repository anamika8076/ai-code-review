const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

const execFileAsync = promisify(execFile);

// ✅ Check karo ki given path valid Node.js project hai
function isValidProjectPath(projectPath) {
  try {
    const packageJsonPath = path.join(projectPath, "package.json");
    return fs.existsSync(packageJsonPath);
  } catch {
    return false;
  }
}

/**
 * Run npm audit on a given project directory
 * @param {string} projectPath - Absolute path to the user's project root
 * @returns {Promise<Array>} - List of vulnerable packages
 */
async function runAudit(projectPath) {

  // ✅ Fallback to cwd if no path given
  const targetPath = projectPath || process.cwd();

  // ✅ Validate path before running
  if (!isValidProjectPath(targetPath)) {
    console.warn("[AuditAnalyzer] No package.json found at:", targetPath);
    return [{ error: "No package.json found. Not a Node.js project." }];
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "npm",
      ["audit", "--json"],
      {
        cwd: targetPath,        // ✅ User ke project directory mein run hoga
        timeout: 20000,         // ✅ 20s timeout — hang nahi karega
        maxBuffer: 1024 * 1024  // ✅ 1MB buffer — large audit output handle karega
      }
    );

    if (stderr) {
      console.warn("[AuditAnalyzer] stderr:", stderr);
    }

    const data = JSON.parse(stdout);
    const vulnerabilities = data.vulnerabilities || {};

    if (Object.keys(vulnerabilities).length === 0) {
      return []; // ✅ No vulnerabilities found
    }

    // ✅ Structured output with more detail
    return Object.keys(vulnerabilities).map(name => {
      const vuln = vulnerabilities[name];
      return {
        name,
        severity: vuln.severity,                  // critical / high / moderate / low
        range: vuln.range || "unknown",           // affected version range
        fixAvailable: vuln.fixAvailable || false  // kya fix available hai
      };
    });

  } catch (err) {

    // ✅ npm audit exits with code 1 when vulnerabilities found — that's normal
    // stdout still has valid JSON in that case
    if (err.stdout) {
      try {
        const data = JSON.parse(err.stdout);
        const vulnerabilities = data.vulnerabilities || {};

        return Object.keys(vulnerabilities).map(name => {
          const vuln = vulnerabilities[name];
          return {
            name,
            severity: vuln.severity,
            range: vuln.range || "unknown",
            fixAvailable: vuln.fixAvailable || false
          };
        });
      } catch (parseErr) {
        console.error("[AuditAnalyzer] JSON parse failed:", parseErr.message);
      }
    }

    // ✅ Real errors — npm not found, timeout, etc.
    console.error("[AuditAnalyzer] Audit failed:", err.message);

    if (err.code === "ETIMEDOUT") {
      return [{ error: "Audit timed out (20s). Try again later." }];
    }
    if (err.code === "ENOENT") {
      return [{ error: "npm not found. Make sure npm is installed." }];
    }

    return [{ error: `Audit failed: ${err.message}` }];
  }
}

module.exports = runAudit;