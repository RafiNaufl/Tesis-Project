require('@testing-library/jest-dom');

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!global.ResizeObserver) {
  global.ResizeObserver = ResizeObserver;
}

if (!global.matchMedia) {
  global.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function() {};
}
