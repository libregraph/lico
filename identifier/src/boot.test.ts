import { appHasMounted, loadBackgroundImage } from "./boot";

/*
 * The module holds one page's hand-off, so each case needs its own copy of it
 * along with the element it reports against.
 */
async function boot(): Promise<typeof import("./boot")> {
  document.body.innerHTML = '<div id="boot"></div>';
  vi.resetModules();
  return import("./boot");
}

/*
 * jsdom does not fetch, so an image left to itself never reports either way.
 * These stand in for the one the module creates, and deliver the outcome.
 */
class FakeImage {
  src = "";
  private readonly handlers: Record<string, () => void> = {};

  addEventListener(type: string, handler: () => void): void {
    this.handlers[type] = handler;
  }

  fire(type: "load" | "error"): void {
    this.handlers[type]?.();
  }
}

function captureImages(): FakeImage[] {
  const created: FakeImage[] = [];
  vi.stubGlobal(
    "Image",
    class extends FakeImage {
      constructor() {
        super();
        created.push(this);
      }
    },
  );
  return created;
}

/* The release is a frame away, so that the app paints under the layer first. */
function nextFrame(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  requestAnimationFrame(() => resolve());
  return promise;
}

function released(): boolean {
  return document.getElementById("boot")?.hasAttribute("data-done") ?? false;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the loading state", () => {
  it("stays up while the app has nothing to show yet", async () => {
    const { loadBackgroundImage: load } = await boot();

    load("/signin/v1", null);
    await nextFrame();

    // The page is ready but the chunk that draws the card is not, so lifting
    // here would swap a centred indicator for an empty page.
    expect(released()).toBe(false);
  });

  it("stays up while the background it would reveal is still arriving", async () => {
    const { appHasMounted: mounted, loadBackgroundImage: load } = await boot();
    captureImages();

    load("/signin/v1", "background.png");
    mounted();
    await nextFrame();

    expect(released()).toBe(false);
  });

  it("asks for the background under the prefix the webapp is served from", async () => {
    const { loadBackgroundImage: load } = await boot();
    const images = captureImages();

    load("/signin/v1", "background.png");

    expect(images[0].src).toBe("/signin/v1/static/background.png");
  });

  it("lifts once the app is up and the background has arrived", async () => {
    const { appHasMounted: mounted, loadBackgroundImage: load } = await boot();
    const images = captureImages();

    load("/signin/v1", "background.png");
    mounted();
    images[0].fire("load");
    await nextFrame();

    expect(released()).toBe(true);
  });

  it("lifts once the app is up when there is no background to wait for", async () => {
    const { appHasMounted: mounted, loadBackgroundImage: load } = await boot();

    load("/signin/v1", null);
    mounted();
    await nextFrame();

    expect(released()).toBe(true);
  });

  it("lifts when the app arrives after the background", async () => {
    const { appHasMounted: mounted, loadBackgroundImage: load } = await boot();

    // Reported in either order: whichever is later releases the page.
    load("/signin/v1", null);
    await nextFrame();
    mounted();
    await nextFrame();

    expect(released()).toBe(true);
  });

  it("lifts when a background cannot be fetched, rather than holding the page", async () => {
    const { appHasMounted: mounted, loadBackgroundImage: load } = await boot();
    const images = captureImages();

    load("/signin/v1", "background.png");
    mounted();
    images[0].fire("error");
    await nextFrame();

    expect(released()).toBe(true);
  });

  it("survives the repeated mount report StrictMode makes", async () => {
    const { appHasMounted: mounted, loadBackgroundImage: load } = await boot();

    load("/signin/v1", null);
    mounted();
    await nextFrame();
    mounted();
    await nextFrame();

    expect(released()).toBe(true);
  });

  it("does nothing when there is no such element, as in a bare tree", async () => {
    document.body.innerHTML = "";

    // The exported pair is imported once here to pin that neither reaches for
    // an element it has not checked for.
    expect(() => {
      loadBackgroundImage("/signin/v1", null);
      appHasMounted();
    }).not.toThrow();
  });
});
