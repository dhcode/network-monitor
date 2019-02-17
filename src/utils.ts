export function timedLog(...args) {
  console.log(new Date().toISOString(), ...args);
}
