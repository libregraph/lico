import { screen } from "@testing-library/react";

import { ERROR_LOGIN_FAILED } from "../errors";
import { renderWithProviders } from "../test-utils";
import RequestError from "./RequestError";

describe("RequestError", () => {
  it("renders nothing at all when there is no error", () => {
    // Every screen renders this unconditionally, so an empty coloured paragraph
    // would leave a gap under the form whenever nothing had gone wrong.
    const { container } = renderWithProviders(<RequestError />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the message of the error it is given", () => {
    // The harness has no translation resources, so the key's own English
    // default is what a reader would see here.
    renderWithProviders(<RequestError error={{ message: ERROR_LOGIN_FAILED }} />);

    expect(screen.getByText(/Logon failed/)).toBeInTheDocument();
  });
});
