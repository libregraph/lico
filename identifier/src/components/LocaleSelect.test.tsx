import { I18nextProvider, initReactI18next } from "react-i18next";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18next, { type i18n as I18nInstance } from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import allLocales from "../locales";
import { setTestLanguages } from "../test-utils";
import LocaleSelect from "./LocaleSelect";

/*
 * The closed select is queried as a combobox, not a button. MUI reports the
 * role a select actually has, which is what a reader of these queries should
 * expect rather than the button the v4 markup used to claim.
 */

/*
 * These tests build their own i18next instance rather than using the shared one,
 * so that supportedLngs and fallbackLng match what src/i18n.ts configures in
 * production. The locale the component settles on has to be right against that
 * configuration, not against a permissive test one.
 */
function newProductionLikeI18n(lng: string): I18nInstance {
  const instance = i18next.createInstance();
  instance
    .use(new LanguageDetector())
    .use(initReactI18next)
    .init({
      lng,
      fallbackLng: "en-GB",
      supportedLngs: allLocales.map((locale) => locale.locale),
      resources: {},
      initImmediate: false,
      interpolation: { escapeValue: false },
      detection: { order: ["navigator"], caches: [] },
    });
  return instance;
}

function renderSelect(instance: I18nInstance, locales?: string[]) {
  return render(
    <I18nextProvider i18n={instance}>
      <LocaleSelect locales={locales} />
    </I18nextProvider>,
  );
}

// Filtering keeps the order of src/locales, so 'de' is the first of this pair.
const deAndFr = ["de", "fr"];

let restoreLanguages: () => void;

describe("LocaleSelect", () => {
  beforeEach(() => {
    restoreLanguages = setTestLanguages(["en-US", "en"]);
  });

  afterEach(() => {
    restoreLanguages();
  });

  it("renders one menu item per enabled locale, labelled with its native name", async () => {
    const instance = newProductionLikeI18n("de");

    renderSelect(instance, deAndFr);
    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Deutsch", "Français"]);
  });

  it("drops a requested locale the application does not ship", async () => {
    const instance = newProductionLikeI18n("de");

    renderSelect(instance, ["de", "fr", "kl"]);
    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option")).toHaveLength(2);
  });

  it("renders nothing when only a single locale is enabled", () => {
    const instance = newProductionLikeI18n("de");

    const { container } = renderSelect(instance, ["de"]);

    expect(container).toBeEmptyDOMElement();
  });

  it("offers every shipped locale when no list is given", async () => {
    const instance = newProductionLikeI18n("de");

    renderSelect(instance);
    await userEvent.click(screen.getByRole("combobox"));

    expect(screen.getAllByRole("option")).toHaveLength(allLocales.length);
  });

  it("picks the locale which best matches the browser rather than the first one offered", async () => {
    // The browser asks for Swiss French, which is not offered verbatim. 'de' is
    // the first entry of the enabled list, so a "take the first" implementation
    // would land there. Only a real best-match lookup arrives at 'fr'.
    setTestLanguages(["fr-CH", "fr"]);
    const instance = newProductionLikeI18n("en-GB");

    renderSelect(instance, deAndFr);

    await waitFor(() => expect(instance.language).toBe("fr"));
    expect(instance.language).not.toBe("de");
    expect(screen.getByRole("combobox")).toHaveTextContent("Français");
  });

  it("falls back to the first enabled locale when no browser language matches", async () => {
    setTestLanguages(["ja-JP", "ja"]);
    const instance = newProductionLikeI18n("en-GB");

    renderSelect(instance, deAndFr);

    await waitFor(() => expect(instance.language).toBe("de"));
    expect(screen.getByRole("combobox")).toHaveTextContent("Deutsch");
  });

  it("does not adopt a locale the branding disabled, even one the app ships", async () => {
    // Italian is among the shipped locales but not among the enabled ones. It
    // must not win, however much the browser prefers it.
    setTestLanguages(["it-IT", "it"]);
    const instance = newProductionLikeI18n("en-GB");

    renderSelect(instance, deAndFr);

    await waitFor(() => expect(instance.language).toBe("de"));
    expect(instance.language).not.toBe("it");
    expect(screen.getByRole("combobox")).toHaveTextContent("Deutsch");
  });

  it("renders nothing and keeps the language when no enabled locale is shipped", async () => {
    // The branding may name only locales this build does not carry, in which
    // case filtering leaves an empty list and there is nothing to choose.
    setTestLanguages(["it-IT", "it"]);
    const instance = newProductionLikeI18n("en-GB");

    const { container } = renderSelect(instance, ["kl", "wa"]);

    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(instance.language).toBe("en-GB"));
  });

  it("keeps the current language when it is among the enabled locales", async () => {
    setTestLanguages(["fr-CH", "fr"]);
    const instance = newProductionLikeI18n("de");

    renderSelect(instance, deAndFr);

    // The browser prefers French, but German is already active and enabled, so
    // an earlier explicit choice must not be overridden.
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveTextContent("Deutsch"));
    expect(instance.language).toBe("de");
  });

  it("switches the language when the user picks another locale", async () => {
    const instance = newProductionLikeI18n("de");

    renderSelect(instance, deAndFr);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "Français" }));

    await waitFor(() => expect(instance.language).toBe("fr"));
    expect(screen.getByRole("combobox")).toHaveTextContent("Français");
  });
});
