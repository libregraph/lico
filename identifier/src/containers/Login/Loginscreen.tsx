import { useEffect } from "react";
import { Route, Routes } from "react-router";

import { executeHello } from "../../actions/common";
import RedirectWithQuery from "../../components/RedirectWithQuery";
import ResponsiveScreen from "../../components/ResponsiveScreen";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { selectBranding, selectHello } from "../../reducers/common";
import Chooseaccount from "./Chooseaccount";
import Consent from "./Consent";
import Login from "./Login";

function Loginscreen() {
  const dispatch = useAppDispatch();
  const branding = useAppSelector(selectBranding);
  const hello = useAppSelector(selectHello);

  // dispatch is stable for the store's lifetime, so this runs once on mount.
  useEffect(() => {
    dispatch(executeHello());
  }, [dispatch]);

  const loading = hello === null;
  return (
    <ResponsiveScreen loading={loading} branding={branding} withoutPadding>
      <Routes>
        <Route path="/identifier" element={<Login />} />
        <Route path="/chooseaccount" element={<Chooseaccount />} />
        <Route path="/consent" element={<Consent />} />
        <Route path="*" element={<RedirectWithQuery target="/identifier" />} />
      </Routes>
    </ResponsiveScreen>
  );
}

export default Loginscreen;
