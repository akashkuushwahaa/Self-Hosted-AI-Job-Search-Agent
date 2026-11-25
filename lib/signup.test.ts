import { describe, expect, it } from "vitest";
import { mayCreateAccount, signupPolicy } from "./signup";

describe("signupPolicy", () => {
  it("is open by default, for a single-user local install", () => {
    const p = signupPolicy({});
    expect(p.mode).toBe("open");
    expect(mayCreateAccount("anyone@example.com", p)).toBe(true);
  });

  it("is closed with ALLOW_SIGNUP=0", () => {
    for (const value of ["0", "false", "no", "off"]) {
      const p = signupPolicy({ ALLOW_SIGNUP: value });
      expect(p.mode).toBe("closed");
      expect(mayCreateAccount("anyone@example.com", p)).toBe(false);
    }
  });

  it("lets only listed emails and @domains in with ALLOWED_EMAILS, even when sign-up is closed", () => {
    const p = signupPolicy({ ALLOWED_EMAILS: " Me@Example.com, @team.dev ,", ALLOW_SIGNUP: "0" });
    expect(p.mode).toBe("invite");
    expect(mayCreateAccount("me@example.com", p)).toBe(true);
    expect(mayCreateAccount("ME@EXAMPLE.COM ", p)).toBe(true);
    expect(mayCreateAccount("anyone@team.dev", p)).toBe(true);
    expect(mayCreateAccount("someone@example.com", p)).toBe(false);
    expect(mayCreateAccount("me@example.com.evil.test", p)).toBe(false);
    expect(mayCreateAccount("x@notteam.dev", p)).toBe(false);
  });
});
