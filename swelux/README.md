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
    "lightPointLayerId": "hisingen-ljuspunkter",
    "streetsUrl": "/swelux-data/hisingen-gator.geojson",
    "defaultProfile": { "requiredClass": "M4", "roadWidthM": 7, "lanes": 1, "surfaceClass": "R3",
                        "spacingM": 32, "poleHeightM": 8, "armLengthM": 0.5, "tiltDeg": 5,
                        "arrangement": "single", "maintenanceFactor": 0.9 },
    "operatingHoursPerYear": 4100
  }
}
```

Light point features need these properties: `gatakey` (street key), `gata` (display name), `omrade`, `armatur`, `effekt_w`, `stolpe` and `id`.

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

On the server, `swelux/.env` sets:

```
SWELUX_TENANT=goteborg                 # tenant whose members may open the map
SWELUX_DATA_DIR=/root/swelux-hajk-data # municipality GeoJSON, never committed
GATEWAY_PORT=8092
```

Access rules:
- Every request passes `auth_request`, which calls `GET /api/Auth/check?tenant=…` on the swelux API. The result is cached for 60 s per token.
- Users who aren't signed in are redirected to `/login`.
- Hajk admin is not exposed, and Hajk only accepts `GET`.
- Municipality data (light points, street geometry) is served from `SWELUX_DATA_DIR` behind the same gate and is not part of this repository.
