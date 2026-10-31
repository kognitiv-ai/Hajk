import { Box, Stack, Tooltip, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";
import { formatMetric, metricLabel, requirementText } from "../utils";

export function StatusIcon({ status, size = 18 }) {
  if (status === "Compliant")
    return <CheckCircleIcon color="success" sx={{ fontSize: size }} />;
  if (status === "NonCompliant")
    return <CancelIcon color="error" sx={{ fontSize: size }} />;
  return (
    <RemoveCircleOutlineIcon
      sx={{ fontSize: size, color: "text.disabled" }}
      titleAccess="Ej bedömd"
    />
  );
}

/**
 * The engine's metrics for one result, as it reports them: value, the class's
 * requirement and the verdict per metric. Metrics without a requirement are
 * for information.
 */
function MetricTable({ metrics, dense = false }) {
  return (
    <Box>
      {metrics.map((m) => (
        <Stack
          key={m.id}
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            py: dense ? 0.4 : 0.6,
            borderBottom: 1,
            borderColor: "divider",
            "&:last-of-type": { borderBottom: 0 },
          }}
        >
          <Tooltip title={m.name} placement="top-start">
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
              {metricLabel(m)}{" "}
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
              >
                {m.symbol}
              </Typography>
            </Typography>
          </Tooltip>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
          >
            {formatMetric(m)}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              width: 64,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {m.requirement
              ? m.isChecked === false
                ? "ej krav"
                : requirementText(m)
              : "info"}
          </Typography>
          <Box sx={{ width: 18, display: "flex", flex: "none" }}>
            {m.requirement && m.isChecked !== false && (
              <StatusIcon status={m.status} />
            )}
          </Box>
        </Stack>
      ))}
    </Box>
  );
}

export default MetricTable;
