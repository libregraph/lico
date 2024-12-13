import React from 'react';
import { connect } from 'react-redux';

import { BrowserRouter } from 'react-router-dom';

import { createStyles, WithStyles, withStyles } from '@material-ui/core/styles';

import Routes from './Routes';
import { RootState } from './store';
import { ObjectType } from './types';

const styles = () => createStyles({
  root: {
    position: 'relative',
    display: 'flex',
    flex: 1
  }
});

export interface MainProps extends WithStyles<typeof styles> {
  hello: ObjectType;
  pathPrefix: string;
  updateAvailable: boolean;
}


const Main: React.FC<MainProps> = ({ classes, hello, pathPrefix }) => {

  return (
    <div className={classes.root}>
      <BrowserRouter basename={pathPrefix}>
        <Routes hello={hello} />
      </BrowserRouter>
    </div>
  );
}

const mapStateToProps = (state: RootState) => {
  const { hello, updateAvailable, pathPrefix } = state.common;

  return {
    hello: hello as ObjectType,
    updateAvailable,
    pathPrefix
  };
};

export default connect(mapStateToProps)(withStyles(styles)(Main));
