import React from "react";
import {
  Autocomplete,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { lumLabel } from "../utils";

/** Choose one luminaire from the catalogue and calculate it. */
function LuminairePicker({
  luminaires,
  luminaire,
  onChange,
  onCalculate,
  disabled,
}) {
  return (
    <>
      <Divider>
        <Typography variant="caption" color="text.secondary">
          eller välj armatur själv
        </Typography>
      </Divider>
      <Stack direction="row" spacing={1}>
        <Autocomplete
          size="small"
          sx={{ flex: 1, minWidth: 0 }}
          options={luminaires}
          value={luminaire}
          getOptionLabel={lumLabel}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(e, l) => onChange(l)}
          renderInput={(params) => (
            <TextField {...params} placeholder="Tillverkare, modell …" />
          )}
        />
        <Button
          variant="outlined"
          disabled={!luminaire || disabled}
          onClick={onCalculate}
        >
          Beräkna
        </Button>
      </Stack>
    </>
  );
}

export default LuminairePicker;
