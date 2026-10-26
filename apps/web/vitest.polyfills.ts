// jsdom has no ResizeObserver, which Radix primitives (Slider) construct on mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub;

// jsdom's Blob/File can't be serialised by Node's fetch (multipart uploads hang); use Node's own.
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";

globalThis.Blob = NodeBlob as unknown as typeof Blob;
globalThis.File = NodeFile as unknown as typeof File;

// ...and Node's FormData, recovered from a Response (jsdom's FormData stringifies Node Files).
globalThis.FormData = (await new Response("", { headers: { "content-type": "application/x-www-form-urlencoded" } }).formData()).constructor as typeof FormData;
