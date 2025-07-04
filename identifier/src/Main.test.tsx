import React from 'react';
import { createRoot } from 'react-dom/client';

import { Provider } from 'react-redux';

import store from './store';
import App from './App';

it('renders without crashing', () => {
  const div = document.createElement('div');
  const root = createRoot(div);
  root.render(<Provider store={store}><App/></Provider>);
});
