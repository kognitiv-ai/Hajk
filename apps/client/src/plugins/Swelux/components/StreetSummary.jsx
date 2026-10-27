import { Box, Divider, Stack, Tooltip, Typography } from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { nf } from "../utils";

function Figure({ value, label, hint }) {
  const body = (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{ fontSize: 22, fontWeight: 600, lineHeight: 1.15 }}
        noWrap
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        {label}
      </Typography>
    </Box>
  );
  return hint ? (
    <Tooltip title={hint} placement="top">
      {body}
    </Tooltip>
  ) : (
    body
  );
}

/** Selected street: name, where it is and what is there today. */
function StreetSummary({ street, clicked }) {
  const { stats } = street;
  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
        {street.name}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {[street.area, clicked && `stolpe ${clicked.stolpe}`]
          .filter(Boolean)
          .join(" · ")}
      </Typography>

      <Stack
        direction="row"
        spacing={2}
        divider={<Divider orientation="vertical" flexItem />}
        sx={{ mt: 1.5 }}
      >
        <Figure value={nf(stats.count)} label="ljuspunkter" />
        <Figure
          value={stats.avgWattage ? `${nf(stats.avgWattage)} W` : "–"}
          label="snitt idag"
          hint="Genomsnittlig lampeffekt enligt ert register"
        />
        <Figure
          value={stats.spacingM ? `${nf(stats.spacingM)} m` : "–"}
          label="stolpavstånd"
          hint="Uppskattat från avståndet mellan gatans ljuspunkter"
        />
      </Stack>

      {stats.typicalLuminaire && (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ mt: 1.25, color: "text.secondary" }}
        >
          <LightbulbOutlinedIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" noWrap title={stats.typicalLuminaire}>
            Idag mest {stats.typicalLuminaire}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

export default StreetSummary;
