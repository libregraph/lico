/*
 * The hand-off from the loading state in index.html to the rendered app.
 *
 * That state is markup and CSS in the document, because it has to paint before
 * any of this has been fetched. It covers the app until two things are true,
 * and it is held for the later of them:
 *
 *   - the app has something to show. The card is in a lazily loaded chunk, so
 *     the entry chunk running is not the moment: revealing then would replace a
 *     centred indicator with an empty page for as long as that chunk takes.
 *   - the page it reveals is finished. A deployment's background is an image,
 *     and revealing before it has decoded would show the page's own colour and
 *     then let the image land on top of it.
 *
 * Both are one-way, so a caller may report either in any order, and reporting
 * twice is harmless: StrictMode mounts effects twice by design.
 */

const BOOT_ELEMENT_ID = "boot";

let appHasSomethingToShow = false;
let backgroundHasArrived = false;
let releasing = false;

function release(): void {
  if (releasing || !appHasSomethingToShow || !backgroundHasArrived) {
    return;
  }

  const layer = document.getElementById(BOOT_ELEMENT_ID);
  if (!layer) {
    // A tree mounted without the document, as in tests.
    return;
  }

  /*
   * Once only. A second pass would set an attribute that is already set and
   * then wait for a transition that has already ended, leaving the layer in
   * the document for good.
   */
  releasing = true;

  /*
   * A frame before the fade, so the app's first paint lands underneath the
   * layer rather than arriving during it.
   */
  requestAnimationFrame(() => {
    layer.addEventListener("transitionend", () => layer.remove(), { once: true });
    layer.setAttribute("data-done", "");
  });
}

/*
 * Fetches the background the theme is about to ask for, so that the wait for it
 * happens behind the loading state rather than in front of the visitor. Called
 * with no image when the page draws its own background, which is nothing to
 * wait for.
 *
 * A background that cannot be fetched must not hold the page hostage, so a
 * failure counts as arrival: the page then shows its own surface, which is what
 * a missing image leaves behind anyway.
 */
export function loadBackgroundImage(pathPrefix: string, backgroundImage: string | null): void {
  if (!backgroundImage) {
    backgroundHasArrived = true;
    release();
    return;
  }

  const arrived = () => {
    backgroundHasArrived = true;
    release();
  };

  const image = new Image();
  image.addEventListener("load", arrived, { once: true });
  image.addEventListener("error", arrived, { once: true });
  image.src = `${pathPrefix}/static/${backgroundImage}`;
}

/* Reported by the lazily loaded chunk that renders the card. */
export function appHasMounted(): void {
  appHasSomethingToShow = true;
  release();
}
