import { Suspense } from "react";

import { screen } from "@testing-library/react";

import RedirectWithQuery from "./components/RedirectWithQuery";
import Routes from "./Routes";
import {
  arriveAt,
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
    const { nav } = renderRoutes(null, arriveAt("/somewhere-else"));

    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(nav.location.pathname).toBe("/identifier");
  });

  it("shows the goodbye screen on the goodbye route", async () => {
    renderRoutes(null, { route: "/goodbye", preloaded: { common: { hello: signedOut } } });

    expect(await screen.findByText("Goodbye")).toBeInTheDocument();
  });
});

describe("PrivateRoute through Routes", () => {
  beforeEach(mockSignedOutHello);

  it("sends a visitor without a session away from the welcome route", async () => {
    const { nav } = renderRoutes(null, arriveAt("/welcome"));

    // Redirected onto the index route, which then shows the sign in screen.
    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(nav.location.pathname).toBe("/identifier");
  });

  it("sends a visitor away once hello has answered that nobody is signed in", async () => {
    // The hello state becomes an object as soon as the server answers, so a
    // guard testing only for its presence would let this visitor through and
    // then render the welcome screen with an empty name.

    const { nav } = renderRoutes(signedOut, { ...arriveAt("/welcome"), preloaded: { common: { hello: signedOut } } });

    expect(await screen.findByText("Sign in")).toBeInTheDocument();
    expect(nav.location.pathname).toBe("/identifier");
  });

  it("lets a visitor with a session reach the welcome route", async () => {
    const { nav } = renderRoutes(signedIn, { ...arriveAt("/welcome"), preloaded: { common: { hello: signedIn } } });

    expect(await screen.findByText("Welcome Lala 123 abc")).toBeInTheDocument();
    expect(nav.location.pathname).toBe("/welcome");
  });

  it("carries the query string and hash along when it sends the visitor away", async () => {
    const { nav } = renderRoutes(null, arriveAt("/welcome?client_id=demo&prompt=consent#anchor"));

    await screen.findByText("Sign in");
    expect(nav.location.search).toBe("?client_id=demo&prompt=consent");
    expect(nav.location.hash).toBe("#anchor");
  });
});

describe("RedirectWithQuery", () => {
  it("redirects to the target while keeping the query string and the hash", () => {
    const { nav } = renderWithProviders(<RedirectWithQuery target="/identifier" />, {
      ...arriveAt("/welcome?client_id=demo&scope=openid#section"),
    });

    expect(nav.location.pathname).toBe("/identifier");
    expect(nav.location.search).toBe("?client_id=demo&scope=openid");
    expect(nav.location.hash).toBe("#section");
  });

  it("redirects with an empty query string and hash when the source had none", () => {
    const { nav } = renderWithProviders(<RedirectWithQuery target="/identifier" />, { ...arriveAt("/welcome") });

    expect(nav.location.pathname).toBe("/identifier");
    expect(nav.location.search).toBe("");
    expect(nav.location.hash).toBe("");
  });

  it("replaces the current entry rather than pushing a new one", () => {
    const { nav } = renderWithProviders(<RedirectWithQuery target="/identifier" />, { ...arriveAt("/welcome") });

    // A guard redirect must not leave the guarded path in the back history, or
    // the browser's back button walks straight into the guard again.
    expect(nav.entries).toHaveLength(1);
    expect(nav.action).toBe("REPLACE");
  });
});
