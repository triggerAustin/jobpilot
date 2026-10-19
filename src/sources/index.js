import { RemotiveSource } from "./remotive.js";
import { RemoteOkSource } from "./remoteok.js";
import { JobicySource } from "./jobicy.js";
import { HimalayasSource } from "./himalayas.js";
import { WorkingNomadsSource } from "./workingnomads.js";
import { ArbeitnowSource } from "./arbeitnow.js";
import { WeWorkRemotelySource } from "./weworkremotely.js";
import { HackerNewsSource } from "./hackernews.js";
import { GreenhouseSource, LeverSource, AshbySource } from "./boards.js";

const REGISTRY = {
  remotive: RemotiveSource,
  remoteok: RemoteOkSource,
  jobicy: JobicySource,
  himalayas: HimalayasSource,
  workingnomads: WorkingNomadsSource,
  arbeitnow: ArbeitnowSource,
  weworkremotely: WeWorkRemotelySource,
  hackernews: HackerNewsSource,
  greenhouse: GreenhouseSource,
  lever: LeverSource,
  ashby: AshbySource
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
