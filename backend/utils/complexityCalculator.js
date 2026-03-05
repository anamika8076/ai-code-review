exports.calculateComplexity = (code) => {
  const patterns = [
    /if/g,
    /else if/g,
    /for/g,
    /while/g,
    /switch/g,
    /case/g,
    /\?/g,
    /&&/g,
    /\|\|/g,
    /catch/g
  ];

  let complexity = 1;

  patterns.forEach(pattern => {
    complexity += (code.match(pattern) || []).length;
  });

  return complexity;
};