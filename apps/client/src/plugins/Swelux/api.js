// The swelux.ai calls the plugin makes. With `apiKey`, Hajk calls swelux.ai
// directly and the key identifies the map. Without it, the calls go to Hajk's
// own origin, where a gateway adds the signed-in user's token.

import { STANDARD_ID } from "./utils";

// The header that carries a map key.
const MAP_KEY_HEADER = "X-Swelux-Map-Key";

export default class SweluxApi {
  #options;
  #resolve;
  #photometry = new Map(); // luminaire id -> Promise, cached per luminaire

  /**
   * `resolve(url)` fills in "{tenantId}" with the organisation the map shows.
   */
  constructor(options, resolve) {
    this.#options = options;
    this.#resolve = resolve;
  }

  // Base of the organisation's map API.
  get #apiBase() {
    return this.#resolve(
      this.#options.apiBase || "/api/v1/organisations/{tenantId}/map"
    );
  }

  #keyHeaders = () =>
    this.#options.apiKey ? { [MAP_KEY_HEADER]: this.#options.apiKey } : {};

  #request = async (url, init = {}) => {
    const res = await fetch(url, {
      credentials: "same-origin",
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...this.#keyHeaders(),
      },
    });
    if (res.status === 401) {
      throw new Error(
        this.#options.apiKey
          ? "Kartans nyckel till swelux.ai godtogs inte. Kontakta kartans administratör."
          : "Din inloggning har gått ut. Ladda om sidan och logga in igen."
      );
    }
    if (res.status === 429) {
      throw new Error(
        "Kartan har nått sin gräns för beräkningar just nu. Försök igen senare."
      );
    }
    const body = await res.json().catch(() => null);
    if (res.ok && body === null) {
      // Not JSON: the URL reaches something other than swelux.ai.
      throw new Error(
        "Beräkningstjänsten svarade inte som väntat. Kontrollera verktygets adresser till swelux.ai."
      );
    }
    if (!res.ok) {
      // The platform answers with RFC 9457 problem details.
      throw new Error(
        body?.detail ||
          body?.title ||
          body?.error ||
          `Beräkningstjänsten svarade ${res.status}`
      );
    }
    return body;
  };

  #mapApi = (path, init) => this.#request(`${this.#apiBase}${path}`, init);

  /** GET a configured URL (such as `contextUrl`), with "{tenantId}" filled in. */
  get = (url) => this.#request(this.#resolve(url));

  fetchLuminaires = () => this.#mapApi("/luminaires");

  /** The EN 13201 lighting classes, with their requirements. */
  fetchLightingClasses = async () => {
    const standards = await this.#request(
      this.#options.standardsUrl || "/api/v1/standards"
    );
    const standard =
      standards.find((s) => s.standard.id === STANDARD_ID) || standards[0];
    return standard ? standard.lightingClasses : [];
  };

  /** Dry road surfaces (CIE R-tables); a wet table is not a street's surface on its own. */
  fetchRoadSurfaces = async () => {
    const surfaces = await this.#request(
      this.#options.roadSurfacesUrl || "/api/v1/road-surfaces"
    );
    return surfaces.filter((s) => s.condition !== "Wet");
  };

  /** What the engine reads from a luminaire's photometric file. Ids are opaque strings. */
  fetchPhotometry = (luminaireId) => {
    const key = String(luminaireId);
    if (!this.#photometry.has(key)) {
      const req = this.#mapApi(
        `/luminaires/${encodeURIComponent(key)}/photometry`
      );
      req.catch(() => this.#photometry.delete(key));
      this.#photometry.set(key, req);
    }
    return this.#photometry.get(key);
  };

  /**
   * The engine's verdict for the street and placement (the platform's own
   * shapes) with each luminaire, ranked; `null` calculates the whole catalogue.
   */
  evaluate = (
    { street, placement },
    luminaireIds = null,
    manufacturerIds = null
  ) =>
    this.#mapApi("/evaluations", {
      method: "POST",
      body: JSON.stringify({
        street,
        placement,
        luminaireIds,
        ...(manufacturerIds ? { manufacturerIds } : {}),
      }),
    });
}
