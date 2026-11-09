## The Swelux plugin

Street lighting calculations according to EN 13201 for the light points in the map. A user clicks a light point, the plugin selects the street it belongs to, and the [swelux.ai](https://swelux.ai) calculation engine says whether a luminaire meets the street's lighting class, or ranks a catalogue of luminaires against it.

The plugin is the map side only. The calculations and the luminaire catalogue come from swelux.ai, which the plugin calls with a key for the map. The light points are the municipality's own layer, or can be hosted in swelux.ai.

### Maintainer

Anoop Mathew, Kognitiv: [anoop@kognitiv.se](mailto:anoop@kognitiv.se). Questions, bug reports and keys for a map go here.

### How it works

1. Click a light point, or search for a street. Every point with the same street id is selected and highlighted.
2. The street and placement are pre-filled. Spacing is estimated from the light points (the median distance to the nearest neighbour, measured in the map's own projection), light centre height and outreach come from the register where plausible, and the rest from `defaultProfile`. Everything can be edited.
3. Choose a luminaire and press **Beräkna**, or press **Hitta bästa armatur** to calculate the whole catalogue. The window shows the engine's verdict with each metric of the lighting class, the ranking, luminaires that could not be calculated and why, and the energy use against today's wattage.

### Trying it out

`sample/light-points.geojson` holds made-up light points on two streets. Serve it from anywhere the map can reach (for example the client's `public` folder), add it as a vector layer and add the tool with the demo key:

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

The demo key is shared, has a small quota and a small catalogue, and may change. A map in use gets its own key: ask the maintainer.

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
| `apiKey`                |                                        | The map's key to swelux.ai, sent as the `X-Swelux-Map-Key` header. Without it, calls go to the map's own origin (see below).                                |
| `tenantId`              |                                        | The organisation's id in swelux.ai. Replaces `{tenantId}` in `apiBase`, `streetsUrl` and `contextUrl`.                                                      |
| `apiBase`               | `/api/v1/organisations/{tenantId}/map` | Base of the organisation's map API.                                                                                                                         |
| `standardsUrl`          | `/api/v1/standards`                    | Lighting classes.                                                                                                                                           |
| `roadSurfacesUrl`       | `/api/v1/road-surfaces`                | Road surfaces.                                                                                                                                              |
| `properties`            |                                        | The layer's own names for the light point properties.                                                                                                       |
| `streetsUrl`            |                                        | Street centrelines as GeoJSON (`streetId`, `street`, in WGS 84), to highlight the lit stretches of the street. Without it, only the points are highlighted. |
| `contextUrl`            |                                        | The organisation's name and light point count, shown in the window.                                                                                         |
| `fitToData`             | `false`                                | Zoom the map to the light points once they have loaded.                                                                                                     |
| `defaultProfile`        |                                        | The street and placement to start from, in swelux.ai's terms. The road surface is given by name (`roadSurface`) or by id (`roadSurfaceId`).                 |
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

### Calls to swelux.ai

Relative to `apiBase`, with the key in the `X-Swelux-Map-Key` header:

| Endpoint                          | Purpose                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /luminaires`                 | The luminaires the map may use                                                               |
| `POST /evaluations`               | `{ street, placement, luminaireIds }` (`null` for the whole catalogue): the verdicts, ranked |
| `GET /luminaires/{id}/photometry` | Key figures and intensity curves of a luminaire, for its diagram                             |

A map without `apiKey` makes the same calls to its own origin, for a Hajk behind a gateway that adds a signed-in user's token. That is how the hosted map at swelux.ai runs.

A map key identifies the map; it is visible in the browser and is not a secret. swelux.ai checks the page's origin against the key and limits how many calculations it may make.

### Tests

From `apps/client`:

```bash
node --test src/plugins/Swelux/tests/*.test.mjs
```

### Limitations

- The user interface is in Swedish only.
- Calculations cover existing streets with one lighting class; new streets come later.
