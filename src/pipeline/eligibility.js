const US_ONLY =
  /\b(us citizens? only|must be (located|based|residing) in the (us|usa|united states)|us work authori[sz]ation required|authori[sz]ed to work in the (us|united states))\b/;
const ON_SITE = /\b(relocation required|must relocate|on-?site (only|required))\b/;
const SENIOR_TITLE =
  /\b(senior|sr|lead|principal|staff|head of|architect|manager|director|vp|vice president|chief)\b/i;
const ENTRY_TITLE = /\b(intern|internship|trainee|graduate|junior|jr|assistant|entry.level)\b/i;
export const SOFT_FLAGS = new Set(["location_check"]);
// Sources whose location field is an office city or free text, not a candidate restriction.
const SOFT_LOCATION_SOURCES = new Set(["remoteok", "hackernews", "greenhouse", "lever", "ashby"]);
const YEARS =
  /(\d+)\+?\s*years?\s+(of\s+)?(professional\s+|relevant\s+|commercial\s+|work\s+)?experience/g;

export function toMonthlyUsd(amount, currency, period) {
  if (amount == null || currency !== "USD") return null;
  if (period === "year") return amount / 12;
  if (period === "month") return amount;
  if (period === "hour") return amount * 160;
  return null;
}

export function checkEligibility(job, profile) {
  const flags = [];
  const text = (job.description ?? "").toLowerCase();

  if (US_ONLY.test(text) && !profile.workAuthorization.canWorkIn.includes("US")) {
    flags.push("requires_us_authorization");
  }

  // profile.localTerms lists places the candidate can commute to (optional).
  const place = (job.location ?? "").toLowerCase();
  const isLocal = Boolean(place) && (profile.localTerms ?? []).some((t) => place.includes(t));
  if (!job.remoteWorldwide && !isLocal && ON_SITE.test(text)) {
    flags.push("relocation_required");
  }

  if (job.location && !job.remoteWorldwide) {
    const loc = job.location.toLowerCase();
    if (!profile.locationTerms.some((t) => loc.includes(t))) {
      // Some sources give office cities or free text, not candidate restrictions.
      flags.push(SOFT_LOCATION_SOURCES.has(job.source) ? "location_check" : "location_restricted");
    }
  }

  // Smallest stated requirement, to avoid false flags on "3 years X, 5 years Y".
  const years = [...text.matchAll(YEARS)].map((m) => Number(m[1]));
  const seniorByYears = years.length > 0 && Math.min(...years) > profile.experienceYears + 2;
  const title = job.title ?? "";
  const seniorByTitle =
    profile.experienceYears <= 4 && SENIOR_TITLE.test(title) && !ENTRY_TITLE.test(title);
  if (seniorByYears || seniorByTitle) flags.push("seniority_mismatch");

  const monthlyMax = toMonthlyUsd(job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  if (monthlyMax !== null && monthlyMax < profile.salary.minimum) {
    flags.push("salary_below_minimum");
  }

  return { eligible: flags.every((f) => SOFT_FLAGS.has(f)), flags };
}
