import React from "react";
import { Autocomplete, Button, Chip, Stack, TextField } from "@mui/material";

/** Which manufacturers' luminaires to calculate with. */
function ManufacturerFilter({ manufacturers, selected, onChange }) {
  const all = manufacturers.map((m) => m.name);
  const everything = selected.length === all.length;
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Autocomplete
        multiple
        size="small"
        disableCloseOnSelect
        sx={{ flex: 1, minWidth: 0 }}
        options={all}
        value={selected}
        limitTags={3}
        getOptionLabel={(name) => {
          const m = manufacturers.find((x) => x.name === name);
          return m ? `${m.name} (${m.count})` : name;
        }}
        onChange={(e, names) => onChange(names.length ? names : all)}
        renderValue={(values, getItemProps) =>
          values.map((name, index) => {
            const { key, ...props } = getItemProps({ index });
            return <Chip key={key} label={name} size="small" {...props} />;
          })
        }
        renderInput={(params) => <TextField {...params} label="Tillverkare" />}
      />
      {!everything && (
        <Button size="small" onClick={() => onChange(all)} sx={{ mt: 0.5 }}>
          Alla
        </Button>
      )}
    </Stack>
  );
}

export default ManufacturerFilter;
