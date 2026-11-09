import React from "react";
import { Link, Typography } from "@mui/material";

/** Where the calculations come from, and which organisation is shown. */
function Footer({ context }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ pt: 0.5 }}>
      Beräknat med{" "}
      <Link
        href="https://swelux.ai"
        target="_blank"
        rel="noopener"
        color="inherit"
      >
        swelux.ai
      </Link>{" "}
      enligt EN 13201-2/-3 och tillverkarnas ljusdata.
      {context && (
        <>
          {" "}
          Visar {context.name}
          {context.canSwitch && (
            <>
              {" · "}
              <Link href="/login?switch" color="inherit">
                Byt organisation
              </Link>
            </>
          )}
          .
        </>
      )}
    </Typography>
  );
}

export default Footer;
