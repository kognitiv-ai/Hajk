# Hajk + swelux

This fork of [Hajk](https://github.com/hajkmap/Hajk) adds **Swelux**, a plugin that runs EN 13201 street lighting calculations from the light points in the map, using the [swelux.ai](https://swelux.ai) calculation engine.

- **Plugin:** `apps/client/src/plugins/Swelux/`. A standard Hajk window plugin, registered in `AVAILABLE_TOOLS` and `appConfig*.json`.
- **Core change:** `ConfigMapper.mapVectorConfig` now passes `loadingStrategy` through, so a static GeoJSON vector layer can load once (`"loadingStrategy": "all"`) instead of on every pan.
- **Demo deployment:** this folder. Hajk sits behind an nginx gateway that requires a swelux.ai login.

## How the plugin works

1. Click a light point in the configured vector layer (`lightPointLayerId`). Every point with the same `streetId` is selected and highlighted, together with the street's centrelines from `streetsUrl`.
2. The street and its poles are pre-filled in the platform's terms: a street (`lightingClass`, `width`, `laneCount`, `roadSurfaceId`, `maintenanceFactor`, `averageLuminanceCoefficient`) and a placement (`arrangement` OneSide/Staggered/Opposite/Central, `spacing`, `lightCentreHeight`, `outreach`, `tiltDegrees`). Spacing is estimated from the light points (median nearest-neighbour distance); light centre height and outreach come from the register's `poleHeight` and `armLength` where plausible; the rest from `defaultProfile`. Lighting classes come from the platform's EN 13201 standard and road surfaces from its catalogue. Everything can be edited.
3. Choose one luminaire and press **Beräkna**, or **Hitta bästa armatur** to calculate the organisation's whole catalogue. The window shows the calculation engine's verdict with each of the class's metrics (value, requirement, status), the platform's ranking (compliant first, then power per kilometre), luminaires that could not be calculated and why, and the energy difference against today's wattage.
4. **Detaljer** shows the road from above as the engine calculated it (rows, arms, and the calculation field coloured by luminance or illuminance), the metrics per observer, the light distribution, and exports: the photometric file, a DIALux evo exchange file (format v2, with the platform street, placement, street design and luminaire) and print/PDF.

Calls go to the [swelux.ai platform](https://swelux.ai) map API of one organisation, `apiBase` (default `/api/v1/organisations/{tenantId}/map`):

| Endpoint | Purpose |
| --- | --- |
| `GET /context` | Organisation name, light point count, whether the user can switch organisation |
| `GET /light-points` | Light points as GeoJSON (normally loaded by Hajk as a vector layer) |
| `GET /streets` | Street centrelines as GeoJSON (`streetId`, `street`), for the highlight |
| `GET /luminaires` | The organisation's luminaires |
| `POST /evaluations` | `{ street, placement, luminaireIds }` (max 50, or `null` for the whole catalogue) → the engine's verdicts, ranked |
| `POST /evaluations/detail` | `{ street, placement, luminaireId }` → the street design and the engine's whole assessment, with grids |
| `GET /luminaires/{id}/photometry` | Polar curves and key figures of the photometric file |
| `GET /luminaires/{id}/photometric-file` | The luminaire's photometric file |

Plus the shared reference data `GET /api/v1/standards` (lighting classes; `standardsUrl`) and `GET /api/v1/road-surfaces` (`roadSurfacesUrl`).

Luminaire ids are GUID strings. `{tenantId}` in `apiBase`, `streetsUrl` and `contextUrl` is replaced by the organisation id: the `tenantId` option, or the value of the cookie named by `tenantIdCookie`. Requests are same-origin with cookies; the gateway adds the user's access token, so the browser never holds an API key.

### Tool options (`map_1.json`)

```json
{
  "type": "swelux",
  "options": {
    "target": "left",
    "apiBase": "/api/v1/organisations/{tenantId}/map",
    "tenantIdCookie": "swelux_tenant",
    "lightPointLayerId": "swelux-ljuspunkter",
    "streetsUrl": "/api/v1/organisations/{tenantId}/map/streets",
    "contextUrl": "/api/v1/organisations/{tenantId}/map/context",
    "fitToData": true,
    "defaultProfile": {
      "street": { "lightingClass": "M4", "width": 7, "laneCount": 2, "roadSurface": "CIE R3",
                  "maintenanceFactor": 0.9, "averageLuminanceCoefficient": null },
      "placement": { "arrangement": "OneSide", "spacing": 32, "lightCentreHeight": 8,
                     "outreach": 0.5, "tiltDegrees": 5 }
    },
    "operatingHoursPerYear": 4100
  }
}
```

The default road surface is given by name (`roadSurface`, as listed by `GET /api/v1/road-surfaces`) or by id (`roadSurfaceId`).

Light point features need these properties: `id`, `streetId` (null when the point belongs to no street), `street` (display name), `area`, `poleId`, `existingLuminaire`, `existingManufacturer`, `existingWattage` (W), `poleHeight` and `armLength` (m).

`tenantId` (a fixed organisation id) or `tenantIdCookie` (the cookie a sign-in gateway sets when the user picks an organisation) fills in `{tenantId}`. `streetsUrl`, `contextUrl` and `fitToData` are optional. In a municipality's own Hajk, set `tenantId`, point `lightPointLayerId` at their light point layer and leave the others out. `contextUrl` returns the organisation's name for the window footer and whether the user can switch. `fitToData` zooms the map to the light points once they have loaded.

## Demo deployment

```
swelux/
├── docker-compose.yml          hajk (built from this repo) + gateway (nginx)
├── gateway/
│   ├── default.conf.template   auth_request gate, platform proxy, read-only Hajk
│   └── login/                  login page (e-mailed code) and session.js (token renewal)
├── hajk/App_Data/              map and layer config, mounted into Hajk
└── deploy.sh                   pull, build and restart on the server
```

`swelux/.env` on the server is optional. It can set:

| Variable | Default | |
| --- | --- | --- |
| `GATEWAY_PORT` | `8092` | Host port the tunnel or reverse proxy points at |
| `SWELUX_PLATFORM_UPSTREAM` | `http://swelux-platform:8080` | The swelux-platform API, as the gateway reaches it |
| `SWELUX_NETWORK` | `lightwise-studio_lightwise-network` | External Docker network the platform container is on |

The platform must list the gateway's public origin (e.g. `https://hajk-beta.swelux.ai`) among its trusted origins (`Cors:AllowedOrigins`), or renewing the session and signing out are refused.

### Signing in

Sign-in is the platform's own, with a one-time code by e-mail:
1. `/login` asks for the e-mail address and sends a code (`POST /api/v1/sessions/codes`). An address without an account, or a deactivated account, gets a message saying so.
2. The 6-digit code (`POST /api/v1/sessions`) returns a 15-minute access token, and the platform sets its refresh cookie (`swelux_refresh`, HttpOnly, `Path=/api/v1/sessions`). The gateway proxies `/api/v1/sessions*` on the Hajk origin, so that cookie is first-party.
3. The login page stores the access token in the `swelux_token` cookie (and its expiry in `swelux_token_expires`). Hajk loads the light point layer without custom headers, so nginx turns the cookie into the `Authorization` header.
4. `session.js`, injected into Hajk's page by the gateway, renews the token about two minutes before it expires (`POST /api/v1/sessions/refresh`) and rewrites the cookie. When the session has ended it sends the user to `/login?next=…`. A user who comes back after the token expired is signed in again silently with the refresh cookie.
5. `/logout` signs out on the platform (`DELETE /api/v1/sessions/current`) and clears the cookies.

### Organisations and map data

One deployment serves every organisation:
- After sign-in the user picks an organisation from `GET /api/v1/me/map-organisations`. A user with a single organisation skips the picker, the last picked one opens straight away, and platform administrators can pick any organisation with light points. The organisation's id is stored in the `swelux_tenant` cookie.
- `/login?tenant=<id or slug>` opens a specific organisation directly, and `/login?switch` shows the picker again.
- The map shows the organisation's light points. Hajk's vector layer loads them from `/swelux-map/light-points`, which the gateway maps to `/api/v1/organisations/<swelux_tenant>/map/light-points` because a layer URL cannot change at runtime.

Platform administrators upload an organisation's light points (swelux CSV or GeoJSON) in the swelux.ai admin app. A new upload replaces the previous one.

Access rules:
- Every request passes `auth_request`, which calls `GET /api/v1/organisations/<swelux_tenant>/map/access` on the platform (204 = allowed). The result is cached for 60 s per token and organisation.
- Users who aren't signed in, or who haven't picked an organisation they may open, are redirected to `/login`.
- Only the sign-in routes, `/api/v1/me`, `/api/v1/me/map-organisations`, `GET /api/v1/standards` and `GET /api/v1/road-surfaces` (behind the gate) and the picked organisation's map routes are proxied (`GET`, plus `POST` for the two evaluation routes). Map calls naming another organisation, and everything else under `/api/v1`, get 404; Hajk's own `/api/v2` goes to Hajk behind the gate.
- Hajk admin is not exposed, and Hajk only accepts `GET`.
- No municipality data is stored in this repository or on the Hajk host.
