import { BrowserRouter } from "react-router";

import Box from "@mui/material/Box";

import { useAppSelector } from "./hooks/redux";
import Routes from "./Routes";
import { selectHello, selectPathPrefix } from "./reducers/common";

function Main() {
  const hello = useAppSelector(selectHello);
  const pathPrefix = useAppSelector(selectPathPrefix);

  return (
    <Box sx={{ position: "relative", display: "flex", flex: 1 }}>
      <BrowserRouter basename={pathPrefix}>
        <Routes hello={hello} />
      </BrowserRouter>
    </Box>
  );
}

export default Main;
