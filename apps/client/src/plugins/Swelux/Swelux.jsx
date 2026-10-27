import React from "react";
import BaseWindowPlugin from "../BaseWindowPlugin";
import Observer from "react-event-observer";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";

import SweluxModel from "./SweluxModel";
import SweluxView from "./SweluxView";

/**
 * @summary Street lighting calculations (EN 13201) for the light points in the map,
 * powered by the swelux.ai calculation engine.
 */
function Swelux(props) {
  const [localObserver] = React.useState(Observer());
  const [model] = React.useState(
    () =>
      new SweluxModel({
        localObserver,
        app: props.app,
        map: props.map,
        options: props.options,
      })
  );

  React.useEffect(() => () => model.dispose(), [model]);

  return (
    <BaseWindowPlugin
      {...props}
      type="Swelux"
      custom={{
        icon: <LightbulbOutlinedIcon />,
        title: "Belysningsberäkning",
        description: "Beräkna belysning per gata enligt EN 13201",
        height: "dynamic",
        width: 440,
        onWindowHide: () => model.clearSelection(),
      }}
    >
      <SweluxView
        model={model}
        options={props.options}
        localObserver={localObserver}
      />
    </BaseWindowPlugin>
  );
}

export default Swelux;
