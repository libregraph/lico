import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';

import { BrowserRouter } from 'react-router-dom';

import { withStyles } from '@material-ui/core/styles';

import Routes from './Routes';

const styles = () => ({
  root: {
    position: 'relative',
    display: 'flex',
    flex: 1
  }
});

function Main(props) {
  const { classes } = props;

  const hello = useSelector(state => state.common.hello);
  const pathPrefix = useSelector(state => state.common.pathPrefix);

  return (
    <div className={classes.root}>
      <BrowserRouter basename={pathPrefix}>
        <Routes hello={hello}/>
      </BrowserRouter>
    </div>
  );
}

Main.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(Main);
