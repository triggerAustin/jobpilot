export class JobSource {
  id = "base";
  async fetchJobs() {
    throw new Error("not implemented");
  }
}

const TRACKING_PARAMS = /^(utm_|ref$|source$|fbclid$|gclid$)/i;

export function stripTracking(rawUrl) {
  try {
    const u = new URL(rawUrl);
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    u.hash = "";
    return u.toString();
  } catch {
    return rawUrl;
  }
}

const NAMED_ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s = "") {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, e) => {
    if (e[0] === "#") {
      const code =
        e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? match;
  });
}

// Repairs UTF-8 text that was decoded as Latin-1 (e.g. "PerÃº" -> "Perú").
export function fixMojibake(s = "") {
  if (!/[\u00C2-\u00F4][\u0080-\u00BF]/.test(s)) return s;
  if (/[^\u0000-\u00FF]/.test(s)) return s;
  const fixed = Buffer.from(s, "latin1").toString("utf8");
  return fixed.includes("\uFFFD") ? s : fixed;
}

export function stripHtml(html = "") {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

const clean = (s = "") => decodeEntities(fixMojibake(s)).replace(/\s+/g, " ").trim();

// Returns null when a required field is missing.
export function normalizeJob(raw) {
  if (!raw?.title || !raw?.company || !raw?.url) return null;
  return {
    source: raw.source,
    externalId: raw.externalId ?? null,
    title: clean(raw.title),
    company: clean(raw.company),
    url: stripTracking(raw.url),
    description: stripHtml(fixMojibake(raw.description ?? "")),
    location: clean(raw.location ?? ""),
    remoteWorldwide: Boolean(raw.remoteWorldwide),
    salaryMin: raw.salaryMin ?? null,
    salaryMax: raw.salaryMax ?? null,
    salaryCurrency: raw.salaryCurrency ?? null,
    salaryPeriod: raw.salaryPeriod ?? null,
    postedAt: raw.postedAt ?? null
  };
}
