import { screen } from "@testing-library/react";

import App from "./App";
import { postedBody, postedInit, postedUrl, renderWithoutRouter, replyEchoingState, stubFetch } from "./test-utils";

/*
 * App mounts the router itself, with the deployment's path prefix as its
 * basename, so the document has to be served from below that prefix for any
 * route to match. That is what identifier.go writes into index.html, and
 * pointing jsdom at it is what makes this exercise the real wiring rather than
 * a router the test supplied.
 */
const PATH_PREFIX = "/signin/v1";

describe("App", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", `${PATH_PREFIX}/identifier`);
    stubFetch();
    /* The client rejects a response whose state does not echo the request's. */
    replyEchoingState(200, { success: false, flow: "" });
  });

  it("takes a visitor who is not signed in to the sign in screen", async () => {
    renderWithoutRouter(<App />);

    // Main is loaded lazily behind a Suspense boundary, so the spinner shows
    // first. Awaiting the query is what makes this assert the real tree.
    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it("asks the server who the visitor is while it starts up", async () => {
    renderWithoutRouter(<App />);

    await screen.findByText("Sign in");

    expect(postedUrl()).toBe("./identifier/_/hello");
    expect(postedBody()).toEqual(expect.objectContaining({ state: expect.any(String) }));
    expect(postedInit().headers).toEqual({
      "Content-Type": "application/json",
      "Kopano-Konnect-XSRF": "1",
    });
  });
});
