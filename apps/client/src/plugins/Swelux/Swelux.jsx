import React from "react";
import { createPortal } from "react-dom";
import BaseWindowPlugin from "../BaseWindowPlugin";
import Observer from "react-event-observer";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";

import SweluxModel from "./SweluxModel";
import SweluxView from "./SweluxView";
import LightPointPopup from "./components/LightPointPopup";

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

  // The map popup lives outside the plugin window, in an OpenLayers overlay.
  const [popup, setPopup] = React.useState(null);
  React.useEffect(() => {
    const s = localObserver.subscribe("swelux.popup", setPopup);
    return () => localObserver.unsubscribe(s);
  }, [localObserver]);

  return (
    <>
      <BaseWindowPlugin
        {...props}
        type="Swelux"
        custom={{
          icon: <LightbulbOutlinedIcon />,
          title: "Belysningsberäkning",
          description: "Beräkna belysning per gata enligt EN 13201",
          height: "dynamic",
          width: 440,
          onWindowShow: () => model.setWindowOpen(true),
          onWindowHide: () => {
            model.setWindowOpen(false);
            model.clearSelection();
          },
        }}
      >
        <SweluxView
          model={model}
          options={props.options}
          localObserver={localObserver}
        />
      </BaseWindowPlugin>
      {popup &&
        createPortal(
          <LightPointPopup
            street={popup.street}
            point={popup.point}
            onClose={() => {
              model.closePopup();
              model.clearSelection();
            }}
            onCalculate={() =>
              model.openStreetFromPopup(popup.street.key, popup.feature)
            }
          />,
          model.getPopupElement()
        )}
    </>
  );
}

export default Swelux;
