import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, Card } from '@miaa/ui';
import { fault, id, row, rows, todayEAT, type Data, type Row } from './contracts';
import { businessIdentity, categories, periodPath, range, reports } from './business-contracts';
import {
  forms,
  initial,
  optionId,
  validate,
  action,
  type Choices,
  type Draft,
  type Field as FormField,
  type FormKind,
  type Guard,
} from './forms';
import { isBusinessForm } from './business-forms';
import type { Review } from './controller';
import { useAdmin } from './provider';
import { label, useAdminText } from './text';
import {
  AdminPage,
  Choice,
  Controls,
  Field,
  Issue,
  RecordValues,
  Recovery,
  ReviewCard,
  styles,
  useResource,
} from './components';
import { ArchiveControl } from './archive';

function EditLink({
  form,
  target,
  extra = {},
  label: caption,
}: {
  form: FormKind;
  target?: number;
  extra?: Record<string, string>;
  label?: string;
}) {
  const router = useRouter(),
    { t } = useAdminText(),
    s = useAdmin();
  return (
    <Button
      tone="secondary"
      label={caption ?? t(form)}
      disabled={s.busy || !!s.pending || !s.storageReady}
      onPress={() =>
        router.push({
          pathname: '/admin/form',
          params: { form, ...(target ? { id: String(target) } : {}), ...extra },
        })
      }
    />
  );
}
function ReadValues({ data }: { data: Data | null }) {
  const { t } = useAdminText();
  if (!data) return null;
  if (Array.isArray(data))
    return (
      <>
        {data.map((r, i) => (
          <Card
            key={String(
              r.id ??
                r.personId ??
                r.motherId ??
                r.cyclistId ??
                r.date ??
                r.category ??
                r.label ??
                i,
            )}
          >
            <ReadValues data={r} />
          </Card>
        ))}
        {!data.length ? <AppText>{t('empty')}</AppText> : null}
      </>
    );
  const rates = ['share', 'completionRate', 'onTimeRate', 'marginPercent'];
  const values = Object.fromEntries(
    Object.entries(data)
      .filter(([, v]) => v === null || typeof v !== 'object')
      .map(([k, v]) => [
        k,
        v === null
          ? t('notAvailable')
          : typeof v === 'number' && rates.includes(k)
            ? `${(v * 100).toFixed(1)}%`
            : v,
      ]),
  );
  return (
    <>
      <RecordValues value={values} />
      {Object.entries(data)
        .filter(([, v]) => v !== null && typeof v === 'object')
        .map(([k, v]) => (
          <View key={k} style={styles.group}>
            <AppText variant="title" accessibilityRole="header">
              {t(k)}
            </AppText>
            <ReadValues data={v as Data} />
          </View>
        ))}
    </>
  );
}
function PeriodScreen({ mode }: { mode: 'finance' | 'payouts' | 'analytics' }) {
  const { t } = useAdminText();
  const [from, setFrom] = useState(() => todayEAT().slice(0, 8) + '01'),
    [to, setTo] = useState(() => todayEAT());
  const [period, setPeriod] = useState(() => range(from, to)),
    [error, setError] = useState<unknown>(null);
  const [report, setReport] = useState('revenue'),
    [direction, setDirection] = useState(''),
    [category, setCategory] = useState('');
  const [filters, setFilters] = useState({ direction: '', category: '' });
  const params = { from: period.from, to: period.to };
  const path =
    periodPath(mode === 'analytics' ? `analytics/${report}` : mode, period.from, period.to) +
    (mode === 'finance'
      ? (filters.direction ? `&direction=${filters.direction}` : '') +
        (filters.category ? `&category=${filters.category}` : '')
      : '');
  const resource = useResource(path),
    summary = useResource(
      mode === 'finance' ? periodPath('finance/summary', period.from, period.to) : null,
    );
  return (
    <AdminPage title={t(mode)}>
      <Recovery />
      <AppText>
        {t(
          mode === 'finance' ? 'financeHelp' : mode === 'payouts' ? 'payoutHelp' : 'analyticsHelp',
        )}
      </AppText>
      <Field label={t('from')} value={from} onChangeText={setFrom} limit={10} />
      <Field label={t('to')} value={to} onChangeText={setTo} limit={10} />
      <AppText>{t('periodHelp')}</AppText>
      {mode === 'finance' ? (
        <>
          <Choice
            label={t('direction')}
            value={direction}
            onChange={setDirection}
            options={['', 'income', 'expense'].map((v) => ({ value: v, label: t(v || 'all') }))}
          />
          <Choice
            label={t('category')}
            value={category}
            onChange={setCategory}
            options={['', ...categories].map((v) => ({ value: v, label: t(v || 'all') }))}
          />
        </>
      ) : null}
      <Button
        label={t('applyPeriod')}
        onPress={() => {
          try {
            setPeriod(range(from, to));
            setFilters({ direction, category });
            setError(null);
          } catch (e) {
            setError(e);
          }
        }}
      />
      <Issue error={error} />
      <AppText>
        {t('showingPeriod')}: {period.from} – {period.to}
      </AppText>
      {mode === 'analytics' ? (
        <Choice
          label={t('report')}
          value={report}
          onChange={setReport}
          options={reports.map((v) => ({ value: v, label: t(v) }))}
        />
      ) : null}
      {mode === 'finance' ? (
        <>
          <EditLink form="financeEntry" />
          <AppText>{t('summaryHelp')}</AppText>
          <Controls resource={summary} />
          <ReadValues data={summary.data} />
          <AppText>{t('financeLimit')}</AppText>
        </>
      ) : null}
      {mode === 'analytics' && report === 'unit-economics' ? (
        <AppText>{t('economicsHelp')}</AppText>
      ) : null}
      <Controls resource={resource} />
      {mode === 'finance' ? (
        rows(resource.data).map((r) => (
          <Card key={String(r.id)}>
            <ReadValues data={r} />
            <ArchiveControl
              kind="financeEntry"
              target={Number(r.id)}
              sourcePath={path}
              sourceData={resource.data!}
              record={r}
            />
          </Card>
        ))
      ) : mode === 'payouts' ? (
        rows(resource.data).map((r) => (
          <Card key={`${r.kind}:${r.personId}`}>
            <ReadValues data={r} />
            <EditLink
              form="payout"
              target={Number(r.personId)}
              extra={{ kind: String(r.kind), ...params }}
              label={`${t('payout')} · ${r.personName}`}
            />
          </Card>
        ))
      ) : (
        <ReadValues data={resource.data} />
      )}
      {mode !== 'analytics' && resource.data && !rows(resource.data).length ? (
        <AppText>{t('empty')}</AppText>
      ) : null}
    </AdminPage>
  );
}
export function AdminFinanceScreen() {
  return <PeriodScreen mode="finance" />;
}
export function AdminPayoutsScreen() {
  return <PeriodScreen mode="payouts" />;
}
export function AdminAnalyticsScreen() {
  return <PeriodScreen mode="analytics" />;
}
export function AdminReportsScreen() {
  const { t } = useAdminText(),
    router = useRouter();
  return (
    <AdminPage title={t('reports')}>
      <Recovery />
      {['finance', 'payouts', 'stock', 'analytics', 'archive'].map((path) => (
        <Button
          key={path}
          label={t(path)}
          tone="secondary"
          onPress={() => router.push(`/admin/${path}`)}
        />
      ))}
    </AdminPage>
  );
}
export function AdminStockScreen() {
  const { t } = useAdminText(),
    router = useRouter();
  const [inactive, setInactive] = useState(true),
    path = `stock?includeInactive=${inactive}`,
    r = useResource(path);
  return (
    <AdminPage title={t('stock')}>
      <Recovery />
      <AppText>{t('stockHelp')}</AppText>
      <EditLink form="stockItem" />
      <Button
        tone="secondary"
        label={t('includeInactive')}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: inactive }}
        onPress={() => setInactive((v) => !v)}
      />
      <Controls resource={r} />
      {rows(r.data).map((item) => (
        <Card key={String(item.id)}>
          <ReadValues data={item} />
          <Button
            tone="secondary"
            label={`${t('view')} · ${item.nameEn} / ${item.nameAm}`}
            onPress={() =>
              router.push({ pathname: '/admin/stock-detail', params: { id: String(item.id) } })
            }
          />
        </Card>
      ))}
      {r.data && !rows(r.data).length ? <AppText>{t('empty')}</AppText> : null}
    </AdminPage>
  );
}
export function AdminStockDetailScreen() {
  const p = useLocalSearchParams<{ id?: string }>();
  let target: number;
  try {
    target = routeId(p.id);
  } catch {
    return <Invalid />;
  }
  return <StockDetail target={target} />;
}
function StockDetail({ target }: { target: number }) {
  const { t } = useAdminText(),
    path = `stock/${target}`,
    r = useResource(path),
    h = useResource(`${path}/movements`),
    item = row(r.data);
  return (
    <AdminPage title={t('stock')}>
      <Recovery />
      <Controls resource={r} />
      {item ? (
        <>
          <ReadValues data={item} />
          <AppText>{t('stockHelp')}</AppText>
          <EditLink form="stockItem" target={target} label={t('edit')} />
          {item.active ? <EditLink form="stockMovement" target={target} /> : null}
          <ArchiveControl
            kind="stockItem"
            target={target}
            sourcePath={path}
            sourceData={item}
            record={item}
          />
        </>
      ) : null}
      <AppText variant="title" accessibilityRole="header">
        {t('movements')}
      </AppText>
      <AppText>{t('movementHistoryHelp')}</AppText>
      <Controls resource={h} />
      {rows(h.data).map((m) => (
        <Card key={String(m.id)}>
          <ReadValues data={m} />
          <ArchiveControl
            kind="stockMovement"
            target={Number(m.id)}
            sourcePath={`${path}/movements`}
            sourceData={h.data!}
            record={m}
          />
        </Card>
      ))}
      {h.data && !rows(h.data).length ? <AppText>{t('empty')}</AppText> : null}
    </AdminPage>
  );
}
export function AdminArchiveScreen() {
  const { t } = useAdminText(),
    r = useResource('recycle-bin');
  return (
    <AdminPage title={t('archive')}>
      <Recovery />
      <AppText>{t('binHelp')}</AppText>
      <Controls resource={r} />
      {rows(r.data).map((g) => (
        <View key={String(g.kind)} style={styles.group}>
          <AppText variant="title" accessibilityRole="header">
            {t(String(g.kind))}
          </AppText>
          {(g.items as Row[]).map((item) => (
            <Card key={`${g.kind}:${item.id}`}>
              <ReadValues data={item} />
              <ArchiveControl
                kind={String(g.kind)}
                target={Number(item.id)}
                sourcePath="recycle-bin"
                sourceData={r.data!}
                record={item}
                restore
              />
            </Card>
          ))}
        </View>
      ))}
      {r.data && !rows(r.data).some((g) => (g.items as Row[]).length) ? (
        <AppText>{t('empty')}</AppText>
      ) : null}
    </AdminPage>
  );
}
function routeId(v: unknown): number {
  if (typeof v !== 'string' || !/^\d+$/.test(v)) return fault('invalid_input');
  return id(Number(v));
}
function Invalid() {
  const { t } = useAdminText();
  return (
    <AdminPage title={t('unavailable')}>
      <AppText>{t('invalid')}</AppText>
    </AdminPage>
  );
}

export function AdminBusinessFormScreen() {
  const p = useLocalSearchParams<{
    form?: string;
    id?: string;
    kind?: string;
    from?: string;
    to?: string;
  }>();
  if (
    typeof p.form !== 'string' ||
    !isBusinessForm(p.form) ||
    ['archiveRecord', 'restoreRecord'].includes(p.form)
  )
    return <Invalid />;
  let target: number | null;
  try {
    target = p.id === undefined ? null : routeId(p.id);
    if (p.form === 'stockMovement' && !target) fault('invalid_input');
    if (p.form === 'payout') {
      if (!target || !['mother', 'cyclist'].includes(p.kind ?? '')) fault('invalid_input');
      range(p.from, p.to);
    }
  } catch {
    return <Invalid />;
  }
  return (
    <BusinessForm
      key={JSON.stringify(p)}
      kind={p.form}
      target={target}
      personKind={p.kind}
      from={p.from}
      to={p.to}
    />
  );
}

function BusinessForm({
  kind,
  target,
  personKind,
  from,
  to,
}: {
  kind: FormKind;
  target: number | null;
  personKind?: string;
  from?: string;
  to?: string;
}) {
  const { t } = useAdminText();
  const sourcePath =
    kind === 'payout'
      ? periodPath('payouts', from, to)
      : (kind === 'stockItem' && target) || kind === 'stockMovement'
        ? 'stock?includeInactive=true'
        : null;
  const resource = useResource(sourcePath);
  const key = kind === 'payout' ? `${personKind}:${target}` : undefined;
  let source: Row | null = null;
  if (resource.data) {
    try {
      source = key
        ? businessIdentity(resource.data, key)
        : (rows(resource.data).find((x) => x.id === target) ?? null);
    } catch {
      /* Missing source stays blocked. */
    }
  }
  const needsSource =
    kind === 'payout' || kind === 'stockMovement' || (kind === 'stockItem' && !!target);
  const guard =
    source && sourcePath
      ? {
          path: sourcePath,
          ...(key ? { key } : { identity: target! }),
          fingerprint: JSON.stringify(source),
        }
      : undefined;
  return (
    <AdminPage title={t(kind)}>
      <Recovery />
      {sourcePath ? <Controls resource={resource} /> : null}
      {needsSource && !source ? (
        resource.busy || resource.error ? null : (
          <AppText>{t('changed')}</AppText>
        )
      ) : (
        <BusinessEditor
          key={JSON.stringify([kind, target, source])}
          kind={kind}
          target={target}
          source={source}
          guard={guard}
          period={kind === 'payout' ? `${from} – ${to}` : null}
        />
      )}
    </AdminPage>
  );
}
function BusinessEditor({
  kind,
  target,
  source,
  guard,
  period,
}: {
  kind: FormKind;
  target: number | null;
  source: Row | null;
  guard?: Guard;
  period: string | null;
}) {
  const { t, locale } = useAdminText(),
    s = useAdmin();
  const [draft, setDraft] = useState<Draft>(() => ({
    ...initial(
      kind,
      kind === 'payout'
        ? {
            ...source,
            amountEtb:
              typeof source?.outstandingEtb === 'string' &&
              /^\d{1,9}(\.\d{1,2})?$/.test(source.outstandingEtb)
                ? source.outstandingEtb
                : '',
            periodLabel: period,
          }
        : kind === 'stockMovement'
          ? { stockItemId: target }
          : source,
    ),
  }));
  const [review, setReview] = useState<Review | null>(null),
    [error, setError] = useState<unknown>(null);
  const mothers = useResource(kind === 'financeEntry' ? 'mothers?includeInactive=true' : null),
    cyclists = useResource(kind === 'financeEntry' ? 'cyclists?includeInactive=true' : null);
  const options: Choices = {
    mothers: rows(mothers.data),
    cyclists: rows(cyclists.data),
    stock: source ? [source] : [],
    payees: source ? [source] : [],
  };
  const fields = forms[kind] as FormField[];
  const disabled = s.busy || !!s.pending || !s.storageReady;
  function change(key: string, v: string | boolean) {
    setDraft((d) => ({
      ...d,
      [key]: v,
      ...(key === 'direction' ? { category: '' } : {}),
      ...(key === 'movementType' ? { unitCostEtb: '', createExpense: false } : {}),
    }));
    setReview(null);
  }
  function choices(f: FormField) {
    return f.choices
      ? (f.key === 'category'
          ? f.choices.filter(
              (c) => categories.slice(0, 2).includes(c) === (draft.direction === 'income'),
            )
          : f.choices
        ).map((v) => ({ value: v, label: t(label(v)) }))
      : (options[f.source!] ?? []).map((r) => ({
          value: String(optionId(f, r)),
          label: `${r.personName ?? r.name ?? r[locale === 'am' ? 'nameAm' : 'nameEn']} · #${optionId(f, r)}`,
        }));
  }
  function prepare() {
    try {
      const body = validate(kind, draft, options);
      if (
        kind === 'stockItem' &&
        source &&
        Number(source.movementCount) > 0 &&
        body.unit !== source.unit
      )
        fault('invalid_input');
      setReview(s.model.review(action(kind, body, target, guard)));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }
  const help =
    kind === 'financeEntry'
      ? 'financeHelp'
      : kind === 'payout'
        ? 'payoutHelp'
        : kind === 'stockItem'
          ? 'stockHelp'
          : 'movementHelp';
  return (
    <View style={styles.group}>
      <AppText>{t(help)}</AppText>
      {source ? <ReadValues data={source} /> : null}
      {kind === 'payout' ? (
        <>
          <AppText>
            {t('showingPeriod')}: {period}
          </AppText>
          <AppText>{t('payoutAllocationHelp')}</AppText>
        </>
      ) : null}
      {kind === 'stockItem' && source && Number(source.movementCount) > 0 ? (
        <AppText>{t('unitLocked')}</AppText>
      ) : null}
      {[mothers, cyclists].map((r, i) =>
        r.busy || r.error ? <Controls key={i} resource={r} /> : null,
      )}
      {fields
        .filter(
          (f) =>
            !(kind === 'payout' && ['kind', 'personId'].includes(f.key)) &&
            !(kind === 'stockMovement' && f.key === 'stockItemId') &&
            !(
              kind === 'stockMovement' &&
              draft.movementType !== 'purchase' &&
              ['unitCostEtb', 'createExpense'].includes(f.key)
            ),
        )
        .map((f) =>
          f.type === 'bool' ? (
            <Choice
              key={f.key}
              label={t(f.key)}
              value={draft[f.key] ? 'true' : 'false'}
              disabled={disabled}
              onChange={(v) => change(f.key, v === 'true')}
              options={[
                { value: 'true', label: t('yes') + ' · ' + t(f.key) },
                { value: 'false', label: t('no') + ' · ' + t(f.key) },
              ]}
            />
          ) : f.type === 'select' ? (
            <Choice
              key={f.key}
              label={t(f.key)}
              value={String(draft[f.key] ?? '')}
              disabled={
                disabled ||
                (kind === 'stockItem' && f.key === 'unit' && Number(source?.movementCount) > 0)
              }
              onChange={(v) => change(f.key, v)}
              options={[...(f.optional ? [{ value: '', label: t('none') }] : []), ...choices(f)]}
            />
          ) : (
            <Field
              key={f.key}
              label={t(f.key)}
              value={String(draft[f.key] ?? '')}
              onChangeText={(v) => change(f.key, v)}
              disabled={disabled}
              limit={f.limit}
              numeric={f.type === 'money'}
            />
          ),
        )}
      <Issue error={error} />
      {review ? (
        <ReviewCard review={review} onCancel={() => setReview(null)}>
          <AppText>{t(help)}</AppText>
          {source ? <ReadValues data={source} /> : null}
          <ReadValues data={review.action.body ?? null} />
          {fields
            .filter((f) => f.source && review.action.body?.[f.key])
            .map((f) => (
              <AppText key={f.key}>
                {t(f.key)}:{' '}
                {choices(f).find((c) => c.value === String(review.action.body![f.key]))?.label}
              </AppText>
            ))}
          {kind === 'payout' ? (
            <AppText>
              {t('payoutAllocationHelp')} · {period}
            </AppText>
          ) : null}
        </ReviewCard>
      ) : (
        <Button
          label={t('review')}
          disabled={
            disabled || mothers.busy || !!mothers.error || cyclists.busy || !!cyclists.error
          }
          onPress={prepare}
        />
      )}
      <AppText variant="small">{t('storageInfo')}</AppText>
    </View>
  );
}
