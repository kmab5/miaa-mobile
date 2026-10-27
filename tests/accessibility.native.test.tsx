import { render, screen, fireEvent } from '@testing-library/react-native';
import { LocaleProvider } from '@miaa/i18n';
import { AppText, Button, Notice } from '@miaa/ui';
function locale(children: React.ReactNode, language: 'en' | 'am' = 'en') {
  return (
    <LocaleProvider
      defaultLocale={language}
      storage={{ getItem: async () => null, setItem: async () => undefined }}
    >
      {children}
    </LocaleProvider>
  );
}
test.each(['en', 'am'] as const)(
  'critical notices are one labelled screen-reader alert in %s',
  async (language) => {
    const title = language === 'am' ? 'ችግር' : 'Action unavailable',
      body = language === 'am' ? 'ግንኙነትዎን ያረጋግጡ' : 'Check your connection and the saved result.';
    await render(locale(<Notice title={title} body={body} tone="error" />, language));
    expect(screen.getByRole('alert', { name: `${title}. ${body}` })).toBeOnTheScreen();
  },
);
test('busy and disabled actions retain a name and state without accepting a press', async () => {
  const onPress = jest.fn();
  await render(locale(<Button label="Confirm changes" busy onPress={onPress} />));
  const action = screen.getByRole('button', { name: 'Confirm changes' });
  expect(action).toBeDisabled();
  expect(action.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  await fireEvent.press(action);
  expect(onPress).not.toHaveBeenCalled();
});
test('Amharic headings retain script language and scalable text semantics', async () => {
  await render(
    locale(
      <AppText variant="title" accessibilityRole="header">
        የገንዘብ መዝገብ
      </AppText>,
      'am',
    ),
  );
  const heading = screen.getByRole('header', { name: 'የገንዘብ መዝገብ' });
  expect(heading.props.accessibilityLanguage).toBe('am-ET');
  expect(heading.props.allowFontScaling).not.toBe(false);
});
