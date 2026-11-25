import { describe, expect, it } from "vitest";
import { groundDossier, type Dossier } from "./dossier";

const dossier: Dossier = {
  summary: "Acme makes rockets.",
  products: ["Acme Rocket", "Acme Moonbase"],
  techStack: ["Go", "Kubernetes", "Vue.js"],
  culture: ["Ship weekly"],
  talkingPoints: ["Launched 40 rockets"],
};
const pages = [{ url: "https://acme.com", text: "Acme Rocket is built in Go and runs on kubernetes clusters." }];

describe("groundDossier", () => {
  it("drops products and tech the pages never name", () => {
    const grounded = groundDossier(dossier, pages);
    expect(grounded.products).toEqual(["Acme Rocket"]);
    expect(grounded.techStack).toEqual(["Go", "Kubernetes"]);
  });

  it("matches whole words, so 'Go' does not match 'good'", () => {
    expect(groundDossier({ ...dossier, techStack: ["Go"] }, [{ url: "x", text: "a good team" }]).techStack).toEqual([]);
  });

  it("leaves paraphrased fields alone", () => {
    const grounded = groundDossier(dossier, pages);
    expect(grounded.culture).toEqual(["Ship weekly"]);
    expect(grounded.talkingPoints).toEqual(["Launched 40 rockets"]);
  });
});
