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
    /*
     * The account row carries both lines, so both reach the name a screen
     * reader announces. The decorative initial does not, which is what the
     * absence of a leading "L" here asserts.
     */
    expect(screen.getByText("Lala 123 abc")).toBeInTheDocument();
    expect(screen.getByText("user1@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lala 123 abc user1@example.com" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use another account" })).toBeInTheDocument();
  });

  it("leads with the display name and shows the address beneath it", () => {
    // The fixture's display name is "Lala 123 abc" and its address begins with
    // "user1@", so the initial says which of the two the avatar reads.
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), { common: { hello: session } });

    expect(screen.getByText("L")).toBeInTheDocument();
    expect(screen.queryByText("u")).not.toBeInTheDocument();
  });

  it("falls back to the address when the session carries no display name", () => {
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), {
      common: { hello: { ...session, displayName: "" } },
    });

    expect(screen.getByText("U")).toBeInTheDocument();
  });

  it("keeps a whole character when the name begins with an astral one", () => {
    /*
     * Indexing such a name by code unit hands back half a surrogate pair, which
     * the browser draws as a replacement glyph.
     */
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), {
      common: { hello: { ...session, displayName: "😀 Party" } },
    });

    expect(screen.getByText("😀")).toBeInTheDocument();
  });

  it("renders an empty avatar when there is no session to read a name from", () => {
    // Arriving by client side navigation suppresses the redirect, so the empty
    // account entry is reachable and must not blow up on the missing username.
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"));

    expect(screen.getByText("Choose an account")).toBeInTheDocument();
    expect(screen.queryByText("L")).not.toBeInTheDocument();
    expect(screen.queryByText("U")).not.toBeInTheDocument();
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

  it("renders no chooser for a visitor it is sending back", () => {
    /*
     * The redirect is scheduled as non-urgent work, so a chooser rendered
     * anyway would be on screen for a frame or two after the address had
     * already changed. A visitor with no session never sees a list of accounts.
     */
    renderChooseaccount(arriveAt("/chooseaccount?flow=oidc", "POP"));

    expect(screen.queryByText("Choose an account")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Use another account/ })).not.toBeInTheDocument();
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

  it("holds the focus on the signed in account so it is the default answer", () => {
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), { common: { hello: session } });

    expect(screen.getByRole("button", { name: "Lala 123 abc user1@example.com" })).toHaveFocus();
  });

  it("chooses the focused account on Enter, with no pointer involved", async () => {
    replyEchoingState(200, { success: true, hello: null });
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), { common: { hello: session } });

    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1));
    expect(postedUrl()).toBe("./identifier/_/logon");
    expect(postedBody().params).toEqual(["user1@example.com", "", "0"]);
  });

  it("reaches the other option with Tab and takes it on Enter", async () => {
    const { nav } = renderChooseaccount(arriveAt("/chooseaccount?flow=oidc", "PUSH"), {
      common: { hello: session },
    });

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Use another account" })).toHaveFocus();

    await userEvent.keyboard("{Enter}");

    expect(nav.location.pathname).toBe("/identifier");
    expect(nav.location.search).toBe("?flow=oidc");
  });

  it("walks the rows with the arrow keys", async () => {
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), { common: { hello: session } });

    const account = screen.getByRole("button", { name: "Lala 123 abc user1@example.com" });
    const other = screen.getByRole("button", { name: "Use another account" });

    await userEvent.keyboard("{ArrowDown}");
    expect(other).toHaveFocus();

    await userEvent.keyboard("{ArrowUp}");
    expect(account).toHaveFocus();
  });

  it("wraps at each end, so either arrow reaches the other row", async () => {
    renderChooseaccount(arriveAt("/chooseaccount", "PUSH"), { common: { hello: session } });

    const account = screen.getByRole("button", { name: "Lala 123 abc user1@example.com" });
    const other = screen.getByRole("button", { name: "Use another account" });

    // Up from the first row is the last one, and down from the last is the first.
    await userEvent.keyboard("{ArrowUp}");
    expect(other).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(account).toHaveFocus();
  });

  it("takes the row an arrow moved to on Enter", async () => {
    const { nav } = renderChooseaccount(arriveAt("/chooseaccount?flow=oidc", "PUSH"), {
      common: { hello: session },
    });

    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(nav.location.pathname).toBe("/identifier");
    expect(nav.location.search).toBe("?flow=oidc");
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
