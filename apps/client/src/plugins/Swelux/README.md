## The Swelux plugin

Street lighting calculations according to EN 13201 for the light points in the map. A user clicks a light point, the plugin selects the street it belongs to, and the [swelux.ai](https://swelux.ai) calculation engine says whether a luminaire meets the street's lighting class, or ranks a whole catalogue of luminaires against it.

The plugin only provides the map side. The calculations, luminaire catalogue and light point data come from the swelux.ai platform, so a swelux.ai account for the organisation is required. Without one, the plugin has nothing to calculate with.

### Maintainer

Anoop Mathew, Kognitiv: [anoop@kognitiv.se](mailto:anoop@kognitiv.se). Questions and bug reports about this plugin go here.

### How it works

1. Click a light point in the layer named by `lightPointLayerId`. Every point with the same `streetId` is selected and highlighted, together with the street's centrelines from `streetsUrl`.
2. The street and placement are pre-filled. Spacing is estimated from the light points (median nearest-neighbour distance), light centre height and outreach come from the register's `poleHeight` and `armLength` where plausible, and the rest from `defaultProfile`. Everything can be edited.
3. Choose a luminaire and press **Beräkna**, or press **Hitta bästa armatur** to calculate the organisation's whole catalogue. The window shows the engine's verdict with each metric of the lighting class, the ranking, luminaires that could not be calculated and why, and the energy difference against today's wattage.
4. **Detaljer** shows the road from above as calculated, the metrics per observer, the light distribution, and exports: the photometric file, a DIALux evo exchange file and print/PDF.

### Configuration

The light points must be a vector layer that loads once, so that the plugin sees the whole street:

```json
{
  "id": "swelux-ljuspunkter",
  "url": "/swelux-map/light-points",
  "dataFormat": "GeoJSON",
  "projection": "EPSG:4326",
  "loadingStrategy": "all"
}
```

Each light point needs these properties: `id`, `streetId` (null when the point belongs to no street), `street` (display name), `area`, `poleId`, `existingLuminaire`, `existingManufacturer`, `existingWattage` (W), `poleHeight` and `armLength` (m).

The tool in the map configuration:

```json
{
  "type": "swelux",
  "options": {
    "target": "left",
    "tenantId": "<the organisation's id in swelux.ai>",
    "lightPointLayerId": "swelux-ljuspunkter",
    "defaultProfile": {
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
    },
    "operatingHoursPerYear": 4100
  }
}
```

| Option                  | Default                                | Description                                                                                                                                    |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `lightPointLayerId`     |                                        | The `id` of the light point layer. Required.                                                                                                   |
| `tenantId`              |                                        | The organisation's id in swelux.ai. Replaces `{tenantId}` in `apiBase`, `streetsUrl` and `contextUrl`.                                         |
| `tenantIdCookie`        |                                        | Instead of `tenantId`: the name of a cookie holding the organisation's id, for a sign-in gateway that lets the user pick an organisation.      |
| `apiBase`               | `/api/v1/organisations/{tenantId}/map` | Base of the organisation's map API.                                                                                                            |
| `streetsUrl`            |                                        | Street centrelines as GeoJSON (`streetId`, `street`), for the highlight. Without it, only the light points are highlighted.                    |
| `contextUrl`            |                                        | The organisation's name and light point count for the window, and whether the user can switch organisation.                                    |
| `standardsUrl`          | `/api/v1/standards`                    | Lighting classes.                                                                                                                              |
| `roadSurfacesUrl`       | `/api/v1/road-surfaces`                | Road surfaces.                                                                                                                                 |
| `fitToData`             | `false`                                | Zoom the map to the light points once they have loaded.                                                                                        |
| `defaultProfile`        |                                        | The street and placement to start from, in the platform's terms. The road surface is given by name (`roadSurface`) or by id (`roadSurfaceId`). |
| `operatingHoursPerYear` | `4000`                                 | Used for the yearly energy figures.                                                                                                            |

### API calls

All calls are same-origin, relative to `apiBase`:

| Endpoint                                | Purpose                                                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `GET /luminaires`                       | The organisation's luminaires                                                                |
| `POST /evaluations`                     | `{ street, placement, luminaireIds }` (`null` for the whole catalogue): the verdicts, ranked |
| `POST /evaluations/detail`              | `{ street, placement, luminaireId }`: the street design and the engine's whole assessment    |
| `GET /luminaires/{id}/photometry`       | Polar curves and key figures of the photometric file                                         |
| `GET /luminaires/{id}/photometric-file` | The luminaire's photometric file                                                             |

### Authentication

The plugin sends no credentials of its own and holds no API key. It expects the map's origin to forward these paths to swelux.ai with the signed-in user's token, which today means running Hajk behind a gateway that does so.

### Known limitations

- Spacing is estimated assuming the map's projection is EPSG:3857. In another projection the estimate is wrong, though it can be corrected by hand.
- The layer named by `lightPointLayerId` must be a vector layer that has loaded all its features. The plugin indexes the streets once, and waits until that layer has features.
- The property names above are fixed. A register with other names has to be mapped before it reaches the layer.
- The user interface is in Swedish only.
