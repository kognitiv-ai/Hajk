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

import RoadPlan from "./RoadPlan";
import PolarDiagram from "./PolarDiagram";
import { arrangementLabel, checksFor, nf } from "../utils";
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
  photometry,
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("md"));
  const [detail, setDetail] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [quantity, setQuantity] = React.useState("L");
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
  const res = detail?.result;
  const checks = res ? checksFor(res, detail.target) : [];
  const ldtFileName = lum
    ? `${safeFileName(`${lum.manufacturer} ${lum.name}`)}.ldt`
    : "";
  const flux = photometry?.luminousFlux > 0 ? photometry.luminousFlux : null;

  const exportEvo = () =>
    downloadJson(
      buildEvoExchange({ street, profile, detail, ldtFileName, flux }),
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
            {street.name} · {profile.requiredClass}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.25 }}>
            {lum?.name || "Beräknar …"}
          </Typography>
          {lum && (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              {lum.manufacturer} · {nf(lum.powerW, 1)} W
              {lum.articleNumber ? ` · art.nr ${lum.articleNumber}` : ""}
            </Typography>
          )}
        </Box>
        {res && (
          <Chip
            icon={res.compliant ? <CheckCircleIcon /> : <CancelIcon />}
            color={res.compliant ? "success" : "error"}
            label={`${res.compliant ? "Uppfyller" : "Uppfyller inte"} ${detail.requiredClass}`}
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
                {lum.manufacturer} · {street.name} · {detail.requiredClass} ·{" "}
                {res.compliant ? "uppfyller" : "uppfyller inte"} kraven
              </Typography>
            </Box>

            <Section
              title={`Vägen ovanifrån · ${FIELDS_LABEL}`}
              action={
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={quantity}
                  onChange={(e, v) => v && setQuantity(v)}
                  data-print-hide
                >
                  <ToggleButton value="L">Luminans</ToggleButton>
                  <ToggleButton value="E">Belysningsstyrka</ToggleButton>
                </ToggleButtonGroup>
              }
            >
              <RoadPlan
                detail={detail}
                quantity={quantity}
                spacing={profile.spacingM}
                arrangement={profile.arrangement}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                component="p"
                sx={{ mt: 1 }}
              >
                Beräkningsfältet enligt EN 13201-3 (ett stolpavstånd) upprepat
                längs vägen.
                {quantity === "L"
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
                <Section title={`Resultat mot ${detail.requiredClass}`}>
                  <Table size="small">
                    <TableBody>
                      {checks.map((c) => (
                        <TableRow key={c.label}>
                          <TableCell sx={{ pl: 0 }}>{c.label}</TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: 600,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {nf(c.value, c.d)}
                            {c.unit && ` ${c.unit}`}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: "text.secondary" }}
                          >
                            {c.op} {nf(c.req, c.d)}
                          </TableCell>
                          <TableCell padding="checkbox" sx={{ pr: 0 }}>
                            {c.ok ? (
                              <CheckCircleIcon
                                color="success"
                                fontSize="small"
                              />
                            ) : (
                              <CancelIcon color="error" fontSize="small" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Box sx={{ mt: 2 }}>
                    <KeyValues
                      rows={[
                        [
                          "Belysningsstyrka medel / min / max",
                          `${nf(res.eavg, 1)} / ${nf(res.emin, 1)} / ${nf(res.emax, 1)} lx`,
                        ],
                        ["Kantbelysningsförhållande (EIR)", nf(res.eir, 2)],
                        ...(flux ? [["Ljusflöde", `${nf(flux)} lm`]] : []),
                        ...(flux && lum.powerW
                          ? [["Ljusutbyte", `${nf(flux / lum.powerW)} lm/W`]]
                          : []),
                      ]}
                    />
                  </Box>
                </Section>
              </Grid>
            </Grid>

            <Section title="Förutsättningar">
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KeyValues
                    rows={[
                      ["Gata", `${street.name}, ${street.area}`],
                      ["Belysningsklass", profile.requiredClass],
                      [
                        "Vägbredd / körfält",
                        `${nf(profile.roadWidthM, 1)} m / ${profile.lanes}`,
                      ],
                      ["Beläggning", `CIE ${profile.surfaceClass}`],
                    ]}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <KeyValues
                    rows={[
                      ["Uppställning", arrangementLabel(profile.arrangement)],
                      [
                        "Stolpavstånd / ljuspunktshöjd",
                        `${nf(profile.spacingM)} m / ${nf(profile.poleHeightM, 1)} m`,
                      ],
                      [
                        "Utliggare / lutning",
                        `${nf(profile.armLengthM, 1)} m / ${nf(profile.tiltDeg)}°`,
                      ],
                      [
                        "Underhållsfaktor",
                        nf(detail.assumptions.maintenanceFactor, 2),
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
                Beräknat med swelux.ai enligt EN 13201-2/-3 med tillverkarens
                ljusdata (LDT). Förhandsversion – klass och vägbredd är
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

export default DetailsDialog;
