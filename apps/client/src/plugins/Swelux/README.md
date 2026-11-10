## The Swelux plugin

Street lighting calculations according to EN 13201 for the light points in the map. A user clicks a light point, the plugin selects the street it belongs to, and the [swelux.ai](https://swelux.ai) calculation engine says whether a luminaire meets the street's lighting class, or ranks a catalogue of luminaires against it.

The plugin is the map side only. The calculations and the luminaire catalogue come from swelux.ai, which identifies the map by a key. The light points are the municipality's own layer, or can be hosted in swelux.ai.

### Maintainer

Anoop Mathew, Kognitiv: [anoop@kognitiv.se](mailto:anoop@kognitiv.se). Questions, bug reports and keys for a map go here.

### How it works

1. Click a light point, or search for a street. Every point with the same street id is selected and highlighted.
2. The street and placement are pre-filled. Spacing is estimated from the light points (the median distance to the nearest neighbour, measured in the map's own projection), light centre height and outreach come from the register where plausible, and the rest from `defaultProfile`. Everything can be edited.
3. Choose a luminaire and press **Beräkna**, or press **Hitta bästa armatur** to calculate the whole catalogue. The window shows the engine's verdict with each metric of the lighting class, the ranking, luminaires that could not be calculated and why, and the energy use against today's wattage.

### Trying it out

`sample/light-points.geojson` holds made-up light points along seven real streets on Hisingen, Göteborg (street geometry © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors; the poles, luminaires and wattages are invented). Serve it from anywhere the map can reach (for example the client's `public` folder), add it as a vector layer and add the tool with the demo key:

```json
{
  "id": "swelux-ljuspunkter",
  "caption": "Ljuspunkter",
  "url": "/swelux-sample/light-points.geojson",
  "dataFormat": "GeoJSON",
  "projection": "EPSG:4326",
  "loadingStrategy": "all"
}
```

```json
{
  "type": "swelux",
  "options": {
    "target": "left",
    "lightPointLayerId": "swelux-ljuspunkter",
    "apiKey": "<demo key>",
    "tenantId": "<demo organisation id>",
    "apiBase": "https://swelux.ai/api/v1/organisations/{tenantId}/map",
    "standardsUrl": "https://swelux.ai/api/v1/standards",
    "roadSurfacesUrl": "https://swelux.ai/api/v1/road-surfaces",
    "fitToData": true
  }
}
```

The demo key is shared, has a daily quota and may change. A map in use gets its own key: ask the maintainer. The key sits in the browser here, which is fine for trying the plugin; for a map in use, keep it in Hajk's backend (below).

### Light points

The light points must be a vector layer (GeoJSON or WFS) that has all of a street's points, so `"loadingStrategy": "all"` is the safest. A WMS layer won't do: the browser only gets a picture of it, and the plugin says so in its window. Any projection works.

The plugin reads these properties: `id`, `streetId` (empty when the point belongs to no street), `street` (the street's name), `area`, `poleId`, `existingLuminaire`, `existingManufacturer`, `existingWattage` (W), `poleHeight` and `armLength` (m). Only `streetId` and `street` are needed; the others improve the pre-filled values. A layer with its own names maps them with `properties`:

```json
"properties": { "streetId": "GATU_ID", "street": "GATUNAMN", "poleHeight": "STOLPHOJD" }
```

### Options

| Option                  | Default                                | Description                                                                                                                                                 |
| ----------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lightPointLayerId`     |                                        | The `id` of the light point layer. Required.                                                                                                                |
| `apiKey`                |                                        | The map's key, sent from the browser as the `X-Swelux-Map-Key` header. Leave it out when Hajk's backend proxy adds the key (see below).                     |
| `tenantId`              |                                        | The organisation's id in swelux.ai. Replaces `{tenantId}` in `apiBase`, `streetsUrl` and `contextUrl`.                                                      |
| `apiBase`               | `/api/v1/organisations/{tenantId}/map` | Base of the organisation's map API.                                                                                                                         |
| `standardsUrl`          | `/api/v1/standards`                    | Lighting classes.                                                                                                                                           |
| `roadSurfacesUrl`       | `/api/v1/road-surfaces`                | Road surfaces.                                                                                                                                              |
| `properties`            |                                        | The layer's own names for the light point properties.                                                                                                       |
| `streetsUrl`            |                                        | Street centrelines as GeoJSON (`streetId`, `street`, in WGS 84), to highlight the lit stretches of the street. Without it, only the points are highlighted. |
| `contextUrl`            |                                        | The organisation's name and light point count, shown in the window.                                                                                         |
| `fitToData`             | `false`                                | Zoom the map to the light points once they have loaded.                                                                                                     |
| `defaultProfile`        |                                        | The street and placement to start from, in swelux.ai's terms. The road surface is given by name (`roadSurface`) or by id (`roadSurfaceId`).                 |
| `defaultManufacturers`  |                                        | Names of the manufacturers selected at first; the user can choose others, and the choice is remembered in the browser. Without it, all are selected.        |
| `operatingHoursPerYear` | `4000`                                 | Used for the yearly energy figures.                                                                                                                         |
| `tenantIdCookie`        |                                        | Instead of `tenantId`: the name of a cookie holding the organisation's id, for a sign-in gateway that lets the user pick an organisation.                   |

`defaultProfile` looks like this:

```json
{
  "street": {
    "lightingClass": "M4",
    "width": 7,
    "laneCount": 2,
    "roadSurface": "CIE R3",
    "maintenanceFactor": 0.9,
    "averageLuminanceCoefficient": null
  },
  "placement": {
    "arrangement": "OneSide",
    "spacing": 32,
    "lightCentreHeight": 8,
    "outreach": 0.5,
    "tiltDegrees": 5
  }
}
```

### The key: in Hajk's backend, or in the browser

swelux.ai knows a map by its key. There are two ways to give it:

**Through Hajk's backend proxy (recommended).** The key stays on the server, and whoever may reach your Hajk (for example through your own login) may calculate. In the backend's `.env`:

```
PROXY_SWELUX=https://swelux.ai/api/v1
PROXY_SWELUX_USER=<your organisation, any label>
PROXY_SWELUX_PASSWORD=<the map key>
```

and in the tool's options, no `apiKey`, with the addresses pointing at the proxy:

```json
"tenantId": "<the organisation's id in swelux.ai>",
"apiBase": "/api/v2/proxy/swelux/organisations/{tenantId}/map",
"standardsUrl": "/api/v2/proxy/swelux/standards",
"roadSurfacesUrl": "/api/v2/proxy/swelux/road-surfaces"
```

Hajk's proxy sends the key as HTTP Basic credentials. As with any `PROXY_*` with a service account, it applies the key to every request through the proxy, so protect the proxy the way you protect the map.

**In the browser, with `apiKey`.** The plugin sends the key in the `X-Swelux-Map-Key` header, straight to swelux.ai. Simple, and right for trying the plugin or for a public map, but anyone can copy the key from the page. swelux.ai accepts a browser key only from the map's own address, but a script can still use it within its quota.

Either way, swelux.ai limits each key's calculations per day and can revoke it.

### Calls to swelux.ai

Relative to `apiBase`:

| Endpoint                          | Purpose                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /luminaires`                 | The luminaires the map may use                                                               |
| `POST /evaluations`               | `{ street, placement, luminaireIds }` (`null` for the whole catalogue): the verdicts, ranked |
| `GET /luminaires/{id}/photometry` | Key figures and intensity curves of a luminaire, for its diagram                             |

### Tests

From `apps/client`:

```bash
node --test src/plugins/Swelux/tests/*.test.mjs
```

### Limitations

- The user interface is in Swedish only.
- Calculations cover existing streets with one lighting class; new streets come later.
