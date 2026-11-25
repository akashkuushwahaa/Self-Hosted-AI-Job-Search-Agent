import { describe, expect, it } from "vitest";
import { countryPattern, filterParams, levelPattern, parseFilters, REMOTE_PATTERN, toRegExp } from "./filters";

const level = (l: Parameters<typeof levelPattern>[0], title: string) => toRegExp(levelPattern(l), "i").test(title);
const country = (code: string, location: string) => {
  const p = countryPattern(code)!;
  return toRegExp(p.names, "i").test(location) || Boolean(p.codes && toRegExp(p.codes, "").test(location));
};

describe("parseFilters", () => {
  it("reads valid params and ignores the rest", () => {
    expect(parseFilters({ remote: "1", country: "IN", company: "stripe", posted: "7", level: "intern" })).toEqual({
      remote: true, country: "IN", company: "stripe", postedDays: 7, level: "intern",
    });
  });

  it("drops unknown or tampered values instead of failing the page", () => {
    expect(parseFilters({ country: "XX", company: "no-such-board", posted: "9999", level: "ceo", remote: "yes" })).toEqual({
      remote: false, country: null, company: null, postedDays: null, level: null,
    });
    expect(parseFilters({ country: ["IN", "US"] })).toMatchObject({ country: null });
  });

  it("round-trips through URL params, leaving out what isn't set", () => {
    const f = parseFilters({ remote: "1", level: "entry" });
    expect(filterParams(f)).toEqual({ remote: "1", level: "entry" });
    expect(parseFilters(filterParams(f))).toEqual(f);
  });
});

describe("levelPattern", () => {
  it("finds internships", () => {
    expect(level("intern", "Software Engineer Intern (Summer 2027)")).toBe(true);
    expect(level("intern", "Machine Learning Internship 2027")).toBe(true);
    expect(level("intern", "Co-op, Data Platform")).toBe(true);
    expect(level("intern", "Internal Tools Engineer")).toBe(false);
    expect(level("intern", "International Payments Lead")).toBe(false);
  });

  it("finds new grad and entry-level roles", () => {
    expect(level("entry", "Software Engineer, New Grad 2027")).toBe(true);
    expect(level("entry", "Entry-Level Data Analyst")).toBe(true);
    expect(level("entry", "Junior Frontend Developer")).toBe(true);
    expect(level("entry", "Senior Software Engineer")).toBe(false);
  });

  it("finds senior and above", () => {
    expect(level("senior", "Sr. Product Designer")).toBe(true);
    expect(level("senior", "Staff Engineer, Payments")).toBe(true);
    expect(level("senior", "Engineering Lead")).toBe(true);
    expect(level("senior", "Software Engineer")).toBe(false);
    expect(level("senior", "Leadership Development Partner")).toBe(false);
  });
});

describe("countryPattern", () => {
  it("matches the country name, its cities and its codes", () => {
    expect(country("IN", "Bengaluru, Karnataka")).toBe(true);
    expect(country("IN", "Remote - India")).toBe(true);
    expect(country("US", "San Francisco, CA")).toBe(true);
    expect(country("US", "Remote, US")).toBe(true);
    expect(country("US", "Remote (U.S.)")).toBe(true);
    expect(country("GB", "London")).toBe(true);
  });

  it("doesn't match lowercase words that look like codes, or other countries", () => {
    expect(country("US", "Join us in Berlin")).toBe(false);
    expect(country("IN", "Dublin, Ireland")).toBe(false);
    expect(country("US", "Toronto, ON, CA")).toBe(false);
  });

  it("is null for an unknown code", () => {
    expect(countryPattern("XX")).toBeNull();
  });
});

describe("REMOTE_PATTERN", () => {
  it("finds remote locations", () => {
    expect(toRegExp(REMOTE_PATTERN, "i").test("Remote - India")).toBe(true);
    expect(toRegExp(REMOTE_PATTERN, "i").test("Europe (Remote)")).toBe(true);
    expect(toRegExp(REMOTE_PATTERN, "i").test("Remote-Friendly (Travel-Required)")).toBe(true);
    expect(toRegExp(REMOTE_PATTERN, "i").test("Bengaluru")).toBe(false);
  });
});
