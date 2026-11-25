import { describe, expect, it } from "vitest";
import { htmlToText, parsers } from "./boards";

describe("htmlToText", () => {
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
