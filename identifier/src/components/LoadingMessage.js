import React from 'react';
import PropTypes from 'prop-types';

import {FormattedMessage} from 'react-intl';

function handleRetry(event) {
  event.preventDefault();

  window.location.reload();
}

const LoadingMessage = React.forwardRef(function Loading(props, ref) {
  if (props.error) {
    console.error('Loading error', props.error); // eslint-disable-line no-console
    // When the loader has errored.
    return <div id="loader" ref={ref}>
      <FormattedMessage
        id="kpop.loader.error.message"
        defaultMessage="Error!">
      </FormattedMessage> &mdash; <a href="#" onClick={ handleRetry }>
        <FormattedMessage id="kpop.loader.retry" defaultMessage="retry">
        </FormattedMessage>
      </a>
    </div>;
  } else if (props.timedOut) {
    // When the loader has taken longer than the timeout.
    return <div id="loader" ref={ref}>
      <FormattedMessage
        id="kpop.loader.longtime.message"
        defaultMessage="Taking a long time...">
      </FormattedMessage> &mdash; <a href="#" onClick={ handleRetry }>
        <FormattedMessage id="kpop.loader.retry" defaultMessage="retry">
        </FormattedMessage>
      </a>
    </div>;
  } else if (props.pastDelay) {
    // When the loader has taken longer than the delay.
    return <div id="loader" ref={ref}>
      <FormattedMessage id="kpop.loader.loading.message" defaultMessage="Loading..."></FormattedMessage>
    </div>;
  } else {
    // When the loader has just started.
    return null;
  }
});

LoadingMessage.propTypes = {
  error: PropTypes.bool,
  timedOut: PropTypes.bool,
  pastDelay: PropTypes.bool,
};

export default LoadingMessage;
