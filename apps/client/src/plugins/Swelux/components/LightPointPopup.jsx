import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import { NO_STREET, nf } from "../utils";

function Row({ label, value }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ py: 0.4 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ width: 74, flex: "none" }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ minWidth: 0 }} noWrap title={value}>
        {value}
      </Typography>
    </Stack>
  );
}

/** Map popup for a clicked light point, anchored at the pole. */
function LightPointPopup({ street, point, onCalculate, onClose }) {
  const named = street && street.key !== NO_STREET;
  return (
    <Box
      sx={{
        position: "relative",
        filter: "drop-shadow(0 4px 12px rgba(16,22,42,0.25))",
      }}
    >
      <Paper sx={{ width: 290, borderRadius: 2, overflow: "hidden" }}>
        <Stack
          direction="row"
          alignItems="flex-start"
          sx={{
            bgcolor: "primary.main",
            color: "primary.contrastText",
            pl: 2,
            pr: 0.5,
            py: 1,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
            <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>
              {named ? street.name : "Ljuspunkt utan gatunamn"}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.75 }}>
              {point.poleId ? `Stolpe ${point.poleId}` : "Ljuspunkt"}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={onClose}
            aria-label="Stäng"
            sx={{ color: "inherit" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Box sx={{ px: 2, pt: 1.25, pb: 1.5 }}>
          <Row
            label="Armatur"
            value={
              [point.existingManufacturer, point.existingLuminaire]
                .filter(Boolean)
                .join(" · ") || "Okänd"
            }
          />
          <Row
            label="Effekt"
            value={
              point.existingWattage ? `${nf(point.existingWattage)} W` : "Okänd"
            }
          />
          {named && (
            <Typography
              variant="caption"
              color="text.secondary"
              component="p"
              sx={{ mt: 1 }}
            >
              {nf(street.stats.count)} ljuspunkter på gatan
              {street.stats.avgWattage
                ? `, snitt ${nf(street.stats.avgWattage)} W`
                : ""}
            </Typography>
          )}
          <Button
            variant="contained"
            fullWidth
            disableElevation
            startIcon={<CalculateOutlinedIcon />}
            disabled={!named}
            onClick={onCalculate}
            sx={{ mt: 1.5, textTransform: "none", fontWeight: 600 }}
          >
            Beräkna belysning för gatan
          </Button>
        </Box>
      </Paper>
      {/* Arrow pointing at the pole */}
      <Box
        sx={{
          position: "absolute",
          left: "50%",
          bottom: -7,
          width: 14,
          height: 14,
          bgcolor: "background.paper",
          transform: "translateX(-50%) rotate(45deg)",
        }}
      />
    </Box>
  );
}

export default LightPointPopup;
