import { describe, it, expect } from "vitest";
import { PRODUCTS, getProductById } from "./index.js";

describe("PRODUCTS", () => {
  it("is an array", () => {
    expect(Array.isArray(PRODUCTS)).toBe(true);
  });
});

describe("getProductById", () => {
  it("returns undefined for invalid id", () => {
    expect(getProductById("nonexistent")).toBeUndefined();
  });
});
