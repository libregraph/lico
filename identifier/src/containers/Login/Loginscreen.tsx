import { useEffect } from 'react';

import { Route, Switch } from 'react-router-dom';

import { withStyles } from '@material-ui/core/styles';

import ResponsiveScreen from '../../components/ResponsiveScreen';
import RedirectWithQuery from '../../components/RedirectWithQuery';
import { executeHello } from '../../actions/common';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';

import Login from './Login';
import Chooseaccount from './Chooseaccount';
import Consent from './Consent';

const styles = () => ({
});

function Loginscreen() {
  const dispatch = useAppDispatch();
  const branding = useAppSelector(state => state.common.branding);
  const hello = useAppSelector(state => state.common.hello);

  // dispatch is stable for the store's lifetime, so this runs once on mount.
  useEffect(() => {
    dispatch(executeHello());
  }, [dispatch]);

  const loading = hello === null;
  return (
    <ResponsiveScreen loading={loading} branding={branding} withoutPadding>
      <Switch>
        <Route path="/identifier" exact component={Login}></Route>
        <Route path="/chooseaccount" exact component={Chooseaccount}></Route>
        <Route path="/consent" exact component={Consent}></Route>
        <RedirectWithQuery target="/identifier"/>
      </Switch>
    </ResponsiveScreen>
  );
}

export default withStyles(styles)(Loginscreen);
