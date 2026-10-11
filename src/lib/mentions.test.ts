import { describe, expect, it } from "vitest"
import { completeMention, isMentioned, mentionAt, partsOf, suggestionsFor } from "./mentions"

describe("partsOf", () => {
  it("leaves text without a mention whole", () => {
    expect(partsOf("good game everyone")).toEqual([{ text: "good game everyone" }])
    expect(partsOf("")).toEqual([])
  })

  it("picks the mentions out, in place", () => {
    expect(partsOf("@ann nice one, @bob_99 unlucky")).toEqual([
      { text: "@ann", mention: "ann" }, { text: " nice one, " }, { text: "@bob_99", mention: "bob_99" }, { text: " unlucky" },
    ])
    expect(partsOf("thanks @ann!")).toEqual([{ text: "thanks " }, { text: "@ann", mention: "ann" }, { text: "!" }])
    expect(partsOf("(@ann)")).toEqual([{ text: "(" }, { text: "@ann", mention: "ann" }, { text: ")" }])
  })

  it("doesn't take an email address, or an @ with nothing a name could be after it, for a mention", () => {
    for (const text of ["write to ann@example.com", "meet @ 5", "@ab is too short", "@@ann", "a@ann"]) {
      expect(partsOf(text)).toEqual([{ text }])
    }
  })

  it("doesn't cut a name short: one too long to be a name is not a mention of its first letters", () => {
    expect(partsOf("@abcdefghijklmnopqrstu")).toEqual([{ text: "@abcdefghijklmnopqrstu" }])
    expect(partsOf("@abcdefghijklmnopqrst")).toEqual([{ text: "@abcdefghijklmnopqrst", mention: "abcdefghijklmnopqrst" }])
  })
})

describe("isMentioned", () => {
  it("is so for the player named, however the name was capitalised", () => {
    expect(isMentioned("gg @Ann", "ann")).toBe(true)
    expect(isMentioned("gg @ann", "ANN")).toBe(true)
    expect(isMentioned("@bob and @ann", "ann")).toBe(true)
  })

  it("isn't for anyone else, or for a name that only begins the same", () => {
    expect(isMentioned("gg @annabel", "ann")).toBe(false)
    expect(isMentioned("gg ann", "ann")).toBe(false)
    expect(isMentioned("gg @bob", "ann")).toBe(false)
  })

  it("isn't for somebody with no name to go by", () => {
    expect(isMentioned("gg @ann", null)).toBe(false)
    expect(isMentioned("gg @ann", undefined)).toBe(false)
    expect(isMentioned("gg @ann", "")).toBe(false)
  })
})

describe("mentionAt", () => {
  it("finds the mention being typed where the caret is", () => {
    expect(mentionAt("hey @an", 7)).toEqual({ start: 4, query: "an" })
    expect(mentionAt("@", 1)).toEqual({ start: 0, query: "" })
    expect(mentionAt("hey @ann there", 8)).toEqual({ start: 4, query: "ann" })
    // part-way through one, it is what is before the caret that counts
    expect(mentionAt("hey @ann there", 6)).toEqual({ start: 4, query: "a" })
  })

  it("finds none anywhere else", () => {
    expect(mentionAt("hey ann", 7)).toBeNull()
    expect(mentionAt("hey @ann ", 9)).toBeNull()
    expect(mentionAt("ann@ex", 6)).toBeNull()
    expect(mentionAt("hey @ann there", 14)).toBeNull()
  })
})

describe("suggestionsFor", () => {
  const names = ["ann", "Annabel", "bob", "ANN", "andy", "anders", "angus", "anita"]

  it("gives the names that begin that way, in the order they came, each once", () => {
    expect(suggestionsFor("an", names)).toEqual(["ann", "Annabel", "andy", "anders", "angus"])
    expect(suggestionsFor("AN", names, 2)).toEqual(["ann", "Annabel"])
    expect(suggestionsFor("b", names)).toEqual(["bob"])
  })

  it("gives the first few of everybody before anything is typed, and nobody when nothing fits", () => {
    expect(suggestionsFor("", names, 3)).toEqual(["ann", "Annabel", "bob"])
    expect(suggestionsFor("zz", names)).toEqual([])
  })
})

describe("completeMention", () => {
  it("finishes the name and leaves the caret ready for the next word", () => {
    expect(completeMention("hey @an", 7, "Annabel")).toEqual({ text: "hey @Annabel ", caret: 13 })
    expect(completeMention("@", 1, "bob")).toEqual({ text: "@bob ", caret: 5 })
  })

  it("keeps what comes after it, without doubling the space", () => {
    expect(completeMention("hey @an there", 7, "ann")).toEqual({ text: "hey @ann there", caret: 9 })
    expect(completeMention("hey @anthere", 7, "ann")).toEqual({ text: "hey @ann there", caret: 9 })
  })

  it("changes nothing where no mention is being typed", () => {
    expect(completeMention("hey ann", 7, "ann")).toEqual({ text: "hey ann", caret: 7 })
  })
})
