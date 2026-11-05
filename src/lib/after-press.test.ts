import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { afterPress, watchPresses } from './after-press';

const page = new EventTarget();
const press = (type: string) => page.dispatchEvent(new Event(type));

beforeAll(() => {
  vi.stubGlobal('window', page);
  watchPresses();
});

afterEach(() => vi.useRealTimers());

describe('afterPress', () => {
  it('runs at once when nothing is pressed, as when the field is left with Tab', () => {
    const then = vi.fn();
    afterPress(then);
    expect(then).toHaveBeenCalledOnce();
  });

  it('waits for the press to end, and for the click that follows it', () => {
    vi.useFakeTimers();
    const then = vi.fn();
    press('pointerdown');
    afterPress(then);
    expect(then).not.toHaveBeenCalled();
    press('pointerup');
    expect(then).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(then).toHaveBeenCalledOnce();
    // Once: a later press doesn't run it again.
    press('pointerdown');
    press('pointerup');
    vi.runAllTimers();
    expect(then).toHaveBeenCalledOnce();
  });

  it('ends with a cancelled press too', () => {
    vi.useFakeTimers();
    const then = vi.fn();
    press('pointerdown');
    afterPress(then);
    press('pointercancel');
    vi.runAllTimers();
    expect(then).toHaveBeenCalledOnce();
  });
});
