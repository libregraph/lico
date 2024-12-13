import React from 'react';
import { connect } from 'react-redux';

import { Route, Switch } from 'react-router-dom';

import { createStyles, WithStyles, withStyles } from '@material-ui/core/styles';

import ResponsiveScreen from '../../components/ResponsiveScreen';
import RedirectWithQuery from '../../components/RedirectWithQuery';
import { executeHello } from '../../actions/common';

import Login from './Login';
import Chooseaccount from './Chooseaccount';
import Consent from './Consent';
import { PromiseDispatch, RootState } from '../../store';
import { ObjectType } from '../../types';

const styles = () => createStyles({
});

interface LoginscreenProps extends WithStyles<typeof styles> {
  branding?: { bannerLogo: string, locales: string[] } | null,
  hello?: ObjectType | null,
  dispatch: PromiseDispatch,
}

const Loginscreen: React.FC<LoginscreenProps> = ({ branding, hello, dispatch }) => {

  React.useEffect(() => {
    dispatch(executeHello());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = hello === null;

  return (
    <ResponsiveScreen loading={loading} branding={branding} withoutPadding>
      <Switch>
        <Route path="/identifier" exact component={Login}></Route>
        <Route path="/chooseaccount" exact component={Chooseaccount}></Route>
        <Route path="/consent" exact component={Consent}></Route>
        <RedirectWithQuery target="/identifier" />
      </Switch>
    </ResponsiveScreen>
  );
}


const mapStateToProps = (state: RootState) => {
  const { branding, hello } = state.common;

  return {
    branding,
    hello: hello as ObjectType
  };
};

export default connect(mapStateToProps)(withStyles(styles)(Loginscreen));
