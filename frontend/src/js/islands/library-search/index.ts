import { API_PREFIX } from "../../config/api-constants.js";
import { APP_EVENTS } from "../../contracts/app-contract.js";
import { RECENT_JOBS_IDS } from "../../components/dialogs/recent-jobs-dialog-dom-contract.js";
import { fetchDocumentList, patchDocument } from "../../api/documents.js";
import { searchLibrary } from "../../api/search.js";
import type { MockDocumentPatch } from "../../mock/documents.js";

/** Anchor payload used to open the reader from a search hit / document row. */
export interface LibrarySearchAnchor {
  job_id?: string;
  document_id?: string;
  page_idx?: number;
  block_id?: string;
  [key: string]: unknown;
}

export type LibrarySearchQuerySubscriber = (value: string) => void;

export interface LibrarySearchPorts {
  searchLibrary: (q: string) => Promise<{ hits?: LibrarySearchAnchor[] } | null | undefined>;
  fetchDocumentList: () => Promise<{ documents?: unknown[] } | null | undefined>;
  patchDocument: (documentId: string, payload: MockDocumentPatch) => Promise<unknown>;
  openReader: (anchor: LibrarySearchAnchor) => void;
  subscribeQuery: (subscriber: LibrarySearchQuerySubscriber) => () => void;
}

export interface LibrarySearchAppHandle {
  unmount: () => void;
}

// React Island Agreement(pilot):
// - Host is normal light-DOM Custom element,handles coupling with existing pages(Listen search box, dispatch contract event.);
// - React App dynamics import Lazy loading:First non-empty query triggers fetch.,node Test env no parse. JSX;
// - Data passed through ports injection, Not directly in component import api Layer.
class LibrarySearchIsland extends HTMLElement {
  querySubscribers: Set<LibrarySearchQuerySubscriber>;
  appPromise: Promise<LibrarySearchAppHandle | null> | null;
  searchInput: HTMLElement | null;
  handleInput: ((event: Event) => void) | null;

  connectedCallback() {
    if (this.dataset.mounted === "1") {
      return;
    }
    this.dataset.mounted = "1";
    this.querySubscribers = new Set();
    this.appPromise = null;
    this.searchInput = this.ownerDocument.getElementById(RECENT_JOBS_IDS.searchInput);
    this.handleInput = (event) => {
      const target = event?.target as HTMLInputElement | null;
      const value = `${target?.value || ""}`;
      if (value.trim()) {
        this.ensureApp();
      }
      this.querySubscribers.forEach((subscriber) => subscriber(value));
    };
    this.searchInput?.addEventListener("input", this.handleInput);
  }

  disconnectedCallback() {
    if (this.handleInput) {
      this.searchInput?.removeEventListener("input", this.handleInput);
    }
    this.querySubscribers?.clear();
  }

  buildPorts(): LibrarySearchPorts {
    const island = this;
    return {
      searchLibrary: (q) => searchLibrary(API_PREFIX, q),
      fetchDocumentList: () => fetchDocumentList(API_PREFIX),
      patchDocument: (documentId, payload) => patchDocument(API_PREFIX, documentId, payload),
      openReader: (anchor) => {
        const jobId = `${anchor?.job_id || ""}`.trim();
        if (!jobId) {
          return;
        }
        island.dispatchEvent(new CustomEvent(APP_EVENTS.openReaderRequested, {
          bubbles: true,
          detail: {
            jobId,
            documentId: `${anchor?.document_id || ""}`.trim(),
            pageIdx: anchor?.page_idx,
            blockId: `${anchor?.block_id || ""}`.trim(),
          },
        }));
      },
      subscribeQuery: (subscriber) => {
        island.querySubscribers.add(subscriber);
        const input = island.searchInput as HTMLInputElement | null;
        subscriber(`${input?.value || ""}`);
        return () => island.querySubscribers.delete(subscriber);
      },
    };
  }

  ensureApp() {
    if (!this.appPromise) {
      this.appPromise = import("./library-search-app.jsx")
        .then((module) => module.mountLibrarySearchApp(this, this.buildPorts()))
        .catch((error) => {
          this.appPromise = null;
          // node Test env resolution failed. JSX,Silent fallback here.;Browser build inlines this module
          console.error("library-search island Load failed", error);
          return null;
        });
    }
    return this.appPromise;
  }
}

// node --test Directly test some components in the environment. import HomeApp.jsx without setting up the full jsdom
// window(customElements undefined)Guards don't affect real browser behavior.——customElements
// In browser/jsdom always exist.
if (typeof customElements !== "undefined" && !customElements.get("library-search-island")) {
  customElements.define("library-search-island", LibrarySearchIsland);
}
