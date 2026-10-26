import { useCallback, useState } from 'react';
import { AppState, Linking, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText, Button, Card, Notice, Pill } from '@miaa/ui';
import { mapURL, phoneURL, type RunItem } from './contracts';
import { type Review } from './controller';
import { useCyclist, useCyclistDate } from './provider';
import { useCyclistText } from './text';
import { CyclistPage, Data, Field, Issue, styles } from './components';
function useRun() {
  const { model } = useCyclist();
  useFocusEffect(
    useCallback(() => {
      void model.refreshRun();
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') void model.refreshRun();
      });
      return () => sub.remove();
    }, [model]),
  );
}
function Feedback() {
  const s = useCyclist();
  const { t } = useCyclistText();
  return (
    <>
      <Issue error={s.issue} />
      {s.notice ? <Notice title={t(s.notice)} body="" tone="success" /> : null}
      {s.retryAt !== 0 ? (
        <AppText accessibilityLiveRegion="polite">{t('waitAction')}</AppText>
      ) : null}
    </>
  );
}
function RefreshRun() {
  const s = useCyclist();
  const { t } = useCyclistText();
  return (
    <>
      <Issue error={s.run.error} />
      <Button
        label={s.run.busy ? t('loading') : t('refresh')}
        busy={s.run.busy}
        disabled={s.busy}
        tone="secondary"
        onPress={() => void s.model.refreshRun()}
      />
    </>
  );
}
function ExternalButton({ url, label }: { url: string; label: string }) {
  const [error, setError] = useState(false);
  const { t } = useCyclistText();
  return (
    <>
      <Button
        label={label}
        tone="secondary"
        onPress={() => {
          setError(false);
          void Linking.openURL(url).catch(() => setError(true));
        }}
      />
      {error ? <AppText accessibilityLiveRegion="polite">{t('openFailed')}</AppText> : null}
    </>
  );
}
function Heading() {
  const s = useCyclist();
  const today = useCyclistDate();
  const { t } = useCyclistText();
  const d = s.run.data;
  if (!d) return null;
  const phone = phoneURL(d.motherPhone);
  return (
    <Card>
      <Data>{d.cyclistName}</Data>
      <AppText>
        {t('date')}: {d.date} · {t('eat')}
      </AppText>
      <AppText>
        {t('total')}: {d.total} · {t('delivered')}: {d.delivered.length}
      </AppText>
      <AppText>
        {t('stillCooking')}: {d.stillCooking}
      </AppText>
      {d.motherName ? (
        <>
          <AppText>{t('kitchen')}</AppText>
          <Data>{d.motherName}</Data>
          {d.motherAddress ? <Data>{d.motherAddress}</Data> : null}
          {phone && d.date === today ? (
            <ExternalButton url={phone} label={t('callKitchen')} />
          ) : null}
        </>
      ) : (
        <Notice title={t('noKitchen')} body="" />
      )}
      <AppText>
        {t('prepTarget')}: {d.deadline} · {t('eat')}
      </AppText>
      <AppText variant="small">{t('targetInfo')}</AppText>
      {d.date !== today ? <Notice title={t('todayOnly')} body="" /> : null}
    </Card>
  );
}
function Links() {
  const { t } = useCyclistText();
  const router = useRouter();
  return (
    <View style={styles.group}>
      {(['run', 'lookup', 'earnings', 'meal'] as const).map((path) => (
        <Button
          key={path}
          tone={path === 'run' ? 'primary' : 'secondary'}
          label={t(path)}
          onPress={() => router.push(`/cyclist/${path}`)}
        />
      ))}
    </View>
  );
}
export function CyclistHomeScreen() {
  useRun();
  const { t } = useCyclistText();
  return (
    <CyclistPage title={t('home')} home>
      <RefreshRun />
      <Heading />
      <Links />
    </CyclistPage>
  );
}
export function CyclistWorkspaceScreen() {
  const { t } = useCyclistText();
  return (
    <CyclistPage title={t('workspace')} home>
      <Links />
    </CyclistPage>
  );
}
function ItemCard({
  item,
  date,
  onReview,
}: {
  item: RunItem;
  date: string;
  onReview?: (v: Review) => void;
}) {
  const s = useCyclist();
  const { t, locale } = useCyclistText();
  const today = useCyclistDate();
  const [error, setError] = useState<unknown>(null);
  const current = date === today;
  const actionable = current && !s.busy && s.retryAt === 0;
  const call = phoneURL(item.clientPhone);
  const action =
    item.status === 'packaged' ? 'collect' : item.status === 'out_for_delivery' ? 'confirm' : null;
  return (
    <Card>
      <Pill tone={item.status === 'delivered' ? 'positive' : 'neutral'}>{t(item.status)}</Pill>
      <AppText weight="semibold">
        {t('sticker')}: {item.stickerId}
      </AppText>
      <Data>
        {t('client')}: {item.clientName}
      </Data>
      <Data>{(locale === 'am' ? item.dishNameAm : item.dishNameEn) || '—'}</Data>
      {item.isCompRedelivery ? <Pill>{t('replacement')}</Pill> : null}
      {item.status !== 'delivered' ? (
        <>
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
        </>
      ) : null}
      {item.status === 'out_for_delivery' && current ? (
        <>
          {call ? <ExternalButton label={t('callClient')} url={call} /> : null}
          <AppText variant="small">{t('mapInfo')}</AppText>
          <ExternalButton label={t('openMap')} url={mapURL(item.latitude, item.longitude)} />
        </>
      ) : null}
      {action && onReview ? (
        <Button
          label={`${t(action === 'collect' ? 'reviewCollect' : 'reviewConfirm')} · ${item.stickerId}`}
          disabled={!actionable}
          onPress={() => {
            try {
              onReview(s.model.review(item, action, date));
              setError(null);
            } catch (e) {
              setError(e);
            }
          }}
        />
      ) : null}
      <Issue error={error} />
    </Card>
  );
}
function ReviewCard({ review, onDone }: { review: Review; onDone: () => void }) {
  const s = useCyclist();
  const { t } = useCyclistText();
  const today = useCyclistDate();
  return (
    <Card>
      <AppText weight="semibold">{review.item.stickerId}</AppText>
      <Data>{review.item.clientName}</Data>
      <AppText>{t(review.action === 'collect' ? 'collectHelp' : 'confirmHelp')}</AppText>
      <Button
        label={t(review.action === 'collect' ? 'confirmCollect' : 'confirmDelivery')}
        disabled={review.date !== today || s.retryAt !== 0}
        busy={s.busy}
        onPress={() => {
          onDone();
          void s.model.commit(review);
        }}
      />
      <Button label={t('cancel')} tone="secondary" disabled={s.busy} onPress={onDone} />
    </Card>
  );
}
export function CyclistRunScreen() {
  useRun();
  const s = useCyclist();
  const { t } = useCyclistText();
  const [search, setSearch] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  const d = s.run.data;
  const query = search.trim().toLocaleLowerCase();
  return (
    <CyclistPage title={t('run')}>
      <RefreshRun />
      <Feedback />
      <Heading />
      <AppText variant="small">{t('writeHelp')}</AppText>
      {review ? <ReviewCard review={review} onDone={() => setReview(null)} /> : null}
      {d ? (
        <>
          {d.total === 0 ? <AppText>{t('empty')}</AppText> : null}
          <Field label={t('search')} value={search} onChangeText={setSearch} />
          {(['readyToCollect', 'onTheWay', 'delivered'] as const).map((key, index) => {
            const rows = d[key].filter((x) =>
              `${x.stickerId} ${x.clientName}`.toLocaleLowerCase().includes(query),
            );
            return (
              <View key={key} style={styles.group}>
                <AppText variant="title" accessibilityRole="header">
                  {t((['ready', 'onTheWay', 'delivered'] as const)[index]!)} ({d[key].length})
                </AppText>
                {rows.length ? (
                  rows.map((item) => (
                    <ItemCard key={item.id} item={item} date={d.date} onReview={setReview} />
                  ))
                ) : (
                  <AppText>{t(query ? 'noMatch' : 'emptySection')}</AppText>
                )}
              </View>
            );
          })}
        </>
      ) : null}
    </CyclistPage>
  );
}
export function CyclistLookupScreen() {
  const s = useCyclist();
  const { t } = useCyclistText();
  const [value, setValue] = useState('');
  const [review, setReview] = useState<Review | null>(null);
  useFocusEffect(useCallback(() => () => s.model.clearLookup(), [s.model]));
  return (
    <CyclistPage title={t('lookup')}>
      <AppText>{t('lookupHint')}</AppText>
      <Feedback />
      <Field
        label={t('stickerInput')}
        value={value}
        onChangeText={(v) => {
          setValue(v);
          setReview(null);
          s.model.clearLookup();
        }}
      />
      <Button
        label={t('find')}
        busy={s.lookup.busy}
        disabled={s.busy || s.retryAt !== 0}
        onPress={() => {
          setReview(null);
          void s.model.lookup(value);
        }}
      />
      <Button
        label={t('clear')}
        tone="secondary"
        disabled={s.busy}
        onPress={() => {
          setValue('');
          setReview(null);
          s.model.clearLookup();
        }}
      />
      <Issue error={s.lookup.error} />
      {review ? <ReviewCard review={review} onDone={() => setReview(null)} /> : null}
      {s.lookup.data && s.lookup.date ? (
        <ItemCard item={s.lookup.data} date={s.lookup.date} onReview={setReview} />
      ) : null}
      <AppText variant="small">{t('writeHelp')}</AppText>
    </CyclistPage>
  );
}
export function CyclistEarningsScreen() {
  const s = useCyclist();
  const { t } = useCyclistText();
  const today = useCyclistDate();
  useFocusEffect(
    useCallback(() => {
      void s.model.refreshEarnings();
      const sub = AppState.addEventListener('change', (v) => {
        if (v === 'active') void s.model.refreshEarnings();
      });
      return () => sub.remove();
    }, [s.model]),
  );
  const e = s.earnings.data;
  return (
    <CyclistPage title={t('earnings')}>
      <Issue error={s.earnings.error} />
      <Button
        label={t('refresh')}
        tone="secondary"
        busy={s.earnings.busy}
        onPress={() => void s.model.refreshEarnings()}
      />
      {e ? (
        <Card>
          <AppText>
            {t('date')}: {s.earnings.date} · {t('eat')}
          </AppText>
          <AppText>
            {t('today')}: {e.deliveriesToday}
          </AppText>
          <AppText>
            {t('lastSeven')}: {e.deliveriesThisWeek}
          </AppText>
          <AppText>
            {t('rate')}: {e.ratePerDelivery}
          </AppText>
          {s.earnings.date !== today ? <Notice title={t('todayOnly')} body="" /> : null}
        </Card>
      ) : null}
      <AppText>{t('payoutInfo')}</AppText>
    </CyclistPage>
  );
}
export function CyclistMealScreen() {
  useRun();
  const s = useCyclist();
  const { t, locale } = useCyclistText();
  const today = useCyclistDate();
  const [dish, setDish] = useState<number | null>(null);
  const [review, setReview] = useState<{ date: string; dish: number | null } | null>(null);
  useFocusEffect(
    useCallback(() => {
      void s.model.refreshDishes();
    }, [s.model]),
  );
  const run = s.run.data,
    options = s.dishes.data;
  const enabled =
    !!run &&
    run.date === today &&
    s.dishes.date === run.date &&
    !!options &&
    !run.compMealTaken &&
    !s.run.busy &&
    !s.dishes.busy &&
    !s.busy &&
    s.retryAt === 0 &&
    (dish === null || options.some((x) => x.id === dish));
  return (
    <CyclistPage title={t('meal')}>
      <AppText>{t('mealInfo')}</AppText>
      <RefreshRun />
      <Issue error={s.dishes.error} />
      <Button
        label={t('chooseMeal')}
        tone="secondary"
        busy={s.dishes.busy}
        disabled={s.busy}
        onPress={() => void s.model.refreshDishes()}
      />
      <Feedback />
      {run?.compMealTaken ? (
        <Notice title={t('mealTaken')} body="" tone="success" />
      ) : options ? (
        <>
          {!options.length ? <AppText>{t('noDishes')}</AppText> : null}
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
                setReview(null);
              }}
            />
          ))}
          {review ? (
            <Card>
              <AppText>{t('mealReview')}</AppText>
              <Data>
                {options.find((x) => x.id === review.dish)?.[
                  locale === 'am' ? 'nameAm' : 'nameEn'
                ] ?? t('noDish')}
              </Data>
              <AppText>
                {t('date')}: {review.date}
              </AppText>
              <Button
                label={t('mealConfirm')}
                disabled={!enabled || review.date !== today}
                busy={s.busy}
                onPress={() => {
                  setReview(null);
                  void s.model.meal(review.dish, review.date);
                }}
              />
              <Button label={t('cancel')} tone="secondary" onPress={() => setReview(null)} />
            </Card>
          ) : (
            <Button
              label={t('reviewMeal')}
              disabled={!enabled}
              onPress={() => {
                if (run) setReview({ date: run.date, dish });
              }}
            />
          )}
        </>
      ) : null}
    </CyclistPage>
  );
}
