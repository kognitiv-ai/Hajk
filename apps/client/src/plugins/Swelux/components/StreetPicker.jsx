import React from "react";
import {
  Autocomplete,
  Box,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

/** Search for a street among those that have light points. */
function StreetPicker({ streets, street, onSelect }) {
  return (
    <Autocomplete
      size="small"
      options={streets}
      value={street}
      getOptionLabel={(s) => s.name}
      renderOption={({ key, ...props }, s) => (
        <li key={key} {...props}>
          <Box sx={{ flex: 1 }}>{s.name}</Box>
          <Typography variant="caption" color="text.secondary">
            {s.stats.count} ljuspunkter
          </Typography>
        </li>
      )}
      isOptionEqualToValue={(a, b) => a.key === b.key}
      onChange={(e, s) => s && onSelect(s)}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Sök gata …"
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      )}
    />
  );
}

export default StreetPicker;
