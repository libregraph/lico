import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  arriveAt,
  fetchMock,
  type HelloResponse,
  postedBody,
  postedInit,
  postedUrl,
  renderWithProviders,
  replyEchoingState,
  stubFetch,
  type TestArrival,
} from "../../test-utils";
import Welcomescreen from "./Welcomescreen";

const Subject = Welcomescreen;

const helloResponse: HelloResponse = {
  state: "nonce-from-the-server",
  flow: "",
  success: true,
  username: "user1@example.com",
  displayName: "Lala 123 abc",
};

/* The shape the common reducer stores, not the wire shape. */
const session = {
  state: true,
  username: helloResponse.username,
  displayName: helloResponse.displayName,
  details: helloResponse,
};

function renderWelcome(arrival: TestArrival = arriveAt("/welcome")) {
  return renderWithProviders(<Subject />, {
    ...arrival,
    preloaded: { common: { hello: session } },
  });
}

/* Answers a request by echoing back the nonce it carried, as the server does. */
function replyWith(payload: Record<string, unknown>): void {
  replyEchoingState(200, payload);
}

describe("Welcomescreen", () => {
  beforeEach(() => {
    stubFetch();
  });

  it("greets the signed in user and confirms the session", () => {
    renderWelcome();

    expect(screen.getByText("Welcome Lala 123 abc")).toBeInTheDocument();
    expect(screen.getByText("user1@example.com")).toBeInTheDocument();
    expect(screen.getByText("You are signed in - awesome!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("shows the loading state instead of failing when the session is gone", () => {
    // Signing out clears the session before the request completes, so this
    // screen re-renders without one and must not read from it.
    renderWithProviders(<Subject />, {
      ...arriveAt("/welcome"),
      preloaded: { common: { hello: null } },
    });

    expect(screen.queryByText("You are signed in - awesome!")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });

  it("does not talk to the server on mount", () => {
    // Unlike Goodbyescreen this screen trusts the hello it was routed with.
    renderWelcome();

    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("does not redirect when arriving by client side navigation", () => {
    const { nav } = renderWelcome(arriveAt("/welcome?flow=oidc#frag", "PUSH"));

    expect(nav.location.pathname).toBe("/welcome");
    expect(nav.entries.length).toBe(1);
  });

  it("does not redirect when arriving by a fresh page load", () => {
    // This screen has no mount time guard of its own, unlike the login
    // containers. Access is gated by the PrivateRoute which renders it.

    const { nav } = renderWelcome(arriveAt("/welcome?flow=oidc#frag", "POP"));

    expect(nav.location.pathname).toBe("/welcome");
    expect(nav.entries.length).toBe(1);
  });

  it("posts to the logoff endpoint with the XSRF header when signing out", async () => {
    replyWith({ success: true });
    renderWelcome();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1));
    expect(postedUrl()).toBe("./identifier/_/logoff");
    expect(typeof postedBody().state).toBe("string");
    expect(postedInit().headers).toEqual({
      "Content-Type": "application/json",
      "Kopano-Konnect-XSRF": "1",
    });
  });

  it("sends the user back to the identifier page after a successful sign out", async () => {
    replyWith({ success: true });
    const { nav } = renderWelcome(arriveAt("/welcome", "PUSH"));

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(nav.location.pathname).toBe("/identifier"));
  });

  it("stays on the welcome page when the server refuses the sign out", async () => {
    replyWith({ success: false });
    const { nav } = renderWelcome(arriveAt("/welcome", "PUSH"));

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1));
    expect(nav.location.pathname).toBe("/welcome");
  });
});
