const { execSync } = require("child_process");

function runAudit() {

    
  try {
    const result = execSync("npm audit --json").toString();
    const data = JSON.parse(result);

    return Object.keys(data.vulnerabilities || {}).map(vuln => ({
      name: vuln,
      severity: data.vulnerabilities[vuln].severity
    }));

  } catch (err) {
    return [{ error: "Audit failed" }];
  }
}

module.exports = runAudit;