import { Suspense } from "react";

import { screen } from "@testing-library/react";

import RedirectWithQuery from "./components/RedirectWithQuery";
import Routes from "./Routes";
import {
  newTestHistory,
  type RenderWithProvidersOptions,
  renderWithProviders,
  replyEchoingState,
  type Session,
  stubFetch,
} from "./test-utils";

/* The client rejects a response whose state does not echo the request's. */
function mockSignedOutHello(): void {
  replyEchoingState(200, { success: false, flow: "" });
}

const signedIn = {
  state: true,
  username: "user1@example.com",
  displayName: "Lala 123 abc",
  details: {},
};

const signedOut = {
  state: false,
  username: undefined,
  displayName: undefined,
  details: {},
};

/* The lazily loaded route targets need a boundary; App supplies one in production. */
function renderRoutes(hello: Session | null, options: RenderWithProvidersOptions) {
  return renderWithProviders(
    <Suspense fallback={<div>loading</div>}>
      <Routes hello={hello} />
    </Suspense>,
    options,
  );
}

beforeEach(() => {
  stubFetch();
});

describe("Routes", () => {
  beforeEach(mockSignedOutHello);

  it("shows the sign in screen to a visitor who is not signed in", async () => {
    renderRoutes(null, { route: "/identifier" });

    expect(await screen.findByText("Sign in")).toBeInTheDocument();
  });

  it("shows the sign in screen for an unknown path below the index route", async () => {
    const history = newTestHistory("/somewhere-else");

    renderRoutes(null, { history });

    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(history.location.pathname).toBe("/identifier");
  });

  it("shows the goodbye screen on the goodbye route", async () => {
    renderRoutes(null, { route: "/goodbye", preloaded: { common: { hello: signedOut } } });

    expect(await screen.findByText("Goodbye")).toBeInTheDocument();
  });
});

describe("PrivateRoute through Routes", () => {
  beforeEach(mockSignedOutHello);

  it("sends a visitor without a session away from the welcome route", async () => {
    const history = newTestHistory("/welcome");

    renderRoutes(null, { history });

    // Redirected onto the index route, which then shows the sign in screen.
    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(history.location.pathname).toBe("/identifier");
  });

  it("sends a visitor away once hello has answered that nobody is signed in", async () => {
    // The hello state becomes an object as soon as the server answers, so a
    // guard testing only for its presence would let this visitor through and
    // then render the welcome screen with an empty name.
    const history = newTestHistory("/welcome");

    renderRoutes(signedOut, { history, preloaded: { common: { hello: signedOut } } });

    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(history.location.pathname).toBe("/identifier");
  });

  it("lets a visitor with a session reach the welcome route", async () => {
    const history = newTestHistory("/welcome");

    renderRoutes(signedIn, { history, preloaded: { common: { hello: signedIn } } });

    expect(await screen.findByText("Welcome Lala 123 abc")).toBeInTheDocument();
    expect(history.location.pathname).toBe("/welcome");
  });

  it("carries the query string and hash along when it sends the visitor away", async () => {
    const history = newTestHistory("/welcome?client_id=demo&prompt=consent#anchor");

    renderRoutes(null, { history });

    await screen.findByText("Sign in");
    expect(history.location.search).toBe("?client_id=demo&prompt=consent");
    expect(history.location.hash).toBe("#anchor");
  });
});

describe("RedirectWithQuery", () => {
  it("redirects to the target while keeping the query string and the hash", () => {
    const history = newTestHistory("/welcome?client_id=demo&scope=openid#section");

    renderWithProviders(<RedirectWithQuery target="/identifier" />, { history });

    expect(history.location.pathname).toBe("/identifier");
    expect(history.location.search).toBe("?client_id=demo&scope=openid");
    expect(history.location.hash).toBe("#section");
  });

  it("redirects with an empty query string and hash when the source had none", () => {
    const history = newTestHistory("/welcome");

    renderWithProviders(<RedirectWithQuery target="/identifier" />, { history });

    expect(history.location.pathname).toBe("/identifier");
    expect(history.location.search).toBe("");
    expect(history.location.hash).toBe("");
  });

  it("replaces the current entry rather than pushing a new one", () => {
    const history = newTestHistory("/welcome");
    const before = history.length;

    renderWithProviders(<RedirectWithQuery target="/identifier" />, { history });

    // A guard redirect must not leave the guarded path in the back history.
    expect(history.length).toBe(before);
    expect(history.action).toBe("REPLACE");
  });
});
