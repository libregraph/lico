import { BrowserRouter } from "react-router";

import Box from "@mui/material/Box";

import { useAppSelector } from "./hooks/redux";
import Routes from "./Routes";
import { selectHello } from "./reducers/common";
import { usePathPrefix } from "./request";

function Main() {
  const hello = useAppSelector(selectHello);
  const pathPrefix = usePathPrefix();

  return (
    <Box sx={{ position: "relative", display: "flex", flex: 1 }}>
      <BrowserRouter basename={pathPrefix}>
        <Routes hello={hello} />
      </BrowserRouter>
    </Box>
  );
}

export default Main;
