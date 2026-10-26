import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText, Button, Card, Notice, Pill } from '@miaa/ui';
import {
  canPackage,
  ticketMessage,
  todayEAT,
  type QueueItem,
  type Status,
  type TicketMarker,
} from './contracts';
import { useMother } from './provider';
import { useMotherText } from './text';
import { Data, DateTime, Field, Issue, MotherPage, styles } from './components';
function useClock() {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return clock;
}
function useToday() {
  const { model } = useMother();
  useFocusEffect(
    useCallback(() => {
      void model.refreshDay();
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') void model.refreshDay();
      });
      return () => sub.remove();
    }, [model]),
  );
}
function Feedback() {
  const s = useMother();
  const { t } = useMotherText();
  const notice = s.notice === 'packaged' ? 'packagedSaved' : s.notice;
  return (
    <>
      <Issue error={s.issue} />
      {notice ? <Notice body="" title={t(notice)} tone="success" /> : null}
      {s.retryAt !== 0 ? (
        <AppText accessibilityLiveRegion="polite">{t('waitButton')}</AppText>
      ) : null}
    </>
  );
}
function RefreshDay() {
  const { day, model, busy } = useMother();
  const { t } = useMotherText();
  return (
    <>
      <Issue error={day.error} />
      <Button
        tone="secondary"
        label={day.busy ? t('loading') : t('refresh')}
        busy={day.busy}
        disabled={busy}
        onPress={() => void model.refreshDay()}
      />
    </>
  );
}
function DayHeading() {
  const clock = useClock();
  const { day } = useMother();
  const { t } = useMotherText();
  if (!day.data) return null;
  const d = day.data;
  return (
    <Card>
      <Data>{d.motherName}</Data>
      <AppText>
        {t('date')}: {d.date}
      </AppText>
      <AppText>
        {t('deadline')}: {d.deadline} · {t('eat')}
      </AppText>
      <AppText>
        {t('toPrepare')}: {d.toPrepare} · {t('done')}: {d.done}
      </AppText>
      <AppText>
        {t('openTickets')}: {d.openTickets}
      </AppText>
      {d.deadlinePassed || clock >= Date.parse(`${d.date}T${d.deadline}:00+03:00`) ? (
        <Notice body="" title={t('deadlinePassed')} tone="neutral" />
      ) : null}
      {d.date !== todayEAT(clock) ? (
        <Notice body="" title={t('unavailableDate')} tone="neutral" />
      ) : null}
    </Card>
  );
}
function Links() {
  const router = useRouter();
  const { t } = useMotherText();
  return (
    <View style={styles.group}>
      {(['queue', 'meal', 'tickets'] as const).map((path) => (
        <Button
          key={path}
          label={t(path)}
          tone={path === 'queue' ? 'primary' : 'secondary'}
          onPress={() => router.push(`/mother/${path}`)}
        />
      ))}
    </View>
  );
}
export function MotherHomeScreen() {
  useToday();
  const { t } = useMotherText();
  return (
    <MotherPage title={t('home')} home>
      <RefreshDay />
      <DayHeading />
      <Links />
    </MotherPage>
  );
}
export function MotherWorkspaceScreen() {
  const { t } = useMotherText();
  return (
    <MotherPage title={t('workspace')} home>
      <Links />
    </MotherPage>
  );
}
function Item({
  item,
  review,
  onReview,
  onConfirm,
  onCancel,
  enabled,
  busy,
}: {
  item: QueueItem;
  review: boolean;
  onReview: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  enabled: boolean;
  busy: boolean;
}) {
  const { t, locale } = useMotherText();
  return (
    <Card>
      <Pill tone={item.status === 'preparing' ? 'neutral' : 'positive'}>{t(item.status)}</Pill>
      <AppText weight="semibold">
        {t('sticker')}: {item.stickerId}
      </AppText>
      <Data>{(locale === 'am' ? item.dishNameAm : item.dishNameEn) || '—'}</Data>
      <Data>
        {t('client')}: {item.clientName}
      </Data>
      {item.dishIsFasting !== null ? (
        <AppText>{t(item.dishIsFasting ? 'fasting' : 'nonFasting')}</AppText>
      ) : null}
      {item.nonSpicyRequested ? <Pill tone="neutral">{t('nonSpicy')}</Pill> : null}
      {item.isCompRedelivery ? <Pill>{t('replacement')}</Pill> : null}
      {item.addressNote ? (
        <Data>
          {t('directions')}: {item.addressNote}
        </Data>
      ) : null}
      {item.notes ? (
        <Data>
          {t('notes')}: {item.notes}
        </Data>
      ) : null}
      {review ? (
        <>
          <AppText>{t('confirmBody')}</AppText>
          <Button label={t('confirmPackage')} disabled={!enabled} busy={busy} onPress={onConfirm} />
          <Button label={t('cancel')} tone="secondary" disabled={busy} onPress={onCancel} />
        </>
      ) : item.status === 'preparing' ? (
        <Button
          label={`${t('reviewPackage')} · ${item.stickerId}`}
          disabled={!enabled || busy}
          onPress={onReview}
        />
      ) : null}
    </Card>
  );
}
export function MotherQueueScreen() {
  useToday();
  const s = useMother();
  const { t, locale } = useMotherText();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [selected, setSelected] = useState<number | null>(null);
  const clock = useClock();
  const day = s.day.data;
  const query = search.trim().toLocaleLowerCase();
  const items =
    day?.items.filter(
      (x) =>
        (status === 'all' || x.status === status) &&
        `${x.stickerId} ${x.clientName}`.toLocaleLowerCase().includes(query),
    ) ?? [];
  return (
    <MotherPage title={t('queue')}>
      <RefreshDay />
      <Feedback />
      <DayHeading />
      <AppText variant="small">{t('packagingUnknown')}</AppText>
      {day ? (
        <>
          <AppText variant="title" accessibilityRole="header">
            {t('totals')}
          </AppText>
          {day.tallies.map((x, i) => (
            <Card key={i}>
              <Data>{locale === 'am' ? x.dishNameAm : x.dishNameEn}</Data>
              <AppText>
                {t('total')}: {x.total} · {t('nonSpicy')}: {x.nonSpicy} · {t('remaining')}:{' '}
                {x.remaining}
              </AppText>
            </Card>
          ))}
          <Field label={t('search')} value={search} onChangeText={setSearch} />
          <View style={styles.row}>
            {(['all', 'preparing', 'packaged', 'out_for_delivery', 'delivered'] as const).map(
              (k) => (
                <Button
                  key={k}
                  tone="secondary"
                  label={t(k)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: status === k }}
                  onPress={() => {
                    setStatus(k);
                    setSelected(null);
                  }}
                />
              ),
            )}
          </View>
          {!day.items.length ? (
            <AppText>{t('empty')}</AppText>
          ) : !items.length ? (
            <AppText>{t('noMatch')}</AppText>
          ) : (
            items.map((item) => (
              <Item
                key={item.id}
                item={item}
                enabled={!s.day.busy && canPackage(day, item.id, clock) && s.retryAt === 0}
                busy={s.busy}
                review={selected === item.id}
                onReview={() => setSelected(item.id)}
                onCancel={() => setSelected(null)}
                onConfirm={() => {
                  setSelected(null);
                  void s.model.package(item.id);
                }}
              />
            ))
          )}
        </>
      ) : null}
    </MotherPage>
  );
}
export function MotherMealScreen() {
  const clock = useClock();
  useToday();
  const s = useMother();
  const { t, locale } = useMotherText();
  const [dish, setDish] = useState<number | null>(null);
  const [review, setReview] = useState(false);
  useFocusEffect(
    useCallback(() => {
      void s.model.refreshDishes();
    }, [s.model]),
  );
  const day = s.day.data;
  const options = s.dishes.data;
  const enabled =
    !!day &&
    day.date === todayEAT(clock) &&
    !day.compMealTaken &&
    !!options &&
    !s.day.busy &&
    !s.dishes.busy &&
    !s.busy &&
    s.retryAt === 0 &&
    (dish === null || options.some((x) => x.id === dish));
  return (
    <MotherPage title={t('meal')}>
      <AppText>{t('mealInfo')}</AppText>
      <RefreshDay />
      <Button
        tone="secondary"
        label={t('chooseMeal')}
        busy={s.dishes.busy}
        disabled={s.busy}
        onPress={() => void s.model.refreshDishes()}
      />
      <Issue error={s.dishes.error} />
      <Feedback />
      <DayHeading />
      {day?.compMealTaken ? (
        <Notice body="" title={t('mealTaken')} tone="success" />
      ) : options ? (
        <>
          <AppText>{t('chooseMeal')}</AppText>
          {options.length === 0 ? <AppText>{t('noDishes')}</AppText> : null}
          {[null, ...options].map((x) => (
            <Button
              key={x?.id ?? 'none'}
              label={x ? (locale === 'am' ? x.nameAm : x.nameEn) : t('noDish')}
              tone="secondary"
              accessibilityRole="radio"
              accessibilityState={{ checked: dish === (x?.id ?? null) }}
              disabled={s.busy}
              onPress={() => {
                setDish(x?.id ?? null);
                setReview(false);
              }}
            />
          ))}
          {review ? (
            <Card>
              <AppText>{t('mealReview')}</AppText>
              <Data>
                {options.find((x) => x.id === dish)?.[locale === 'am' ? 'nameAm' : 'nameEn'] ??
                  t('noDish')}
              </Data>
              <Button
                label={t('mealConfirm')}
                disabled={!enabled}
                busy={s.busy}
                onPress={() => {
                  setReview(false);
                  void s.model.meal(dish);
                }}
              />
              <Button label={t('cancel')} tone="secondary" onPress={() => setReview(false)} />
            </Card>
          ) : (
            <Button label={t('reviewMeal')} disabled={!enabled} onPress={() => setReview(true)} />
          )}
        </>
      ) : null}
    </MotherPage>
  );
}
export function MotherTicketsScreen() {
  const s = useMother();
  const { t } = useMotherText();
  const [message, setMessage] = useState('');
  const [review, setReview] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [clear, setClear] = useState<TicketMarker | null>(null);
  useFocusEffect(
    useCallback(() => {
      void s.model.refreshTickets();
    }, [s.model]),
  );
  const enabled = s.storageReady && !s.pending && !s.busy && s.retryAt === 0;
  return (
    <MotherPage title={t('tickets')}>
      <Feedback />
      <Issue error={error} />
      <AppText variant="small">{t('storageInfo')}</AppText>
      <AppText variant="small">{t('recoverPrivacy')}</AppText>
      {!s.storageReady ? (
        <Button label={t('storageRetry')} busy={s.busy} onPress={() => void s.model.recover()} />
      ) : null}
      {s.pending ? (
        <Card>
          <Notice title={t('pendingTitle')} body={t('pendingBody')} tone="neutral" />
          <AppText>{t('pendingSince')}</AppText>
          <DateTime value={s.pending.sentAt} />
          {clear ? (
            <>
              <AppText>{t('clearWarning')}</AppText>
              <Button
                label={t('clearConfirm')}
                disabled={s.busy}
                onPress={() => {
                  setClear(null);
                  setReview(null);
                  void s.model.clearReviewedPending(clear);
                }}
              />
              <Button label={t('cancel')} tone="secondary" onPress={() => setClear(null)} />
            </>
          ) : (
            <Button
              label={t('clearReview')}
              tone="secondary"
              disabled={s.busy || s.tickets.busy || !s.tickets.data}
              onPress={() => setClear(s.pending)}
            />
          )}
        </Card>
      ) : null}
      <AppText>{t('requestHelp')}</AppText>
      <Field
        label={t('requestMessage')}
        value={message}
        maxLength={2000}
        multiline
        editable={!s.busy}
        onChangeText={(text) => {
          setMessage(text);
          setReview(null);
          setError(null);
        }}
      />
      {review !== null ? (
        <Card>
          <AppText>{t('requestReview')}</AppText>
          <Data>{review}</Data>
          <Button
            label={t('sendRequest')}
            disabled={!enabled}
            busy={s.busy}
            onPress={() => {
              const body = review;
              setReview(null);
              void s.model.submitTicket(body).then(() => {
                if (s.model.getSnapshot().notice === 'ticketSent') setMessage('');
              });
            }}
          />
          <Button label={t('cancel')} tone="secondary" onPress={() => setReview(null)} />
        </Card>
      ) : (
        <Button
          label={t('reviewRequest')}
          disabled={!enabled}
          onPress={() => {
            try {
              setReview(ticketMessage(message));
              setError(null);
            } catch (e) {
              setError(e);
            }
          }}
        />
      )}
      <AppText variant="title" accessibilityRole="header">
        {t('history')}
      </AppText>
      <AppText variant="small">{t('historyLimit')}</AppText>
      <Issue error={s.tickets.error} />
      <Button
        label={t('checkHistory')}
        tone="secondary"
        busy={s.tickets.busy}
        disabled={s.busy}
        onPress={() => void s.model.refreshTickets()}
      />
      {s.tickets.data?.length === 0 ? (
        <AppText>{t('noTickets')}</AppText>
      ) : (
        s.tickets.data?.map((x) => (
          <Card key={x.id}>
            <AppText>#{x.id}</AppText>
            <Pill tone={x.status === 'resolved' ? 'positive' : 'neutral'}>{t(x.status)}</Pill>
            <Data>{x.message}</Data>
            <AppText variant="small">{t('created')}</AppText>
            <DateTime value={x.createdAt} />
            {x.resolvedAt ? (
              <>
                <AppText variant="small">{t('resolvedAt')}</AppText>
                <DateTime value={x.resolvedAt} />
              </>
            ) : null}
          </Card>
        ))
      )}
    </MotherPage>
  );
}
