'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { useT } from '@/i18n/use-t';
import { LABELS, type PostingLabel, type PostingNameDraft } from './posting-name';

/**
 * The username, label and batch fields: in the sign-up form and on Your account's "Your name on posts" card. The
 * username is kept in lower case as it is typed, as it will be saved.
 */
export function PostingNameFields({
  draft,
  onChange,
}: {
  draft: PostingNameDraft;
  onChange: (draft: PostingNameDraft) => void;
}) {
  const id = useId();
  const { t } = useT();
  const text = t.auth.postingName;

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-username`}>{text.username}</Label>
        <Input
          id={`${id}-username`}
          autoComplete="nickname"
          autoCapitalize="none"
          spellCheck={false}
          aria-describedby={`${id}-username-hint`}
          value={draft.username}
          onChange={(event) => onChange({ ...draft, username: event.target.value.toLowerCase() })}
        />
        <p id={`${id}-username-hint`} className="text-sm text-muted-foreground">
          {text.usernameHint}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-label`}>{text.label}</Label>
        <NativeSelect
          id={`${id}-label`}
          className="w-full"
          value={draft.label}
          onChange={(event) => onChange({ ...draft, label: event.target.value as PostingLabel })}
        >
          {LABELS.map((label) => (
            <NativeSelectOption key={label} value={label}>
              {text.labels[label]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-batch`}>{text.batch}</Label>
        <Input
          id={`${id}-batch`}
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          aria-describedby={`${id}-batch-hint`}
          value={draft.batch}
          onChange={(event) => onChange({ ...draft, batch: event.target.value })}
        />
        <p id={`${id}-batch-hint`} className="text-sm text-muted-foreground">
          {text.batchHint}
        </p>
      </div>
    </>
  );
}
