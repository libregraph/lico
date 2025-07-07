import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

import { useAppSelector, useAppDispatch } from '../../hooks/redux';
import ResponsiveScreen from '../../components/ResponsiveScreen';
import RedirectWithQuery from '../../components/RedirectWithQuery';
import { executeHello } from '../../actions/common';

import Login from './Login';
import Chooseaccount from './Chooseaccount';
import Consent from './Consent';

const Loginscreen: React.FC = () => {
  const { branding, hello } = useAppSelector((state) => ({
    branding: state.common.branding,
    hello: state.common.hello
  }));
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(executeHello());
  }, [dispatch]);

  const loading = hello === null;
  return (
    <ResponsiveScreen loading={loading} branding={branding || undefined} withoutPadding>
      <Routes>
        <Route path="/identifier" element={<Login />} />
        <Route path="/chooseaccount" element={<Chooseaccount />} />
        <Route path="/consent" element={<Consent />} />
        <Route path="/*" element={<RedirectWithQuery target="/identifier" />} />
      </Routes>
    </ResponsiveScreen>
  );
};

export default Loginscreen;
