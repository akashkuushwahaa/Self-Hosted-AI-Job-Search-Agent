import { z } from "zod";
import list from "@/config/companies.json";
import { SOURCES, type Company } from "./boards";

export type ListedCompany = Company & { site: string };

// The curated company list lives in config/companies.json, so adding a company is a one-line edit:
// its career board (source + board slug, checked live; a board that later 404s is skipped by ingest)
// and its own site, which research crawls. Research only ever visits these sites, never a URL a
// user typed. Validated here, so a typo fails at startup instead of quietly breaking ingest.
const companiesSchema = z
  .array(
    z.object({
      source: z.enum(SOURCES),
      board: z.string().regex(/^[\w.-]+$/, "board slugs are letters, digits, '.', '_' or '-'"),
      name: z.string().min(1),
      site: z.url({ protocol: /^https$/ }),
    }),
  )
  .refine((cs) => new Set(cs.map((c) => c.board)).size === cs.length, "each board slug must appear once");

export const companies: ListedCompany[] = companiesSchema.parse(list);

export const companyByBoard = (board: string) => companies.find((c) => c.board === board);
