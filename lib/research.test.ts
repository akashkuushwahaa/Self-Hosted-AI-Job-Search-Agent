import { describe, expect, it } from "vitest";
import { pickLinks } from "./research";

const home = "https://www.acme.com/";
const link = (href: string, text = "") => ({ href, text });

describe("pickLinks", () => {
  it("keeps same-site pages that look like about, engineering or culture pages", () => {
    expect(
      pickLinks(home, [link("https://www.acme.com/about"), link("https://www.acme.com/pricing"), link("https://acme.com/engineering")], 3),
    ).toEqual(["https://www.acme.com/about", "https://acme.com/engineering"]);
  });

  it("matches on link text when the path says nothing", () => {
    expect(pickLinks(home, [link("https://www.acme.com/p/123", "Our story")], 3)).toEqual(["https://www.acme.com/p/123"]);
  });

  it("does not treat customer stories as the company's own story", () => {
    expect(pickLinks(home, [link("https://www.acme.com/customers/bigco", "Read story")], 3)).toEqual([]);
  });

  it("drops other sites, the home page, anchors and duplicates", () => {
    expect(
      pickLinks(
        home,
        [
          link("https://twitter.com/acme/about"),
          link("https://www.acme.com/", "About"),
          link("https://www.acme.com/about#team"),
          link("https://www.acme.com/about"),
          link("mailto:hi@acme.com", "About us"),
        ],
        3,
      ),
    ).toEqual(["https://www.acme.com/about"]);
  });

  it("puts about pages first and stops at the limit", () => {
    expect(
      pickLinks(
        home,
        [link("https://www.acme.com/blog"), link("https://www.acme.com/careers"), link("https://www.acme.com/company/about")],
        2,
      ),
    ).toEqual(["https://www.acme.com/company/about", "https://www.acme.com/blog"]);
  });

  it("skips login, legal and file links even when they mention a hint", () => {
    expect(
      pickLinks(home, [link("https://www.acme.com/about/privacy"), link("https://www.acme.com/login", "About"), link("https://www.acme.com/about.pdf")], 3),
    ).toEqual([]);
  });
});
