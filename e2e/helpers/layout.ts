import type { Page } from '@playwright/test';

/** How many pixels the page is wider than the window: 0 when nothing scrolls sideways (the app's 375 px rule). */
export function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * What sticks out past the window's edge, for a failure message: the innermost elements wider than the page reaches,
 * or whose content (a word too long for its line) runs past it, each as its tag, a few of its classes and the start of
 * its text. Empty when nothing does.
 */
export function widerThanThePage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const edge = document.documentElement.clientWidth;
    const out = (element: Element) => {
      const { left, right } = element.getBoundingClientRect();
      const contentEnd = left + element.scrollWidth;
      return right > edge + 0.5 || left < -0.5 || (element.scrollWidth > element.clientWidth + 1 && contentEnd > edge + 0.5);
    };
    const innermost = [...document.body.querySelectorAll('*')].filter(
      (element) => out(element) && ![...element.children].some(out),
    );
    return innermost
      .slice(0, 4)
      .map((element) => {
        const classes = [...element.classList].slice(0, 4).join('.');
        const text = (element.textContent ?? '').trim().slice(0, 30);
        return `<${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}> "${text}"`;
      })
      .join(', ');
  });
}
