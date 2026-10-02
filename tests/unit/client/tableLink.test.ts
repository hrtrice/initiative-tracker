import { describe, it, expect } from "vitest";
import { tableLink, readTableParam } from "../../../src/client/lib/tableLink";

describe("tableLink", () => {
  it("points at the home page with the table number", () => {
    expect(tableLink("https://easyinitiative.up.railway.app", "6326")).toBe(
      "https://easyinitiative.up.railway.app/?table=6326"
    );
    expect(tableLink("http://localhost:3000", "2345")).toBe("http://localhost:3000/?table=2345");
  });
});

describe("readTableParam", () => {
  it("reads a well-formed table number", () => {
    expect(readTableParam("?table=6326")).toBe("6326");
    expect(readTableParam("?x=1&table=%206326%20")).toBe("6326");
  });

  it("ignores missing, malformed or impossible numbers", () => {
    expect(readTableParam("")).toBeNull();
    expect(readTableParam("?table=")).toBeNull();
    expect(readTableParam("?table=632")).toBeNull();
    expect(readTableParam("?table=63266")).toBeNull();
    // Room codes never use 0 or 1, so these can't be real tables.
    expect(readTableParam("?table=1000")).toBeNull();
    expect(readTableParam("?table=<scr")).toBeNull();
  });
});
