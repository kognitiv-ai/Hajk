import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";

import RoadPlan from "./RoadPlan";
import PolarDiagram from "./PolarDiagram";
import MetricTable from "./MetricTable";
import {
  arrangementLabel,
  formatMetric,
  gridsFor,
  metricLabel,
  nf,
  statusText,
} from "../utils";
import {
  buildEvoExchange,
  downloadJson,
  downloadUrl,
  printElement,
  safeFileName,
} from "../exports";

function Section({ title, children, action }) {
  return (
    <Box sx={{ breakInside: "avoid" }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ flex: 1, lineHeight: 1.6 }}
        >
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

function KeyValues({ rows }) {
  return (
    <Table size="small">
      <TableBody>
        {rows.map(([k, v]) => (
          <TableRow key={k}>
            <TableCell sx={{ color: "text.secondary", pl: 0 }}>{k}</TableCell>
            <TableCell
              align="right"
              sx={{ pr: 0, fontVariantNumeric: "tabular-nums" }}
            >
              {v}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Full result for one luminaire on the street, with print and exports. */
function DetailsDialog({
  open,
  onClose,
  model,
  street,
  profile,
  luminaireId,
  surface,
  hours,
  photometry,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const [detail, setDetail] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [quantity, setQuantity] = React.useState("Luminance");
  const contentRef = React.useRef(null);

  React.useEffect(() => {
    if (!open || !luminaireId) return;
    let live = true;
    setDetail(null);
    setError(null);
    model
      .fetchDetail(profile, luminaireId)
      .then((d) => live && setDetail(d))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [open, model, profile, luminaireId]);

  const lum = detail?.luminaire;
  const area = detail?.evaluation.areas[0];
  const status = detail?.evaluation.status;
  const lightingClass = area?.lightingClass || profile.street.lightingClass;
  const hasLuminance = gridsFor(area, "Luminance").length > 0;
  const shownQuantity = hasLuminance ? quantity : "HorizontalIlluminance";
  const ldtFileName = lum
    ? `${safeFileName(`${lum.manufacturer} ${lum.name}`)}.ldt`
    : "";
  const flux = photometry?.luminousFlux || lum?.luminousFlux || null;
  const efficacy =
    photometry?.efficacy ||
    (flux && lum?.systemPower ? flux / lum.systemPower : null);
  const pass = status === "Compliant";

  const exportEvo = () =>
    downloadJson(
      buildEvoExchange({ street, profile, detail, surface, ldtFileName }),
      `${safeFileName(street.name)}_dialux-evo.json`
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="md"
      fullWidth
      scroll="paper"
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={1}
        sx={{
          bgcolor: "primary.main",
          color: "primary.contrastText",
          px: 3,
          py: 2,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" sx={{ opacity: 0.7, lineHeight: 1.4 }}>
            {street.name} · {lightingClass}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
            {lum?.name || "Beräknar …"}
          </Typography>
          {lum && (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {lum.manufacturer}
              {lum.systemPower ? ` · ${nf(lum.systemPower, 1)} W` : ""}
              {lum.articleNumber ? ` · art.nr ${lum.articleNumber}` : ""}
            </Typography>
          )}
        </Box>
        {status && (
          <Chip
            icon={
              pass ? (
                <CheckCircleIcon />
              ) : status === "NonCompliant" ? (
                <CancelIcon />
              ) : (
                <RemoveCircleOutlineIcon />
              )
            }
            color={
              pass ? "success" : status === "NonCompliant" ? "error" : "default"
            }
            label={statusText(status, lightingClass)}
            sx={{ mt: 0.5, fontWeight: 600 }}
          />
        )}
        <IconButton
          onClick={onClose}
          aria-label="Stäng"
          sx={{ color: "inherit" }}
        >
          <CloseIcon />
        </IconButton>
      </Stack>

      <DialogContent dividers sx={{ p: 0 }}>
        {!detail && !error && <LinearProgress color="secondary" />}
        {error && (
          <Alert severity="error" sx={{ m: 3 }}>
            {error}
          </Alert>
        )}
        {detail && (
          <Stack ref={contentRef} spacing={3} sx={{ p: 3 }}>
            {/* Header for the printout only; the dialog shows it in its title bar. */}
            <Box sx={{ display: "none", "@media print": { display: "block" } }}>
              <Typography variant="h5">{lum.name}</Typography>
              <Typography>
                {lum.manufacturer} · {street.name} ·{" "}
                {statusText(status, lightingClass).toLowerCase()}
              </Typography>
            </Box>

            <Section
              title={`Vägen ovanifrån · ${FIELDS_LABEL}`}
              action={
                hasLuminance && (
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={shownQuantity}
                    onChange={(e, v) => v && setQuantity(v)}
                    data-print-hide
                  >
                    <ToggleButton value="Luminance">Luminans</ToggleButton>
                    <ToggleButton value="HorizontalIlluminance">
                      Belysningsstyrka
                    </ToggleButton>
                  </ToggleButtonGroup>
                )
              }
            >
              <RoadPlan
                design={detail.design}
                evaluation={detail.evaluation}
                quantity={shownQuantity}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ mt: 1 }}
              >
                Beräkningsfältet enligt EN 13201-3 (ett stolpavstånd) upprepat
                längs vägen.
                {shownQuantity === "Luminance"
                  ? " Luminans som medel över observatörerna."
                  : ""}
              </Typography>
            </Section>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 5 }}>
                <Section title="Ljusfördelning">
                  {photometry ? (
                    <PolarDiagram data={photometry} size={250} />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Ljusdata saknas för den här armaturen.
                    </Typography>
                  )}
                </Section>
              </Grid>
              <Grid size={{ xs: 12, sm: 7 }}>
                <Section title={`Resultat mot ${lightingClass}`}>
                  <MetricTable metrics={area.metrics} />
                  <Box sx={{ mt: 2 }}>
                    <KeyValues
                      rows={[
                        ["Stolpar per km", nf(detail.polesPerKilometre, 1)],
                        ...(detail.powerPerKilometre != null
                          ? [
                              [
                                "Effekt per km",
                                `${nf(detail.powerPerKilometre / 1000, 2)} kW`,
                              ],
                              [
                                "Energi per km och år",
                                `${nf((detail.powerPerKilometre * (hours || detail.design.annualOperatingHours)) / 1000)} kWh`,
                              ],
                            ]
                          : []),
                        ...(flux ? [["Ljusflöde", `${nf(flux)} lm`]] : []),
                        ...(efficacy
                          ? [["Ljusutbyte", `${nf(efficacy)} lm/W`]]
                          : []),
                      ]}
                    />
                  </Box>
                </Section>
              </Grid>
            </Grid>

            {area.observers.length > 0 && (
              <Section title="Per observatör">
                <ObserverTable observers={area.observers} />
              </Section>
            )}

            <Section title="Förutsättningar">
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KeyValues
                    rows={[
                      [
                        "Gata",
                        [street.name, street.area].filter(Boolean).join(", "),
                      ],
                      ["Belysningsklass", lightingClass],
                      [
                        "Vägbredd / körfält",
                        `${nf(profile.street.width, 1)} m / ${profile.street.laneCount}`,
                      ],
                      [
                        "Beläggning / Q0",
                        `${surface?.name || "–"} / ${nf(profile.street.averageLuminanceCoefficient ?? surface?.averageLuminanceCoefficient, 2)}`,
                      ],
                    ]}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KeyValues
                    rows={[
                      [
                        "Uppställning",
                        arrangementLabel(profile.placement.arrangement),
                      ],
                      [
                        "Stolpavstånd / ljuspunktshöjd",
                        `${nf(profile.placement.spacing)} m / ${nf(profile.placement.lightCentreHeight, 1)} m`,
                      ],
                      [
                        "Utliggare / lutning",
                        `${nf(profile.placement.outreach, 1)} m / ${nf(profile.placement.tiltDegrees)}°`,
                      ],
                      [
                        "Underhållsfaktor",
                        nf(detail.design.maintenanceFactor, 2),
                      ],
                    ]}
                  />
                </Grid>
              </Grid>
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ mt: 1.5 }}
              >
                Beräknat med swelux.ai enligt{" "}
                {detail.evaluation.standard?.title || "EN 13201-2/-3"} med
                tillverkarens ljusdata. Förhandsversion – klass och vägbredd är
                standardvärden tills de hämtas från GIS/NVDB.
              </Typography>
            </Section>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5, gap: 1, flexWrap: "wrap" }}>
        <Button
          startIcon={<DownloadOutlinedIcon />}
          disabled={!detail}
          onClick={() => downloadUrl(model.ldtUrl(luminaireId))}
        >
          Ljusdata (LDT)
        </Button>
        <Button
          startIcon={<DownloadOutlinedIcon />}
          disabled={!detail}
          onClick={exportEvo}
        >
          DIALux evo-underlag
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          disableElevation
          startIcon={<PrintOutlinedIcon />}
          disabled={!detail}
          onClick={() =>
            printElement(contentRef.current, `${street.name} – ${lum?.name}`)
          }
        >
          Skriv ut / PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const FIELDS_LABEL = "tre stolpavstånd";

/** The observer-dependent metrics per observer (M classes): one row each. */
function ObserverTable({ observers }) {
  const metrics = observers[0].metrics;
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ pl: 0 }}>Observatör</TableCell>
            {metrics.map((m) => (
              <TableCell key={m.id} align="right" title={metricLabel(m)}>
                {m.symbol}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {observers.map((o, i) => (
            <TableRow key={o.id}>
              <TableCell sx={{ pl: 0 }} title={o.description}>
                Körfält {i + 1}
              </TableCell>
              {o.metrics.map((m) => (
                <TableCell
                  key={m.id}
                  align="right"
                  sx={{
                    fontVariantNumeric: "tabular-nums",
                    color:
                      m.status === "NonCompliant" ? "error.main" : undefined,
                  }}
                >
                  {formatMetric(m)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

export default DetailsDialog;
