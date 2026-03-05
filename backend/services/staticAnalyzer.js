const securityPatterns = [
  { regex: /eval\(/g, message: "Avoid using eval() — security risk." },
  { regex: /innerHTML/g, message: "innerHTML can cause XSS vulnerabilities." },
  { regex: /process\.env\./g, message: "Be careful exposing environment variables." },
  { regex: /while\s*\(true\)/g, message: "Infinite loop detected." }
];

exports.scanSecurity = (code) => {
  const issues = [];

  securityPatterns.forEach(pattern => {
    if (pattern.regex.test(code)) {
      issues.push(pattern.message);
    }
  });

  return issues;
};