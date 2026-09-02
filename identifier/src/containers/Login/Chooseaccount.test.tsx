import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ERROR_LOGIN_FAILED } from "../../errors";
import { requestLogon } from "../../reducers/login";
import {
  arriveAt,
  fetchMock,
  type HelloResponse,
  type PreloadedState,
  postedBody,
  postedInit,
  postedUrl,
  renderWithProviders,
  replyEchoingState,
  replyNoContentEchoingState,
  stubFetch,
  type TestArrival,
} from "../../test-utils";
import Chooseaccount from "./Chooseaccount";

const Subject = Chooseaccount;

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

function renderChooseaccount(arrival: TestArrival, preloaded: PreloadedState = {}) {
  return renderWithProviders(<Subject />, { ...arrival, preloaded });
}

describe("Chooseaccount", () => {
  beforeEach(() => {
    stubFetch();
  });

  it("lists the signed in account alongside an option to use another", () => {
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), { common: { hello: session } });

    expect(screen.getByText("Choose an account")).toBeInTheDocument();
    expect(screen.getByText("to sign in")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /user1@example\.com/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Use another account/ })).toBeInTheDocument();
  });

  it("shows the first character of the username as the account avatar", () => {
    // Pins the avatar initial before Chooseaccount.jsx:80 loses String.substr.
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), { common: { hello: session } });

    expect(screen.getByText("u")).toBeInTheDocument();
  });

  it("renders an empty avatar when there is no session to read a username from", () => {
    // Arriving by client side navigation suppresses the redirect, so the empty
    // account entry is reachable and must not blow up on the missing username.
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"));

    expect(screen.getByText("Choose an account")).toBeInTheDocument();
    expect(screen.queryByText("u")).not.toBeInTheDocument();
  });

  it("shows a failed logon reported by the server", () => {
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), {
      common: { hello: session },
      login: { errors: { http: new Error(ERROR_LOGIN_FAILED) } },
    });

    expect(screen.getByText("Logon failed. Please verify your credentials and try again.")).toBeInTheDocument();
  });

  it("marks both account entries as disabled while a logon is in flight", () => {
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), {
      common: { hello: session },
      login: { loading: requestLogon.type },
    });

    expect(screen.getByRole("button", { name: /user1@example\.com/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: /Use another account/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("does not redirect when arriving by client side navigation without a session", () => {
    // The guard on nav.action is what distinguishes a deliberate in-app
    // navigation from a fresh page load onto a URL with no session behind it.

    const { nav } = renderChooseaccount(arriveAt("/chooseaccount?flow=oidc#frag", "PUSH"));

    expect(nav.location.pathname).toBe("/chooseaccount");
  });

  it("redirects to the identifier page on a fresh page load without a session", () => {
    const { nav } = renderChooseaccount(arriveAt("/chooseaccount?flow=oidc&client_id=abc#frag", "POP"));

    expect(nav.location.pathname).toBe("/identifier");
    // The query and fragment identify the flow, so they have to survive.
    expect(nav.location.search).toBe("?flow=oidc&client_id=abc");
    expect(nav.location.hash).toBe("#frag");
    // It replaces rather than pushes, so going back cannot return here.
    expect(nav.entries.length).toBe(1);
  });

  it("redirects on a fresh page load when the session says not signed in", () => {
    const { nav } = renderChooseaccount(arriveAt("/chooseaccount"), {
      common: { hello: { state: false, details: { ...helloResponse, success: false } } },
    });

    expect(nav.location.pathname).toBe("/identifier");
  });

  it("stays put on a fresh page load when there is a session", () => {
    const { nav } = renderChooseaccount(arriveAt("/chooseaccount", "POP"), { common: { hello: session } });

    expect(nav.location.pathname).toBe("/chooseaccount");
  });

  it("logs the chosen account on with an empty password in cookie mode", async () => {
    replyEchoingState(200, { success: true, hello: null });
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), { common: { hello: session } });

    await userEvent.click(screen.getByRole("button", { name: /user1@example\.com/ }));

    await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1));
    expect(postedUrl()).toBe("./identifier/_/logon");
    expect(postedBody().params).toEqual(["user1@example.com", "", "0"]);
    expect(typeof postedBody().state).toBe("string");
    expect(postedInit().headers).toEqual({
      "Content-Type": "application/json",
      "Kopano-Konnect-XSRF": "1",
    });
  });

  it("advances to the welcome page after the chosen account is logged on", async () => {
    replyEchoingState(200, { success: true, hello: null });
    const { nav } = renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), { common: { hello: session } });

    await userEvent.click(screen.getByRole("button", { name: /user1@example\.com/ }));

    await waitFor(() => expect(nav.location.pathname).toBe("/welcome"));
  });

  it("reports a refused logon instead of advancing", async () => {
    // A refused logon answers 204 with the echo nonce in a header.
    replyNoContentEchoingState();
    const { nav } = renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), { common: { hello: session } });

    await userEvent.click(screen.getByRole("button", { name: /user1@example\.com/ }));

    expect(await screen.findByText("Logon failed. Please verify your credentials and try again.")).toBeInTheDocument();
    expect(nav.location.pathname).toBe("/chooseaccount");
  });

  it("sends the user to the identifier page to use another account", async () => {
    const { nav } = renderChooseaccount(arriveAt("/chooseaccount?flow=oidc#frag", "PUSH"), {
      common: { hello: session },
    });

    await userEvent.click(screen.getByRole("button", { name: /Use another account/ }));

    expect(nav.location.pathname).toBe("/identifier");
    expect(nav.location.search).toBe("?flow=oidc");
    expect(nav.location.hash).toBe("#frag");
    // It pushes, so the chooser stays reachable by going back, and it asks the
    // server for nothing on the way out.
    expect(nav.entries.length).toBe(2);
    expect(fetchMock()).not.toHaveBeenCalled();
  });
});
