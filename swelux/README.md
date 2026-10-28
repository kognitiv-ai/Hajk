# Hajk + swelux

This fork of [Hajk](https://github.com/hajkmap/Hajk) adds **Swelux**, a plugin that runs EN 13201 street lighting calculations from the light points in the map, using the [swelux.ai](https://swelux.ai) calculation engine.

- **Plugin:** `apps/client/src/plugins/Swelux/`. A standard Hajk window plugin, registered in `AVAILABLE_TOOLS` and `appConfig*.json`.
- **Core change:** `ConfigMapper.mapVectorConfig` now passes `loadingStrategy` through, so a static GeoJSON vector layer can load once (`"loadingStrategy": "all"`) instead of on every pan.
- **Demo deployment:** this folder. Hajk sits behind an nginx gateway that requires a swelux.ai login.

## How the plugin works

1. Click a light point in the configured vector layer (`lightPointLayerId`). Every point on the same street (`gatakey` property) is selected and highlighted, together with the street geometry from `streetsUrl`.
2. The road profile is pre-filled. Spacing is estimated from the light points (median nearest-neighbour distance); class, width and the other fields come from `defaultProfile`. Everything can be edited.
3. Choose one luminaire and press **Beräkna**, or **Hitta bästa armatur** to calculate the tenant's whole catalogue. The window shows pass/fail per requirement and the energy difference against today's wattage.

Calls go to `apiBase` (default `/swelux-api`) on the same origin:

| Endpoint | Purpose |
| --- | --- |
| `GET /street-lighting/luminaires` | The tenant's enabled luminaires |
| `POST /street-lighting/evaluate` | One road profile against `luminaireIds` (max 50), or the whole catalogue when omitted |

The gateway adds the user's token, so the browser never holds an API key.

### Tool options (`map_1.json`)

```json
{
  "type": "swelux",
  "options": {
    "target": "left",
    "apiBase": "/swelux-api",
    "lightPointLayerId": "swelux-ljuspunkter",
    "streetsUrl": "/swelux-api/hajk/streets",
    "contextUrl": "/swelux-api/hajk/context",
    "fitToData": true,
    "defaultProfile": { "requiredClass": "M4", "roadWidthM": 7, "lanes": 1, "surfaceClass": "R3",
                        "spacingM": 32, "poleHeightM": 8, "armLengthM": 0.5, "tiltDeg": 5,
                        "arrangement": "single", "maintenanceFactor": 0.9 },
    "operatingHoursPerYear": 4100
  }
}
```

Light point features need these properties: `gatakey` (street key), `gata` (display name), `omrade`, `armatur`, `effekt_w`, `stolpe` and `id`.

`streetsUrl`, `contextUrl` and `fitToData` are optional. In a municipality's own Hajk, point `lightPointLayerId` at their light point layer and leave them out. `contextUrl` returns the tenant's name for the window footer and whether the user can switch tenant. `fitToData` zooms the map to the light points once they have loaded.

## Demo deployment

```
swelux/
├── docker-compose.yml          hajk (built from this repo) + gateway (nginx)
├── gateway/
│   ├── default.conf.template   auth_request gate, API proxy, read-only Hajk
│   └── login/                  login page (swelux.ai accounts)
├── hajk/App_Data/              map and layer config, mounted into Hajk
└── deploy.sh                   pull, build and restart on the server
```

`swelux/.env` on the server is optional. It can set `GATEWAY_PORT` (default 8092) and `SWELUX_API_UPSTREAM`.

### Tenants and map data

One deployment serves every tenant:
- At login, the user picks a tenant (an organisation in swelux.ai). Users with a single tenant skip the picker, and platform admins can pick any tenant. The choice is stored in the `swelux_tenant` cookie.
- `/login?tenant=<slug>` opens a specific tenant directly, and `/login?switch` shows the picker again.
- The map shows the picked tenant's light points from `GET /api/hajk/lightpoints`, with street geometry from `GET /api/hajk/streets`.

Platform admins manage map data in swelux.ai under **Admin → Tenants**:
1. Upload the regular swelux CSV, or a GeoJSON point file, for a tenant.
2. The worker groups the points into streets and fetches each street's geometry from OpenStreetMap.
3. A new upload replaces the previous one.

Access rules:
- Every request passes `auth_request`, which calls `GET /api/Auth/check?tenant=<swelux_tenant>` on the swelux API. The result is cached for 60 s per token and tenant.
- Users who aren't signed in, or who haven't picked a tenant they belong to, are redirected to `/login`.
- Hajk admin is not exposed, and Hajk only accepts `GET`.
- No municipality data is stored in this repository or on the Hajk host.
