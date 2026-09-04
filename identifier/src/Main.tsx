import { useEffect } from "react";
import { BrowserRouter } from "react-router";

import Box from "@mui/material/Box";

import { appHasMounted } from "./boot";
import { useAppSelector } from "./hooks/redux";
import Routes from "./Routes";
import { selectHello } from "./reducers/common";
import { usePathPrefix } from "./request";

function Main() {
  const hello = useAppSelector(selectHello);
  const pathPrefix = usePathPrefix();

  /*
   * This chunk is what the document's loading state was covering for: it is
   * loaded lazily and it renders the card, so its arrival is the first moment
   * there is anything worth showing the visitor.
   */
  useEffect(() => {
    appHasMounted();
  }, []);

  return (
    <Box sx={{ position: "relative", display: "flex", flex: 1 }}>
      <BrowserRouter basename={pathPrefix}>
        <Routes hello={hello} />
      </BrowserRouter>
    </Box>
  );
}

export default Main;
