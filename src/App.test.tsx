import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('links to the canonical source repository', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('href="https://github.com/bktim/endexif"');
  });
});
