import type { Probe } from './types';
import { withTimeout, yesNo } from './utils';

type Credential = typeof PublicKeyCredential & {
  getClientCapabilities?: () => Promise<Record<string, boolean>>;
};

type ApplePay = { canMakePayments: () => boolean };

type PaymentRequestStatic = {
  securePaymentConfirmationAvailability?: () => Promise<string>;
};

const CONFIRMATION: Record<string, string> = {
  available: 'Ready',
  'unavailable-feature-not-enabled': 'Turned off',
  'unavailable-no-user-verifying-platform-authenticator':
    'No fingerprint or face unlock',
  'unavailable-no-permission-policy': 'Not allowed here',
  'unavailable-unknown-reason': 'Not available',
};

const ask = async <T>(question: (() => Promise<T>) | undefined) => {
  if (!question) return null;
  try {
    return await withTimeout(question(), 1500);
  } catch {
    return null;
  }
};

const unlockName = () => {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'Face ID or Touch ID';
  if (/Mac OS X/.test(ua)) return 'Touch ID';
  if (/Windows/.test(ua)) return 'Windows Hello';
  if (/Android/.test(ua)) return 'Fingerprint or face unlock';
  return 'Built-in unlock';
};

const passkeys: Probe = {
  id: 'passkeys',
  title: 'Passkeys and payments',
  category: 'Device',
  access: 'none',
  weight: 4,
  compat: [
    'api.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable_static',
    'api.PublicKeyCredential.isConditionalMediationAvailable_static',
    'api.PublicKeyCredential.getClientCapabilities_static',
    'api.PaymentRequest.securePaymentConfirmationAvailability_static',
  ],
  how: 'PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(), isConditionalMediationAvailable() and getClientCapabilities(), PaymentRequest.securePaymentConfirmationAvailability(), and ApplePaySession.canMakePayments() in Safari',
  why: 'Without a prompt, a page learns whether your device has Touch ID, Face ID or Windows Hello set up and whether your browser can use a phone as a key. That separates new hardware from old and sorts people by how they sign in.',
  async collect() {
    const Credential = (window as Window & { PublicKeyCredential?: Credential })
      .PublicKeyCredential;
    const applePay = (window as Window & { ApplePaySession?: ApplePay })
      .ApplePaySession;
    const Payment = (
      window as Window & { PaymentRequest?: PaymentRequestStatic }
    ).PaymentRequest;
    const [unlock, autofill, capabilities, confirmation] = await Promise.all([
      ask(
        Credential &&
          (() => Credential.isUserVerifyingPlatformAuthenticatorAvailable())
      ),
      ask(
        Credential?.isConditionalMediationAvailable &&
          (() => Credential.isConditionalMediationAvailable())
      ),
      ask(
        Credential?.getClientCapabilities &&
          (() => Credential.getClientCapabilities!())
      ),
      ask(
        Payment?.securePaymentConfirmationAvailability &&
          (() => Payment.securePaymentConfirmationAvailability!())
      ),
    ]);
    let pay: string | null = null;
    try {
      pay = applePay
        ? applePay.canMakePayments()
          ? 'Ready'
          : 'Not set up'
        : null;
    } catch {
      pay = null;
    }
    const name = unlockName();
    return {
      lead: unlock === null ? null : unlock ? `${name} ready` : `No ${name}`,
      facts: [
        [name, unlock === null ? null : unlock ? 'Set up' : 'No'],
        ['Passkey autofill', yesNo(autofill)],
        ['Phone as a key', yesNo(capabilities?.hybridTransport)],
        [
          'Passkeys on this device',
          yesNo(capabilities?.passkeyPlatformAuthenticator),
        ],
        ['Apple Pay', pay],
        [
          'Card payments by fingerprint',
          confirmation ? (CONFIRMATION[confirmation] ?? confirmation) : null,
        ],
      ],
    };
  },
};

export default passkeys;
