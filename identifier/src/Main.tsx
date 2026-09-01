import { BrowserRouter } from 'react-router-dom';

import { createStyles, withStyles } from '@material-ui/core/styles';

import Routes from './Routes';
import { useAppSelector } from './hooks/redux';

const styles = () => createStyles({
  root: {
    position: 'relative',
    display: 'flex',
    flex: 1
  }
});

export interface MainProps {
  classes: { root: string };
}

function Main(props: MainProps) {
  const { classes } = props;

  const hello = useAppSelector(state => state.common.hello);
  const pathPrefix = useAppSelector(state => state.common.pathPrefix);

  return (
    <div className={classes.root}>
      <BrowserRouter basename={pathPrefix}>
        <Routes hello={hello}/>
      </BrowserRouter>
    </div>
  );
}

export default withStyles(styles)(Main);
