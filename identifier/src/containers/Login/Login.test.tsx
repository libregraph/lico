import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { requestLogon } from "../../reducers/login";
import {
  arriveAt,
  type Branding,
  fetchMock,
  postedBody,
  postedInit,
  postedUrl,
  renderWithProviders,
  replyEchoingState,
  stubFetch,
  type TestArrival,
} from "../../test-utils";
import Login from "./Login";

const logonBodies = (): Record<string, unknown>[] =>
  fetchMock()
    .mock.calls.map((_call: unknown[], index: number) => index)
    .filter((index) => postedUrl(index) === "./identifier/_/logon")
    .map((index) => postedBody(index));

/*
 * Material-UI v4 only wires a label to its input when the TextField is given an
 * id, and these fields have none, so getByLabelText cannot find them. The label
 * is a sibling of the input inside the form control, so look it up from there.
 * This helper is local on purpose; it encodes a quirk of the current markup.
 */
const labelOf = (text: string): HTMLLabelElement => screen.getByText(text, { selector: "label" }) as HTMLLabelElement;

const fieldOf = (label: string): HTMLInputElement => {
  const input = labelOf(label).parentElement?.querySelector("input");
  if (!input) {
    throw new Error(`no input belongs to the label "${label}"`);
  }
  return input;
};

const Subject = Login;

const renderLogin = (branding?: Branding, loading = "") =>
  renderWithProviders(<Subject />, {
    ...arriveAt("/identifier"),
    preloaded: {
      common: { hello: null, branding: branding ?? null, query: {} },
      login: { loading },
    },
  });

// No request may escape the test. The stub echoes the client generated state
// nonce, because the action rejects a response whose state differs.
beforeEach(() => {
  stubFetch();
  replyEchoingState(200, { success: true, hello: null });
});

describe("Login", () => {
  it("offers a username field, a password field and a submit button", () => {
    renderLogin();

    expect(fieldOf("Username")).toBeInTheDocument();
    expect(fieldOf("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });

  it('labels the username field "Email" when branding asks for an email hint', () => {
    renderLogin({ usernameHintText: "Email" });

    expect(labelOf("Email")).toBeInTheDocument();
    expect(screen.queryByText("Username", { selector: "label" })).not.toBeInTheDocument();
  });

  it('labels the username field "Username" when branding asks for a username hint', () => {
    renderLogin({ usernameHintText: "Username" });

    expect(labelOf("Username")).toBeInTheDocument();
  });

  it('labels the username field "Username" when branding says nothing', () => {
    renderLogin();

    expect(labelOf("Username")).toBeInTheDocument();
  });

  it("uses an unrecognised username hint verbatim as the field label", () => {
    // Any hint which is not one of the three known ones is shown as given, so a
    // deployment can label the field with its own wording.
    renderLogin({ usernameHintText: "Company account" });

    expect(labelOf("Company account")).toBeInTheDocument();
  });

  it("shows the branding sign-in page text when one is configured", () => {
    renderLogin({ signinPageText: "Use your work account." });

    expect(screen.getByText("Use your work account.")).toBeInTheDocument();
  });

  it("submits the logon when Enter is pressed in the password field (regression: the fields must stay inside a form)", async () => {
    // The abandoned modernization replaced the surrounding <form onSubmit> with
    // a plain <div>, which silently removed keyboard submission.
    renderLogin();

    await userEvent.type(fieldOf("Username"), "user1@example.test");
    await userEvent.type(fieldOf("Password"), "secret123{Enter}");

    await waitFor(() => expect(logonBodies()).toHaveLength(1));
    expect(logonBodies()[0].params).toEqual(["user1@example.test", "secret123", "1"]);
  });

  it("sends the logon to the relative endpoint with the XSRF header", async () => {
    renderLogin();

    await userEvent.type(fieldOf("Username"), "user1@example.test");
    await userEvent.type(fieldOf("Password"), "secret123{Enter}");

    await waitFor(() => expect(fetchMock()).toHaveBeenCalled());
    expect(postedUrl()).toBe("./identifier/_/logon");
    expect(postedInit().headers).toEqual({
      "Content-Type": "application/json",
      "Kopano-Konnect-XSRF": "1",
    });
  });

  it("submits the logon when the next button is clicked", async () => {
    renderLogin();

    await userEvent.type(fieldOf("Username"), "user1@example.test");
    await userEvent.type(fieldOf("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(logonBodies()).toHaveLength(1));
    expect(logonBodies()[0].params).toEqual(["user1@example.test", "secret123", "1"]);
  });

  it("refuses to submit without a username and says so", async () => {
    renderLogin();

    await userEvent.type(fieldOf("Password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(screen.getByText("Enter a valid value.")).toBeInTheDocument());
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("refuses to submit without a password and says so", async () => {
    renderLogin();

    await userEvent.type(fieldOf("Username"), "user1@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(screen.getByText("Enter your password.")).toBeInTheDocument());
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("hides the password until the visibility toggle is used", async () => {
    renderLogin();

    const password = fieldOf("Password");
    expect(password).toHaveAttribute("type", "password");

    await userEvent.click(screen.getByLabelText("toggle password visibility"));
    expect(password).toHaveAttribute("type", "text");

    await userEvent.click(screen.getByLabelText("toggle password visibility"));
    expect(password).toHaveAttribute("type", "password");
  });

  it("disables the next button and shows progress while a logon is in flight", () => {
    renderLogin(undefined, requestLogon.type);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("leaves the next button usable when no logon is in flight", () => {
    renderLogin();

    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  describe("login_hint prefill", () => {
    /*
     * The hint decides only whether the username field is prefilled, so the test
     * is permissive by design: the server remains the authority on what is a
     * valid identity. These pin that judgement, which was previously unpinned.
     */
    const renderWithHint = (hint?: string) => {
      return renderWithProviders(<Subject />, {
        ...arriveAt("/identifier"),
        preloaded: {
          common: {
            hello: null,
            branding: null,
            query: hint === undefined ? {} : { login_hint: hint },
          },
          login: { loading: "" },
        },
      });
    };

    it("prefills the username from a full address", () => {
      renderWithHint("user1@example.com");

      expect(fieldOf("Username")).toHaveValue("user1@example.com");
    });

    it("prefills the username from a bare local part", () => {
      // A hint need not carry a domain; the local part alone identifies a user
      // in a directory-backed deployment.
      renderWithHint("user1");

      expect(fieldOf("Username")).toHaveValue("user1");
    });

    it("prefills the username from a name which is not ASCII", () => {
      // The reason the check is hand-written rather than an RFC 5322 grammar:
      // RFC atext is ASCII only, so a strict implementation refuses these, and
      // they are ordinary identities for this deployment.
      renderWithHint("müller@example.com");

      expect(fieldOf("Username")).toHaveValue("müller@example.com");
    });

    it("prefills the username from a bare name which is not ASCII", () => {
      renderWithHint("jörg.schmidt");

      expect(fieldOf("Username")).toHaveValue("jörg.schmidt");
    });

    it("ignores a hint whose domain has no top level part", () => {
      // A domain has to carry a dot, so user@corp does not prefill. This matches
      // what the previous implementation did.
      renderWithHint("user@corp");

      expect(fieldOf("Username")).toHaveValue("");
    });

    it("ignores a hint which cannot be an identity", () => {
      renderWithHint("not a name");

      expect(fieldOf("Username")).toHaveValue("");
    });

    it("ignores a hint carrying more than one at sign", () => {
      renderWithHint("a@b@c");

      expect(fieldOf("Username")).toHaveValue("");
    });

    it("ignores a malformed address", () => {
      renderWithHint("user..name@example.com");

      expect(fieldOf("Username")).toHaveValue("");
    });

    it("prefills the username from an international domain", () => {
      // Accepted as typed. The conversion to ASCII happens on submit, not here,
      // so the field shows the visitor what they were sent.
      renderWithHint("user@münchen.de");

      expect(fieldOf("Username")).toHaveValue("user@münchen.de");
    });

    it("leaves the field empty when no hint is given", () => {
      renderWithHint();

      expect(fieldOf("Username")).toHaveValue("");
    });
  });

  describe("an existing session", () => {
    /*
     * The mount effect decides where a visitor who already has a session goes.
     * With select_account in the prompt they pick an account rather than being
     * advanced onwards, and the parameters of the flow live in the URL, so the
     * query and the fragment have to survive that redirect.
     */
    const renderSignedIn = (arrival: TestArrival, prompt?: string) =>
      renderWithProviders(<Subject />, {
        ...arrival,
        preloaded: {
          common: {
            hello: { state: true, username: "u", displayName: "D", details: {} },
            branding: null,
            query: prompt === undefined ? {} : { prompt },
          },
          login: { loading: "" },
        },
      });

    it("sends the visitor to the account chooser when the request asks to select an account", () => {
      const { nav } = renderSignedIn(arriveAt("/identifier?flow=oidc&client_id=abc#frag"), "select_account");

      expect(nav.location.pathname).toBe("/chooseaccount");
      expect(nav.location.search).toBe("?flow=oidc&client_id=abc");
      expect(nav.location.hash).toBe("#frag");
      // It replaces rather than pushes, so going back cannot return here.
      expect(nav.entries.length).toBe(1);
    });

    it("leaves the form alone when the visitor navigated here themselves", () => {
      // A PUSH is a deliberate in-app navigation onto the form, so an existing
      // session must not bounce the visitor straight back out of it.
      const { nav } = renderSignedIn(arriveAt("/identifier?flow=oidc#frag", "PUSH"), "select_account");

      expect(nav.location.pathname).toBe("/identifier");
    });
  });

  describe("submitting an international domain", () => {
    /*
     * The backends behind this expect a domain in its IDNA form, so the domain is
     * encoded before the username goes on the wire. The local part is untouched:
     * punycode covers domain labels only.
     */
    const submit = async (username: string) => {
      renderLogin();
      await userEvent.type(fieldOf("Username"), username);
      await userEvent.type(fieldOf("Password"), "secret123{Enter}");
      await waitFor(() => expect(logonBodies()).toHaveLength(1));

      return logonBodies()[0].params;
    };

    it("encodes an international domain to ASCII", async () => {
      expect(await submit("user@münchen.de")).toEqual(["user@xn--mnchen-3ya.de", "secret123", "1"]);
    });

    it("encodes every label of a subdomain", async () => {
      expect(await submit("user@sub.münchen.de")).toEqual(["user@sub.xn--mnchen-3ya.de", "secret123", "1"]);
    });

    it("leaves a local part which is not ASCII alone", async () => {
      // Punycode applies to the domain. A UTF-8 local part goes as it was typed,
      // exactly as it did before.
      expect(await submit("müller@example.com")).toEqual(["müller@example.com", "secret123", "1"]);
    });

    it("sends an address which is already ASCII unchanged", async () => {
      expect(await submit("user1@example.com")).toEqual(["user1@example.com", "secret123", "1"]);
    });

    it("sends a username with no domain unchanged", async () => {
      expect(await submit("user1")).toEqual(["user1", "secret123", "1"]);
    });
  });
});
