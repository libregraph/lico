import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

/*
 * jsdom implements no media queries at all. Material-UI v4's withWidth, which
 * withMobileDialog and therefore every responsive screen depends on, resolves
 * its breakpoint by asking matchMedia about each one in turn. A stub that
 * answers "no match" to everything leaves withWidth with no width, and it then
 * renders nothing — so a screen appears to mount while producing an empty tree.
 *
 * This evaluates the min-width and max-width conditions the library actually
 * emits against a fixed viewport, which yields the md breakpoint.
 */
const TEST_VIEWPORT_WIDTH = 1024;

function matchesQuery(query, width) {
  // Queries look like "(min-width:960px)" or "(min-width:600px) and (max-width:959.95px)".
  let matches = true;

  for (const [, value] of query.matchAll(/min-width:\s*([\d.]+)px/g)) {
    if (width < parseFloat(value)) {
      matches = false;
    }
  }
  for (const [, value] of query.matchAll(/max-width:\s*([\d.]+)px/g)) {
    if (width > parseFloat(value)) {
      matches = false;
    }
  }

  return matches;
}

window.matchMedia = (query) => ({
  matches: matchesQuery(String(query), TEST_VIEWPORT_WIDTH),
  media: String(query),
  onchange: null,
  addListener: () => {}, // Deprecated, still used by Material-UI v4.
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

window.innerWidth = TEST_VIEWPORT_WIDTH;

// runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});
