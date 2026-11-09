function credential(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is not configured.`);
  }
  return value.trim();
}

module.exports = { credential };
