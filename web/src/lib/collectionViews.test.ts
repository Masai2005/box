import { describe, expect, test } from "bun:test";
import { clampPerPage, editableField, parseColumns, serializeColumns } from "./collectionViews";

describe("clampPerPage", () => {
  test("keeps values inside the API range", () => {
    expect(clampPerPage(undefined)).toBe(30);
    expect(clampPerPage(1)).toBe(10);
    expect(clampPerPage(500)).toBe(200);
    expect(clampPerPage("42")).toBe(42);
    expect(clampPerPage("nope", 50)).toBe(50);
  });
});

describe("parseColumns", () => {
  const available = ["title", "body", "published"];

  test("uses the first five columns by default", () => {
    expect(parseColumns(undefined, available)).toEqual(available);
  });

  test("drops unknown and duplicate column names", () => {
    expect(parseColumns("title,missing,body", available)).toEqual(["title", "body"]);
  });

  test("supports hiding every optional column", () => {
    expect(parseColumns("", available)).toEqual([]);
    expect(serializeColumns(["title", "body"])).toBe("title,body");
  });
});

describe("editableField", () => {
  test("only allows scalar fields to be edited inline", () => {
    expect(editableField("text")).toBe(true);
    expect(editableField("number")).toBe(true);
    expect(editableField("bool")).toBe(true);
    expect(editableField("relation")).toBe(false);
    expect(editableField("file")).toBe(false);
  });
});
