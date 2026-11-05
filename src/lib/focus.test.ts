import { describe, expect, it, vi } from 'vitest';
import { createFocusAfter } from './focus';

const element = () => ({ focus: vi.fn() }) as unknown as HTMLElement & { focus: ReturnType<typeof vi.fn> };

describe('createFocusAfter', () => {
  it('focuses nothing until a mark, then only the element of that key, once', () => {
    const focus = createFocusAfter();
    const row = element();
    const other = element();
    focus.refFor('row')(row);
    expect(row.focus).not.toHaveBeenCalled();

    focus.mark('row');
    focus.refFor('other')(other);
    focus.refFor('row')(null);
    expect(other.focus).not.toHaveBeenCalled();
    focus.refFor('row')(row);
    expect(row.focus).toHaveBeenCalledOnce();

    // Taken: the next commit leaves it alone.
    focus.refFor('row')(row);
    expect(row.focus).toHaveBeenCalledOnce();
  });

  it('keeps only the last mark', () => {
    const focus = createFocusAfter();
    const first = element();
    const second = element();
    focus.mark('first');
    focus.mark('second');
    focus.refFor('first')(first);
    focus.refFor('second')(second);
    expect(first.focus).not.toHaveBeenCalled();
    expect(second.focus).toHaveBeenCalledOnce();
  });
});
