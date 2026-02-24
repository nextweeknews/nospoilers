import test from "node:test";
import assert from "node:assert/strict";
import { profileNeedsOnboarding } from "../src/profileOnboarding.ts";

test("profileNeedsOnboarding returns true for null profile", () => {
  assert.equal(profileNeedsOnboarding(null), true);
});

test("profileNeedsOnboarding returns true for null username", () => {
  assert.equal(profileNeedsOnboarding({ username: null }), true);
});

test("profileNeedsOnboarding returns true for blank username", () => {
  assert.equal(profileNeedsOnboarding({ username: "   " }), true);
});

test("profileNeedsOnboarding returns false for set username", () => {
  assert.equal(profileNeedsOnboarding({ username: "reader" }), false);
});
