import { screen } from "@testing-library/react";

import { renderWithProviders } from "../test-utils";
import ProgressStrip from "./ProgressStrip";

describe("ProgressStrip", () => {
  it("spans the top edge of the viewport rather than sitting in the middle of it", () => {
    /*
     * The background is a scatter of thin circle outlines, which is what a
     * centred ring disappears into. Being pinned across the top is the whole
     * reason this shape was chosen, so it is worth asserting rather than
     * leaving to a stylesheet nobody reads.
     */
    renderWithProviders(<ProgressStrip />);

    expect(screen.getByRole("progressbar")).toHaveStyle({
      position: "fixed",
      top: "0px",
      left: "0px",
      right: "0px",
    });
  });

  it("reports progress it cannot measure", () => {
    // The wait is a chunk download and a hand-off, neither of which announces
    // how far along it is, so a value here would be invented.
    renderWithProviders(<ProgressStrip />);

    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });
});
