import { DEFAULT_PATH_PREFIX, readBackgroundImage, readPathPrefix, readSignInRequest } from "./request";

/* Stands in for the element identifier.go substitutes the prefix into. */
function root(pathPrefix: string | null): Element | null {
  if (pathPrefix === null) {
    return null;
  }
  const element = document.createElement("div");
  element.setAttribute("data-path-prefix", pathPrefix);
  return element;
}

describe("readSignInRequest", () => {
  it("takes the flow out of the query, because it has a field of its own", () => {
    const request = readSignInRequest("?flow=oidc&client_id=playground&scope=openid");

    expect(request.flow).toBe("oidc");
    expect(request.query).toEqual({ client_id: "playground", scope: "openid" });
  });

  it("reports no flow rather than undefined when the request names none", () => {
    // Every reader compares this against the flows it knows, so an absent one
    // has to be a value they can compare.
    const request = readSignInRequest("?client_id=playground");

    expect(request.flow).toBe("");
    expect(request.query).toEqual({ client_id: "playground" });
  });

  it("reads an empty query from an empty search string", () => {
    const request = readSignInRequest("");

    expect(request.query).toEqual({});
    expect(request.flow).toBe("");
  });

  it("hands back an array for a repeated parameter, which the type does not admit", () => {
    /*
     * query-string returns an array for a repeat and the map is typed as
     * strings, so this is the one place the shape is asserted rather than
     * checked. It holds because the OIDC request parameters are single valued;
     * this test is here so that the day one of them repeats, the hazard is
     * already written down rather than discovered in a reader.
     */
    const request = readSignInRequest("?prompt=none&prompt=consent");

    expect(request.query.prompt).toEqual(["none", "consent"]);
  });
});

describe("readPathPrefix", () => {
  it("keeps the prefix the server substituted", () => {
    expect(readPathPrefix(root("/id"))).toBe("/id");
  });

  it("falls back to the default when the placeholder was not substituted", () => {
    // The server replaces __PATH_PREFIX__ in index.html. A dev server does not,
    // and passing the literal through would put it in every route.
    expect(readPathPrefix(root("__PATH_PREFIX__"))).toBe(DEFAULT_PATH_PREFIX);
  });

  it("falls back to the default when the element carries none", () => {
    expect(readPathPrefix(root(""))).toBe(DEFAULT_PATH_PREFIX);
  });

  it("falls back to the default when there is no element at all", () => {
    expect(readPathPrefix(null)).toBe(DEFAULT_PATH_PREFIX);
  });
});

describe("readBackgroundImage", () => {
  /* Stands in for the same element, carrying the other attribute. */
  const withImage = (name: string | null): Element | null => {
    if (name === null) {
      return null;
    }
    const element = document.createElement("div");
    element.setAttribute("data-background-image", name);
    return element;
  };

  it("names the image a deployment dropped in", () => {
    expect(readBackgroundImage(withImage("background.png"))).toBe("background.png");
  });

  it("reports none when the server substituted an empty value", () => {
    // Which is what it writes when no such file is beside the deployment.
    expect(readBackgroundImage(withImage(""))).toBeNull();
  });

  it("reports none when the placeholder was not substituted", () => {
    // A dev server leaves it alone, and treating the literal as a filename
    // would ask for an image by that name and paint nothing until it 404s.
    expect(readBackgroundImage(withImage("__BACKGROUND_IMAGE__"))).toBeNull();
  });

  it("reports none when the element carries no such attribute", () => {
    expect(readBackgroundImage(document.createElement("div"))).toBeNull();
  });

  it("reports none when there is no element at all", () => {
    expect(readBackgroundImage(null)).toBeNull();
  });
});
