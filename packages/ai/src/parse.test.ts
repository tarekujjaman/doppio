import { describe, expect, it } from "vitest";
import { safeParseLLMJson } from "./parse";
import { ActionsOutputSchema, SummarizeOutputSchema } from "./types";

const valid = {
  title: "Sprint planning",
  overview: "The team planned the sprint.",
  tags: ["sprint", "planning", "team"],
};

describe("safeParseLLMJson", () => {
  it("parses clean JSON", () => {
    expect(safeParseLLMJson(JSON.stringify(valid), SummarizeOutputSchema)).toMatchObject(valid);
  });

  it("parses fenced JSON", () => {
    const raw = "```json\n" + JSON.stringify(valid) + "\n```";
    expect(safeParseLLMJson(raw, SummarizeOutputSchema)).toMatchObject(valid);
  });

  it("parses JSON with prose around it", () => {
    const raw = `Here is your summary:\n${JSON.stringify(valid)}\nHope that helps!`;
    expect(safeParseLLMJson(raw, SummarizeOutputSchema)).toMatchObject(valid);
  });

  it("returns null for malformed JSON instead of throwing", () => {
    expect(safeParseLLMJson("{ not json at all", SummarizeOutputSchema)).toBeNull();
    expect(safeParseLLMJson("", SummarizeOutputSchema)).toBeNull();
  });

  it("returns null when the schema does not match", () => {
    expect(safeParseLLMJson(JSON.stringify({ title: "x" }), SummarizeOutputSchema)).toBeNull();
  });

  it("accepts empty action item lists", () => {
    expect(safeParseLLMJson(JSON.stringify({ items: [] }), ActionsOutputSchema)).toEqual({
      items: [],
    });
  });
});
