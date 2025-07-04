declare module 'render-if' {
  function renderIf(condition: boolean): (component: () => React.ReactElement | null) => React.ReactElement | null;
  export = renderIf;
}