import { buildViewerUrl } from '../buildViewerUrl';

test('buildViewerUrl includes zoom when provided (pdf)', () => {
  const url = buildViewerUrl('pdf', 'file:///viewer/', 'file:///doc.pdf', { openingText: 'x', failedText: 'y', initialZoom: 2 });
  expect(url).toContain('pdf.html?');
  expect(url).toContain('file%3A%2F%2F%2Fdoc.pdf');
  expect(url).toContain('z=2');
});

