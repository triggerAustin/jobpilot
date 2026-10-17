import { RemotiveSource } from "./remotive.js";
import { RemoteOkSource } from "./remoteok.js";

const REGISTRY = {
  remotive: RemotiveSource,
  remoteok: RemoteOkSource
};

export function buildAdapters(config) {
  return config.sources
    .filter((s) => s.enabled)
    .map((s) => {
      const Adapter = REGISTRY[s.id];
      if (!Adapter) throw new Error(`Unknown source: ${s.id}`);
      return new Adapter(s.options ?? {});
    });
}
