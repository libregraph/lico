import { render, screen } from "@testing-library/react";

import BusyButton from "./BusyButton";

describe("BusyButton", () => {
  it("shows no progress while nothing is in flight", () => {
    render(<BusyButton>Next</BusyButton>);

    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows progress over the button while its own request is in flight", () => {
    // Over, not instead of: the button stays rendered so that nothing below it
    // moves when a request starts.
    render(
      <BusyButton busy disabled>
        Next
      </BusyButton>,
    );

    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("takes disabled independently of busy, for a screen with two of them", () => {
    // The screen offering Cancel and Allow disables both while either is in
    // flight, and the indicator belongs on the one that was pressed.
    render(
      <BusyButton busy={false} disabled>
        Cancel
      </BusyButton>,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
