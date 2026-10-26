import { useState } from 'react';
import { AppText, Button } from '@miaa/ui';
import { type Data, type Row } from './contracts';
import { action } from './forms';
import { type Review } from './controller';
import { useAdmin } from './provider';
import { useAdminText } from './text';
import { Issue, RecordValues, ReviewCard } from './components';
export function ArchiveControl({
  kind,
  target,
  sourcePath,
  sourceData,
  record,
  restore = false,
}: {
  kind: string;
  target: number;
  sourcePath: string;
  sourceData: Data;
  record: Row;
  restore?: boolean;
}) {
  const s = useAdmin(),
    { t } = useAdminText();
  const [review, setReview] = useState<Review | null>(null),
    [error, setError] = useState<unknown>(null);
  const disabled = s.busy || !!s.pending || !s.storageReady;
  const warning = restore
    ? 'restoreHelp'
    : kind === 'financeEntry'
      ? 'archiveFinanceHelp'
      : kind === 'stockMovement'
        ? 'archiveMovementHelp'
        : 'archiveHelp';
  return (
    <>
      <Issue error={error} />
      {review ? (
        <ReviewCard review={review} onCancel={() => setReview(null)}>
          <AppText>
            {t(restore ? 'restoreRecord' : 'archiveRecord')} · {t(kind)}
          </AppText>
          <RecordValues value={record} />
          <AppText>{t(warning)}</AppText>
          {restore && kind === 'client' ? <AppText>{t('restoreClientHelp')}</AppText> : null}
        </ReviewCard>
      ) : (
        <Button
          tone="secondary"
          label={t(restore ? 'restoreRecord' : 'archiveRecord') + ' · ' + t(kind) + ' #' + target}
          disabled={disabled}
          onPress={() => {
            try {
              setReview(
                s.model.review(
                  action(
                    restore ? 'restoreRecord' : 'archiveRecord',
                    { recordKind: kind },
                    target,
                    restore
                      ? {
                          path: sourcePath,
                          key: `${kind}:${target}`,
                          fingerprint: JSON.stringify(record),
                        }
                      : { path: sourcePath, fingerprint: JSON.stringify(sourceData) },
                  ),
                ),
              );
              setError(null);
            } catch (e) {
              setError(e);
            }
          }}
        />
      )}
    </>
  );
}
