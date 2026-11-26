import { describe, expect, test } from "bun:test";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  test("neutralises spreadsheet formula triggers in strings", () => {
    expect(csvCell("=1+1")).toBe(`"'=1+1"`);
    expect(csvCell("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(csvCell("+1")).toBe(`"'+1"`);
    expect(csvCell("-cmd")).toBe(`"'-cmd"`);
    expect(csvCell("\t=1")).toBe(`"'\t=1"`);
    expect(csvCell("\r=1")).toBe(`"'\r=1"`);
  });

  test("escapes quotes after neutralising", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('say "hi"')).toBe(`"say ""hi"""`);
  });

  test("leaves plain text and non-string values unchanged", () => {
    expect(csvCell("hello")).toBe(`"hello"`);
    expect(csvCell(-5)).toBe(`"-5"`);
    expect(csvCell(true)).toBe(`"true"`);
    expect(csvCell(null)).toBe(`""`);
    expect(csvCell(undefined)).toBe(`""`);
  });
});

describe("toCsv", () => {
  test("joins rows with commas and newlines", () => {
    expect(toCsv([["a", "b"], ["=x", 2]])).toBe(`"a","b"\n"'=x","2"`);
  });
});
