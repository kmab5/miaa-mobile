import { ArchiveControl } from './archive';
import { AdminBusinessFormScreen } from './business-screens';
import { isBusinessForm } from './business-forms';
import { useState } from 'react';
import { MobileApiError } from '@miaa/api';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, Button, Card } from '@miaa/ui';
import { date, fault, rows, row, todayEAT, type Row } from './contracts';
import {
  action,
  forms,
  guardData,
  initial,
  isForm,
  optionId,
  validate,
  type Choices,
  type Draft,
  type Field as FormField,
  type FormKind,
  type Guard,
} from './forms';
import { type Review } from './controller';
import { useAdmin } from './provider';
import { useAdminText } from './text';
import {
  AdminPage,
  Choice,
  Controls,
  DataText,
  Field,
  Issue,
  RecordValues,
  Recovery,
  ReviewCard,
  styles,
  useResource,
} from './components';
function routeNumber(value: unknown): number | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > 2147483647)
    fault('invalid_input');
  return Number(value);
}
export function formLink(form: FormKind, target?: number, extra: Record<string, string> = {}) {
  return {
    pathname: '/admin/form' as const,
    params: { form, ...(target ? { id: String(target) } : {}), ...extra },
  };
}
function Links() {
  const router = useRouter();
  const { t } = useAdminText();
  return (
    <View style={styles.group}>
      {['daily', 'people', 'catalog', 'orders', 'payments', 'support', 'settings', 'reports'].map(
        (path) => (
          <Button
            key={path}
            label={t(path)}
            tone={path === 'daily' ? 'primary' : 'secondary'}
            onPress={() => router.push(`/admin/${path}`)}
          />
        ),
      )}
    </View>
  );
}
export function AdminHomeScreen() {
  const { t } = useAdminText();
  return (
    <AdminPage title={t('home')} home>
      <Recovery />
      <Links />
    </AdminPage>
  );
}
export function AdminWorkspaceScreen() {
  const { t } = useAdminText();
  return (
    <AdminPage title={t('workspace')} home>
      <Recovery />
      <Links />
    </AdminPage>
  );
}
function OpenForm({
  form,
  target,
  extra,
  label,
}: {
  form: FormKind;
  target?: number;
  extra?: Record<string, string>;
  label?: string;
}) {
  const router = useRouter();
  const { t } = useAdminText();
  const s = useAdmin();
  return (
    <Button
      label={label ?? t(form)}
      tone="secondary"
      disabled={s.busy || !!s.pending || !s.storageReady}
      onPress={() => router.push(formLink(form, target, extra))}
    />
  );
}
export function AdminPeopleScreen() {
  const { t } = useAdminText();
  const router = useRouter();
  const [kind, setKind] = useState('mothers');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [inactive, setInactive] = useState(true);
  const resource = useResource(
    kind === 'clients'
      ? `clients?search=${encodeURIComponent(search)}`
      : `${kind}?includeInactive=${inactive}`,
  );
  return (
    <AdminPage title={t('people')}>
      <Recovery />
      <View style={styles.row}>
        {['mothers', 'cyclists', 'clients'].map((x) => (
          <Button
            key={x}
            label={t(x)}
            accessibilityRole="radio"
            accessibilityState={{ checked: kind === x }}
            tone="secondary"
            onPress={() => setKind(x)}
          />
        ))}
      </View>
      <OpenForm
        form={kind === 'mothers' ? 'mother' : kind === 'cyclists' ? 'cyclist' : 'client'}
        label={t(
          kind === 'mothers' ? 'addMother' : kind === 'cyclists' ? 'addCyclist' : 'addClient',
        )}
      />
      {kind === 'clients' ? (
        <>
          <Field label={t('search')} value={query} onChangeText={setQuery} limit={120} />
          <Button label={t('find')} onPress={() => setSearch(query.trim())} />
        </>
      ) : (
        <Button
          label={t('includeInactive')}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: inactive }}
          tone="secondary"
          onPress={() => setInactive((v) => !v)}
        />
      )}
      <AppText variant="small">{t('listLimit')}</AppText>
      <Controls resource={resource} />
      {rows(resource.data).map((x) => (
        <Card key={String(x.id)}>
          <RecordValues value={x} />
          <Button
            label={`${t('view')} · ${x.name}`}
            tone="secondary"
            onPress={() =>
              router.push({ pathname: '/admin/record', params: { kind, id: String(x.id) } })
            }
          />
        </Card>
      ))}
      {resource.data && rows(resource.data).length === 0 ? <AppText>{t('empty')}</AppText> : null}
    </AdminPage>
  );
}
export function AdminCatalogScreen() {
  const { t } = useAdminText();
  const [kind, setKind] = useState<'dishes' | 'packages'>('dishes');
  const resource = useResource(kind + '?includeInactive=true');
  return (
    <AdminPage title={t('catalog')}>
      <Recovery />
      <AppText>{t('priceNote')}</AppText>
      <View style={styles.row}>
        {(['dishes', 'packages'] as const).map((x) => (
          <Button
            key={x}
            label={t(x)}
            accessibilityRole="radio"
            accessibilityState={{ checked: kind === x }}
            tone="secondary"
            onPress={() => setKind(x)}
          />
        ))}
      </View>
      <OpenForm
        form={kind === 'dishes' ? 'dish' : 'package'}
        label={t(kind === 'dishes' ? 'addDish' : 'addPackage')}
      />
      <OpenForm form="offering" />
      <Controls resource={resource} />
      {rows(resource.data).map((x) => (
        <Card key={String(x.id)}>
          <RecordValues value={x} />
          <OpenForm
            form={kind === 'dishes' ? 'dish' : 'package'}
            target={Number(x.id)}
            label={`${t('edit')} · ${x.nameEn ?? x.labelEn}`}
          />
          <ArchiveControl
            kind={kind === 'dishes' ? 'dish' : 'packageType'}
            target={Number(x.id)}
            sourcePath={kind + '?includeInactive=true'}
            sourceData={resource.data!}
            record={x}
          />
        </Card>
      ))}
    </AdminPage>
  );
}
export function AdminOrdersScreen() {
  const { t } = useAdminText();
  const router = useRouter();
  const [status, setStatus] = useState('');
  const resource = useResource('orders' + (status ? '?status=' + status : ''));
  return (
    <AdminPage title={t('orders')}>
      <Recovery />
      <OpenForm form="order" label={t('newOrder')} />
      <Choice
        label={t('status')}
        value={status}
        onChange={setStatus}
        options={['', 'pending_payment', 'active', 'cancelled', 'completed'].map((x) => ({
          value: x,
          label: t(x || 'none'),
        }))}
      />
      <AppText variant="small">{t('listLimit')}</AppText>
      <Controls resource={resource} />
      {rows(resource.data).map((x) => (
        <Card key={String(x.id)}>
          <RecordValues value={x} />
          <Button
            label={`${t('view')} #${x.id}`}
            tone="secondary"
            onPress={() =>
              router.push({
                pathname: '/admin/record',
                params: { kind: 'orders', id: String(x.id) },
              })
            }
          />
        </Card>
      ))}
    </AdminPage>
  );
}
export function AdminPaymentsScreen() {
  const { t } = useAdminText();
  const r = useResource('payments/pending');
  return (
    <AdminPage title={t('payments')}>
      <Recovery />
      <AppText>{t('paymentHelp')}</AppText>
      <AppText variant="small">{t('listLimit')}</AppText>
      <Controls resource={r} />
      {rows(r.data).map((x) => {
        const p = x.payment as Row;
        return (
          <Card key={String(p.id)}>
            <RecordValues value={{ ...p, subscriptionStatus: x.subscriptionStatus! }} />
            {x.subscriptionStatus !== 'cancelled' ? (
              <OpenForm form="paymentConfirm" target={Number(p.id)} />
            ) : null}
            <OpenForm form="failPayment" target={Number(p.id)} />
            <ArchiveControl
              kind="payment"
              target={Number(p.id)}
              sourcePath="payments/pending"
              sourceData={r.data!}
              record={p}
            />
          </Card>
        );
      })}
      {r.data && rows(r.data).length === 0 ? <AppText>{t('empty')}</AppText> : null}
    </AdminPage>
  );
}
export function AdminSupportScreen() {
  const { t } = useAdminText();
  const [status, setStatus] = useState('');
  const r = useResource('tickets' + (status ? '?status=' + status : ''));
  return (
    <AdminPage title={t('support')}>
      <Recovery />
      <OpenForm form="ticket" label={t('newTicket')} />
      <Choice
        label={t('status')}
        value={status}
        onChange={setStatus}
        options={['', 'open', 'resolved'].map((x) => ({ value: x, label: t(x || 'none') }))}
      />
      <AppText variant="small">{t('listLimit')}</AppText>
      <Controls resource={r} />
      {rows(r.data).map((x) => (
        <Card key={String(x.id)}>
          <RecordValues value={x} />
          <OpenForm
            form={x.status === 'open' ? 'resolveTicket' : 'reopenTicket'}
            target={Number(x.id)}
          />
          <ArchiveControl
            kind="ticket"
            target={Number(x.id)}
            sourcePath={'tickets' + (status ? '?status=' + status : '')}
            sourceData={r.data!}
            record={x}
          />
        </Card>
      ))}
    </AdminPage>
  );
}
function DeliveryActions({ item, day }: { item: Row; day: string }) {
  const { t } = useAdminText();
  const target = Number(item.id);
  return (
    <>
      <RecordValues value={item} />
      {item.status === 'preparing' ? (
        <OpenForm form="packageDelivery" target={target} extra={{ date: day }} />
      ) : item.status === 'packaged' ? (
        <OpenForm form="collectDelivery" target={target} extra={{ date: day }} />
      ) : item.status === 'out_for_delivery' ? (
        <OpenForm form="confirmDelivery" target={target} extra={{ date: day }} />
      ) : null}
      {!['delivered', 'cancelled'].includes(String(item.status)) ? (
        <OpenForm form="assignment" target={target} extra={{ date: day }} />
      ) : null}
      {typeof item.deliveryDate === 'string' &&
      item.deliveryDate > todayEAT() &&
      item.status !== 'cancelled' ? (
        <OpenForm form="changeDish" target={target} extra={{ date: day }} />
      ) : null}
      <OpenForm form="redelivery" target={target} extra={{ date: day }} label={t('redelivery')} />
    </>
  );
}
export function AdminDailyScreen() {
  const { t } = useAdminText();
  const [input, setInput] = useState(() => todayEAT());
  const [day, setDay] = useState(input);
  const [view, setView] = useState('day');
  const [error, setError] = useState<unknown>(null);
  const r = useResource(`${view}?date=${day}`);
  const board = row(r.data);
  return (
    <AdminPage title={t('daily')}>
      <Recovery />
      <Field label={t('date')} value={input} onChangeText={setInput} limit={10} />
      <Button
        label={t('applyDate')}
        onPress={() => {
          try {
            setDay(date(input));
            setError(null);
          } catch {
            setError(new MobileApiError(0, 'invalid_input', 'Check the date.'));
          }
        }}
      />
      <Issue error={error} />
      <View style={styles.row}>
        {[
          ['day', 'daily'],
          ['prep-sheets', 'prep'],
          ['run-sheets', 'runs'],
          ['labels', 'labels'],
        ].map(([v, k]) => (
          <Button
            key={v}
            label={t(k!)}
            tone="secondary"
            accessibilityRole="radio"
            accessibilityState={{ checked: view === v }}
            onPress={() => setView(v!)}
          />
        ))}
      </View>
      <Controls resource={r} />
      {view === 'day' && board ? (
        <>
          <RecordValues value={{ date: board.date!, total: board.total! }} />
          <RecordValues value={board.counts as Row} />
          <AppText>{t('pastOverride')}</AppText>
          {(board.groups as Row[]).map((g, i) => (
            <Card key={i}>
              <RecordValues
                value={{
                  motherName: g.motherName!,
                  capacity: g.capacity!,
                  unassignedCount: g.unassignedCount!,
                }}
              />
              {(g.deliveries as Row[]).map((item) => (
                <Card key={String(item.id)}>
                  <DeliveryActions item={item} day={day} />
                  <ArchiveControl
                    kind="delivery"
                    target={Number(item.id)}
                    sourcePath={`day?date=${day}`}
                    sourceData={r.data!}
                    record={item}
                  />
                </Card>
              ))}
            </Card>
          ))}
        </>
      ) : view === 'labels' ? (
        <>
          <AppText>{t('noPrinter')}</AppText>
          {rows(r.data).map((x, i) => (
            <Card key={i}>
              <RecordValues value={x} />
            </Card>
          ))}
        </>
      ) : (
        rows(r.data).map((x, i) => (
          <Card key={i}>
            <RecordValues value={x} />
            {Array.isArray(x.tallies)
              ? (x.tallies as Row[]).map((v, j) => <RecordValues key={j} value={v} />)
              : null}
            {Array.isArray(x.deliveries)
              ? (x.deliveries as Row[]).map((v) => (
                  <Card key={String(v.id)}>
                    <RecordValues value={v} />
                  </Card>
                ))
              : null}
          </Card>
        ))
      )}
    </AdminPage>
  );
}
export function AdminRecordScreen() {
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  if (!['mothers', 'cyclists', 'clients', 'orders'].includes(params.kind ?? '')) return <Invalid />;
  let target: number | null;
  try {
    target = routeNumber(params.id);
  } catch {
    return <Invalid />;
  }
  return target ? <RecordScreen kind={params.kind!} target={target} /> : <Invalid />;
}
function RecordScreen({ kind, target }: { kind: string; target: number }) {
  const { t } = useAdminText();
  const router = useRouter();
  const resource = useResource(`${kind}/${target}`);
  const data = row(resource.data);
  return (
    <AdminPage title={t(kind)}>
      <Recovery />
      <Controls resource={resource} />
      {data ? (
        <>
          <RecordValues value={data} />
          <ArchiveControl
            kind={
              kind === 'mothers'
                ? 'mother'
                : kind === 'cyclists'
                  ? 'cyclist'
                  : kind === 'clients'
                    ? 'client'
                    : 'subscription'
            }
            target={target}
            sourcePath={`${kind}/${target}`}
            sourceData={data}
            record={kind === 'orders' ? (data.subscription as Row) : data}
          />
          {kind === 'orders' ? (
            <>
              <RecordValues value={data.subscription as Row} />
              {['active', 'pending_payment'].includes(String((data.subscription as Row).status)) ? (
                <OpenForm form="cancelOrder" target={target} />
              ) : null}
              {(data.payments as Row[]).map((p) => (
                <Card key={String(p.id)}>
                  <RecordValues value={p} />
                  <ArchiveControl
                    kind="payment"
                    target={Number(p.id)}
                    sourcePath={`${kind}/${target}`}
                    sourceData={data}
                    record={p}
                  />
                </Card>
              ))}
              {(data.deliveries as Row[]).map((d) => (
                <Card key={String(d.id)}>
                  <RecordValues value={d} />
                  <ArchiveControl
                    kind="delivery"
                    target={Number(d.id)}
                    sourcePath={`${kind}/${target}`}
                    sourceData={data}
                    record={d}
                  />
                </Card>
              ))}
            </>
          ) : (
            <>
              <OpenForm
                form={kind === 'mothers' ? 'mother' : kind === 'cyclists' ? 'cyclist' : 'client'}
                target={target}
                label={t('edit')}
              />
              {kind === 'mothers' ? (
                <>
                  <OpenForm form="motherStatus" target={target} />
                  <OpenForm form="motherPassword" target={target} />
                  <OpenForm form="inspection" target={target} />
                  <OpenForm form="offering" target={target} />
                  <Offerings mother={target} />
                </>
              ) : kind === 'cyclists' ? (
                <>
                  <OpenForm form="cyclistStatus" target={target} />
                  <OpenForm form="cyclistPassword" target={target} />
                </>
              ) : (
                <Button
                  label={t('newOrder')}
                  onPress={() =>
                    router.push(formLink('order', undefined, { clientId: String(target) }))
                  }
                />
              )}
            </>
          )}
        </>
      ) : null}
    </AdminPage>
  );
}
function Offerings({ mother }: { mother: number }) {
  const { t } = useAdminText();
  const r = useResource(`mothers/${mother}/offerings`);
  return (
    <>
      <AppText accessibilityRole="header" variant="title">
        {t('offeringsTitle')}
      </AppText>
      <Controls resource={r} />
      {rows(r.data).map((x) => (
        <Card key={String(x.packageTypeId)}>
          <RecordValues value={x} />
          {x.offeringId ? (
            <ArchiveControl
              kind="offering"
              target={Number(x.offeringId)}
              sourcePath={`mothers/${mother}/offerings`}
              sourceData={r.data!}
              record={x}
            />
          ) : null}
        </Card>
      ))}
    </>
  );
}
export function AdminSettingsScreen() {
  return <FormScreen kind="settings" target={null} />;
}
function Invalid() {
  const { t } = useAdminText();
  return (
    <AdminPage title={t('unavailable')}>
      <AppText>{t('invalid')}</AppText>
    </AdminPage>
  );
}
export function AdminFormScreen() {
  const p = useLocalSearchParams<{
    form?: string;
    id?: string;
    date?: string;
    clientId?: string;
  }>();
  if (!isForm(p.form)) return <Invalid />;
  if (isBusinessForm(p.form)) return <AdminBusinessFormScreen />;
  let target: number | null = null,
    client: number | null = null;
  try {
    target = routeNumber(p.id);
    client = routeNumber(p.clientId);
    if (p.date) date(p.date);
  } catch {
    return <Invalid />;
  }
  return <FormScreen kind={p.form} target={target} day={p.date} client={client} />;
}
function sourcePath(kind: FormKind, target: number | null, day: string) {
  if (kind === 'settings') return 'settings';
  if (!target) return null;
  if (['mother', 'motherStatus', 'motherPassword', 'inspection', 'offering'].includes(kind))
    return `mothers/${target}`;
  if (['cyclist', 'cyclistStatus', 'cyclistPassword'].includes(kind)) return `cyclists/${target}`;
  if (kind === 'client') return `clients/${target}`;
  if (kind === 'dish') return 'dishes?includeInactive=true';
  if (kind === 'package') return 'packages?includeInactive=true';
  if (kind === 'paymentConfirm' || kind === 'failPayment') return 'payments/pending';
  if (kind === 'cancelOrder') return `orders/${target}`;
  if (kind === 'resolveTicket' || kind === 'reopenTicket') return 'tickets';
  if (
    [
      'assignment',
      'changeDish',
      'redelivery',
      'packageDelivery',
      'collectDelivery',
      'confirmDelivery',
    ].includes(kind)
  )
    return `day?date=${day}`;
  return null;
}
function FormScreen({
  kind,
  target,
  day = todayEAT(),
  client = null,
}: {
  kind: FormKind;
  target: number | null;
  day?: string;
  client?: number | null;
}) {
  const { t } = useAdminText();
  const s = useAdmin();
  const path = sourcePath(kind, target, day);
  const r = useResource(path);
  let source: Row | null = null;
  let error: unknown = null;
  let guard: Guard | undefined;
  if (r.data && path) {
    try {
      const useIdentity = Array.isArray(r.data) || path.startsWith('day?');
      source = guardData(r.data, useIdentity ? (target ?? undefined) : undefined) as Row;
      guard = {
        path,
        ...(useIdentity && target ? { identity: target } : {}),
        fingerprint: JSON.stringify(source),
      };
    } catch (e) {
      if (!(s.notice === 'saved' && s.receipt?.id === target && s.receipt?.form === kind))
        error = e;
    }
  }
  return (
    <AdminPage title={t(kind)}>
      <Recovery />
      {path ? <Controls resource={r} /> : null}
      <Issue error={error} />
      {(!path || source) && !error ? (
        <FormBody
          key={kind + ':' + target + ':' + JSON.stringify(source)}
          kind={kind}
          target={target}
          source={source}
          guard={guard}
          client={client}
        />
      ) : null}
    </AdminPage>
  );
}
function FormBody({
  kind,
  target,
  source,
  guard,
  client,
}: {
  kind: FormKind;
  target: number | null;
  source: Row | null;
  guard?: Guard;
  client: number | null;
}) {
  const s = useAdmin();
  const { t, locale } = useAdminText();
  const fields = forms[kind] as FormField[];
  const [draft, setDraft] = useState<Draft>(() => {
    const d = initial(kind, source);
    if (target && ['offering', 'inspection'].includes(kind)) d.motherId = String(target);
    if (client) d.clientId = String(client);
    return d;
  });
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<unknown>(null);
  const needs = (name: string) => fields.some((x) => x.source === name);
  const mothers = useResource(needs('mothers') ? 'mothers?includeInactive=true' : null),
    cyclists = useResource(needs('cyclists') ? 'cyclists?includeInactive=true' : null),
    clients = useResource(needs('clients') ? 'clients' : null),
    dishes = useResource(needs('dishes') ? 'dishes?includeInactive=true' : null),
    packages = useResource(needs('packages') ? 'packages?includeInactive=true' : null);
  const selectedClient = useResource(client ? `clients/${client}` : null);
  const mother = Number(draft.motherId);
  const offeringResource = useResource(
    kind === 'order' && mother > 0 ? `mothers/${mother}/offerings` : null,
  );
  const options: Choices = {
    mothers: rows(mothers.data),
    cyclists: rows(cyclists.data),
    clients: [
      ...rows(clients.data).filter((x) => x.id !== client),
      ...(row(selectedClient.data) ? [row(selectedClient.data)!] : []),
    ],
    dishes: rows(dishes.data),
    packages: rows(packages.data),
    offerings: rows(offeringResource.data),
  };
  const offer = (options.offerings ?? []).find(
    (x) => x.offeringId === Number(draft.motherOfferingId),
  );
  const demo = offer?.duration === 'demo';
  const disabled = s.busy || !!s.pending || !s.storageReady || s.retryAt !== 0;
  function change(key: string, value: string | boolean) {
    setDraft((v) => ({
      ...v,
      [key]: value,
      ...(key === 'motherId' && kind === 'order' ? { motherOfferingId: '' } : {}),
    }));
    setReview(null);
    setError(null);
  }
  function selections(field: FormField) {
    if (field.choices) return field.choices.map((value) => ({ value, label: t(value) }));
    let list = options[field.source ?? ''] ?? [];
    if (field.key === 'motherOfferingId')
      list = list.filter((x) => x.active === true && x.offeringId !== null);
    else list = list.filter((x) => x.active !== false && x.status !== 'inactive');
    if (kind === 'order' && field.key.startsWith('weekday') && offer) {
      let wd = Number(field.key.slice(7));
      if (demo && typeof draft.demoDate === 'string') {
        wd = new Date(draft.demoDate + 'T00:00:00Z').getUTCDay();
      }
      const fasting =
        offer.foodCategory === 'fasting'
          ? true
          : offer.foodCategory === 'non_fasting'
            ? false
            : offer.foodCategory === 'combined'
              ? [3, 5].includes(wd)
              : null;
      if (fasting !== null) list = list.filter((x) => x.isFasting === fasting);
    }
    const result = list.map((x) => ({
      value: String(optionId(field, x)),
      label: `#${optionId(field, x)} · ${x.name ?? (locale === 'am' ? (x.nameAm ?? x.labelAm) : (x.nameEn ?? x.labelEn)) ?? '—'}${x.priceEtb != null ? ' · ' + x.priceEtb + ' ETB' : ''}`,
    }));
    return field.optional
      ? [
          {
            value: '',
            label: t(
              kind === 'assignment'
                ? 'keepCurrent'
                : kind === 'redelivery'
                  ? 'useOriginal'
                  : 'none',
            ),
          },
          ...result,
        ]
      : result;
  }
  function prepare() {
    try {
      if (
        [
          'packageDelivery',
          'collectDelivery',
          'confirmDelivery',
          'assignment',
          'changeDish',
          'redelivery',
          'cancelOrder',
          'paymentConfirm',
          'failPayment',
          'resolveTicket',
          'reopenTicket',
          'motherStatus',
          'cyclistStatus',
          'motherPassword',
          'cyclistPassword',
        ].includes(kind) &&
        (!target || !source)
      )
        fault('invalid_input');
      const body = validate(kind, draft, options);
      if (kind === 'inspection' && String(body.inspectedAt) > todayEAT()) fault('invalid_input');
      if (kind === 'assignment' && source?.status !== 'preparing' && body.motherId)
        fault('invalid_input');
      if (
        (kind === 'packageDelivery' && source?.status !== 'preparing') ||
        (kind === 'collectDelivery' && source?.status !== 'packaged') ||
        (kind === 'confirmDelivery' && source?.status !== 'out_for_delivery')
      )
        fault('state_changed');
      setReview(
        s.model.review(
          action(
            kind,
            body,
            target,
            kind === 'order' && offer
              ? {
                  path: `mothers/${Number(draft.motherId)}/offerings`,
                  identity: Number(offer.offeringId),
                  fingerprint: JSON.stringify(offer),
                }
              : guard,
          ),
        ),
      );
      setError(null);
    } catch (e) {
      setError(e);
    }
  }
  const resources = [
    mothers,
    cyclists,
    clients,
    dishes,
    packages,
    selectedClient,
    offeringResource,
  ];
  return (
    <View style={styles.group}>
      {source ? (
        <Card>
          <RecordValues value={source} />
          {source.payment ? <RecordValues value={source.payment as Row} /> : null}
          {source.subscription ? <RecordValues value={source.subscription as Row} /> : null}
        </Card>
      ) : null}
      <AppText>
        {t(
          kind.endsWith('Password')
            ? 'passwordHelp'
            : kind === 'cancelOrder'
              ? 'cancelHelp'
              : kind === 'paymentConfirm' || kind === 'failPayment'
                ? 'paymentHelp'
                : kind.endsWith('Status')
                  ? 'inactiveHelp'
                  : kind === 'order'
                    ? 'orderHelp'
                    : 'readBeforeWrite',
        )}
      </AppText>
      {kind === 'order' ? <AppText>{t('orderClientHelp')}</AppText> : null}
      {kind === 'order' &&
      (options.clients ?? []).some(
        (x) =>
          x.id === Number(draft.clientId) &&
          typeof x.latitude === 'number' &&
          typeof x.longitude === 'number',
      ) ? (
        <Button
          label={t('useAddress')}
          tone="secondary"
          disabled={disabled}
          onPress={() => {
            const c = (options.clients ?? []).find((x) => x.id === Number(draft.clientId))!;
            setDraft((v) => ({
              ...v,
              latitude: String(c.latitude),
              longitude: String(c.longitude),
              addressNote: typeof c.addressNote === 'string' ? c.addressNote : '',
            }));
            setReview(null);
          }}
        />
      ) : null}
      {resources.map((r, i) => (r.busy || r.error ? <Controls key={i} resource={r} /> : null))}
      {fields
        .filter((field) => {
          if (kind === 'assignment' && field.key === 'motherId' && source?.status !== 'preparing')
            return false;
          if (kind !== 'order') return true;
          if (field.key === 'demoDate') return demo;
          if (field.key.startsWith('weekday')) {
            if (!offer) return false;
            if (!demo) return true;
            const d = String(draft.demoDate ?? '');
            return Number(field.key.slice(7)) === new Date(d + 'T00:00:00Z').getUTCDay();
          }
          return true;
        })
        .map((field) =>
          field.type === 'bool' ? (
            <Choice
              key={field.key}
              label={t(field.key)}
              value={draft[field.key] ? 'true' : 'false'}
              onChange={(v) => change(field.key, v === 'true')}
              options={[
                { value: 'true', label: t('yes') + ' · ' + t(field.key) },
                { value: 'false', label: t('no') + ' · ' + t(field.key) },
              ]}
              disabled={disabled}
            />
          ) : field.type === 'select' ? (
            <Choice
              key={field.key}
              label={t(field.key)}
              value={String(draft[field.key] ?? '')}
              onChange={(v) => change(field.key, v)}
              options={selections(field)}
              disabled={
                disabled ||
                (field.key === 'motherId' &&
                  target !== null &&
                  ['offering', 'inspection'].includes(kind))
              }
            />
          ) : (
            <Field
              key={field.key}
              label={t(field.key)}
              value={String(draft[field.key] ?? '')}
              onChangeText={(v) => change(field.key, v)}
              password={field.type === 'password'}
              numeric={field.type === 'number' || field.type === 'money'}
              disabled={disabled}
              limit={field.limit ?? (field.type === 'password' ? 72 : 2000)}
            />
          ),
        )}
      <Issue error={error} />
      {review ? (
        <ReviewCard
          review={review}
          onCancel={() => {
            setReview(null);
            if (kind.endsWith('Password')) setDraft((v) => ({ ...v, newPassword: '' }));
          }}
        >
          {source ? <RecordValues value={source} /> : null}
          {source?.payment ? <RecordValues value={source.payment as Row} /> : null}
          {source?.subscription ? <RecordValues value={source.subscription as Row} /> : null}
          <RecordValues
            value={Object.fromEntries(
              Object.entries(review.action.body ?? {}).filter(([key]) => key !== 'newPassword'),
            )}
          />
          {Object.entries(review.action.body ?? {})
            .filter(([key]) => key.endsWith('Id'))
            .map(([key, value]) => {
              const field = fields.find((x) => x.key === key);
              const selected = field
                ? selections(field).find((x) => x.value === String(value))
                : null;
              return selected ? (
                <DataText key={key}>
                  {t(key)}: {selected.label}
                </DataText>
              ) : null;
            })}
          {review.action.body?.dishPattern ? (
            <RecordValues
              value={Object.fromEntries(
                Object.entries(review.action.body.dishPattern as Row).map(([k, v]) => [
                  'weekday' + k,
                  (options.dishes ?? []).find((x) => x.id === v)?.[
                    locale === 'am' ? 'nameAm' : 'nameEn'
                  ] ?? v,
                ]),
              )}
            />
          ) : null}
        </ReviewCard>
      ) : (
        <Button
          label={t('review')}
          disabled={disabled || resources.some((r) => r.busy || !!r.error)}
          onPress={prepare}
        />
      )}
      <AppText variant="small">{t('storageInfo')}</AppText>
    </View>
  );
}
