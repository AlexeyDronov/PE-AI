// jsdom has no ResizeObserver, which Radix primitives (Slider) construct on mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub;
