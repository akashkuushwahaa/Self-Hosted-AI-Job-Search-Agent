import { describe, expect, it } from "vitest";
import { htmlToText, parsers } from "./boards";

describe("htmlToText", () => {
  it("decodes the typographic entities postings use", () => {
    expect(htmlToText("<p>$164,200&mdash;$229,900 &ndash; it&rsquo;s &ldquo;great&rdquo;&hellip;</p>")).toBe("$164,200—$229,900 – it’s “great”…");
  });

  it("strips tags, keeps list structure, decodes entities", () => {
    expect(htmlToText("<p>Hi &amp; welcome</p><ul><li>Go</li><li>Rust&#39;s</li></ul>")).toBe(
      "Hi & welcome\n\n• Go\n• Rust's",
    );
  });
});

describe("parsers", () => {
  it("greenhouse: decodes escaped HTML content", () => {
    const [job] = parsers.greenhouse({ source: "greenhouse", board: "acme", name: "Acme" }, {
      jobs: [{
        id: 42, title: "Engineer", absolute_url: "https://x/42",
        content: "&lt;p&gt;Build &amp;amp; ship&lt;/p&gt;", location: { name: "Remote" },
        first_published: "2026-10-22T11:22:01-04:00",
      }],
    });
    expect(job).toMatchObject({ externalId: "42", company: "Acme", location: "Remote", description: "Build & ship" });
    expect(job.postedAt?.toISOString()).toBe("2026-10-22T15:22:01.000Z");
  });

  it("lever: joins description, lists and additional text", () => {
    const [job] = parsers.lever({ source: "lever", board: "acme", name: "Acme" }, [{
      id: "abc", text: "Engineer", hostedUrl: "https://x/abc", createdAt: 1786469891368,
      descriptionPlain: "Intro", additionalPlain: "Perks",
      lists: [{ text: "You will", content: "<li>Code</li>" }], categories: { location: "Pune" },
    }]);
    expect(job.description).toBe("Intro\n\nYou will\n• Code\n\nPerks");
    expect(job.location).toBe("Pune");
  });

  it("ashby: drops unlisted jobs and marks remote", () => {
    const jobs = parsers.ashby({ source: "ashby", board: "acme", name: "Acme" }, {
      jobs: [
        { id: "1", title: "A", jobUrl: "https://x/1", location: "Europe", isRemote: true, descriptionPlain: "d" },
        { id: "2", title: "B", jobUrl: "https://x/2", isListed: false },
      ],
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].location).toBe("Europe (Remote)");
  });

  it("rejects a response missing required fields", () => {
    expect(() => parsers.ashby({ source: "ashby", board: "acme", name: "Acme" }, { jobs: [{ id: 1 }] })).toThrow();
  });
});

describe("new sources", () => {
  it("smartrecruiters: job sections first, company blurb last, remote marked", () => {
    const [job] = parsers.smartrecruiters({ source: "smartrecruiters", board: "freshworks", name: "Freshworks" }, {
      postings: [{
        id: "744000163810609",
        name: "Senior Staff Engineer - Site Reliability",
        releasedDate: "2026-11-26T06:26:16.357Z",
        postingUrl: "https://jobs.smartrecruiters.com/Freshworks/744000163810609-senior-staff-engineer",
        location: { fullLocation: "Hyderabad, TS, India", remote: true },
        jobAd: {
          sections: {
            companyDescription: { title: "Company Description", text: "<p>About Freshworks</p>" },
            jobDescription: { title: "Job Description", text: "<p>Keep things up&#xa0;&amp; fast</p>" },
            qualifications: { title: "Qualifications", text: "<ul><li>SRE</li></ul>" },
          },
        },
      }],
    });
    expect(job).toMatchObject({ externalId: "744000163810609", company: "Freshworks", location: "Hyderabad, TS, India (Remote)" });
    expect(job.description).toBe("Keep things up & fast\n\nQualifications\n• SRE\n\nAbout Freshworks");
    expect(job.postedAt?.toISOString()).toBe("2026-11-26T06:26:16.357Z");
  });

  it("workable: builds the location from its parts", () => {
    const [job] = parsers.workable({ source: "workable", board: "huggingface", name: "Hugging Face" }, {
      jobs: [{
        title: "ML Engineer", shortcode: "81B46579FE", shortlink: "https://apply.workable.com/j/81B46579FE",
        description: "<p>Open source</p>", city: "Paris", state: "", country: "France", telecommuting: true, published_on: "2026-05-29",
      }],
    });
    expect(job).toMatchObject({ externalId: "81B46579FE", location: "Paris, France (Remote)", url: "https://apply.workable.com/j/81B46579FE", description: "Open source" });
    expect(job.postedAt?.toISOString().slice(0, 10)).toBe("2026-05-29");
  });

  it("recruitee: joins description and requirements, skips unpublished offers, reads its UTC dates", () => {
    const jobs = parsers.recruitee({ source: "recruitee", board: "bunq", name: "bunq" }, {
      offers: [
        {
          id: 2837107, title: "Compliance Agent", status: "published", careers_url: "https://careers.bunq.com/o/compliance-agent",
          description: "<p>The role</p>", requirements: "<ul><li>Careful</li></ul>", location: "İstanbul, Türkiye", remote: false,
          published_at: "2026-11-24 10:10:44 UTC",
        },
        { id: 1, title: "Draft", status: "draft", careers_url: "https://x", description: "", requirements: "", location: "", remote: false, published_at: null },
      ],
    });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ externalId: "2837107", location: "İstanbul, Türkiye", description: "The role\n\n• Careful" });
    expect(jobs[0].postedAt?.toISOString()).toBe("2026-11-24T10:10:44.000Z");
  });
});

describe("config/companies.json", () => {
  it("loads and validates", async () => {
    const { companies } = await import("./companies");
    expect(companies.length).toBeGreaterThanOrEqual(45);
    expect(new Set(companies.map((c) => c.source))).toEqual(new Set(["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "recruitee"]));
  });
});
