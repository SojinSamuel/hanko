import * as preact from "preact";
import { useCallback, useContext, useEffect, useState } from "preact/compat";
import { Fragment } from "preact";

import {
  HankoError,
  TechnicalError,
  NotFoundError,
  EmailValidationRequiredError,
  WebAuthnRequestCancelledError,
  WebAuthnUnavailableError,
} from "../../lib/Errors";

import { TranslateContext } from "@denysvuika/preact-translate";
import { AppContext } from "../contexts/AppProvider";
import { RenderContext } from "../contexts/PageProvider";
import { UserContext } from "../contexts/UserProvider";

import Button from "../components/Button";
import InputText from "../components/InputText";
import Headline from "../components/Headline";
import Content from "../components/Content";
import Form from "../components/Form";
import Divider from "../components/Divider";
import ErrorMessage from "../components/ErrorMessage";

const LoginEmail = () => {
  const { t } = useContext(TranslateContext);
  const { email, setEmail } = useContext(UserContext);
  const { hanko, config } = useContext(AppContext);
  const {
    renderPassword,
    renderPasscode,
    emitSuccessEvent,
    renderRegisterConfirm,
  } = useContext(RenderContext);

  const [isPasskeyLoginLoading, setIsPasskeyLoginLoading] =
    useState<boolean>(false);
  const [isPasskeyLoginSuccess, setIsPasskeyLoginSuccess] =
    useState<boolean>(false);
  const [isEmailLoginLoading, setIsEmailLoginLoading] =
    useState<boolean>(false);
  const [isEmailLoginSuccess, setIsEmailLoginSuccess] =
    useState<boolean>(false);
  const [error, setError] = useState<HankoError>(null);
  const [isAuthenticatorSupported, setIsAuthenticatorSupported] =
    useState<boolean>(null);

  // isAndroidUserAgent is used to determine whether the "Login with Passkey" button should be visible, as there is
  // currently no resident key support on Android.
  const isAndroidUserAgent =
    window.navigator.userAgent.indexOf("Android") !== -1;

  const onEmailInput = (event: Event) => {
    if (event.target instanceof HTMLInputElement) {
      setEmail(event.target.value);
    }
  };

  const onEmailSubmit = (event: Event) => {
    event.preventDefault();
    setIsEmailLoginLoading(true);

    if (isAuthenticatorSupported) {
      hanko.user
        .getInfo(email)
        .then((info) => {
          return hanko.authenticator.login(info);
        })
        .then(() => {
          setIsEmailLoginLoading(false);
          setIsEmailLoginSuccess(true);
          emitSuccessEvent();

          return;
        })
        .catch((e) => {
          if (e instanceof NotFoundError) {
            renderRegisterConfirm();
          } else if (e instanceof EmailValidationRequiredError) {
            renderPasscode(e.userID, config.password.enabled, true);
          } else if (
            e instanceof WebAuthnUnavailableError ||
            e instanceof WebAuthnRequestCancelledError
          ) {
            if (e.userID) {
              renderAlternateLoginMethod(e.userID);
            } else {
              setIsEmailLoginLoading(false);
            }
          } else {
            setIsEmailLoginLoading(false);
            setError(e);
          }
        });
    } else {
      hanko.user
        .getInfo(email)
        .then((info) => {
          return renderAlternateLoginMethod(info.id);
        })
        .catch((e) => {
          if (e instanceof NotFoundError) {
            renderRegisterConfirm();
          } else if (e instanceof EmailValidationRequiredError) {
            renderPasscode(e.userID, config.password.enabled, true);
          } else {
            setIsEmailLoginLoading(false);
            setError(e);
          }
        });
    }
  };

  const onWebAuthnSubmit = (event: Event) => {
    event.preventDefault();
    setIsPasskeyLoginLoading(true);

    hanko.authenticator
      .login()
      .then(() => {
        setIsPasskeyLoginLoading(false);
        setIsPasskeyLoginSuccess(true);
        emitSuccessEvent();

        return;
      })
      .catch((e) => {
        setIsPasskeyLoginLoading(false);
        setError(e instanceof WebAuthnRequestCancelledError ? null : e);
      });
  };

  const renderAlternateLoginMethod = useCallback(
    (userID: string) => {
      if (config.password.enabled) {
        return renderPassword(userID).catch((e) => {
          setIsEmailLoginLoading(false);
          setError(e);
        });
      }
      return renderPasscode(userID, false, false).catch((e) => {
        setIsEmailLoginLoading(false);
        setError(e);
      });
    },
    [config.password.enabled, renderPasscode, renderPassword]
  );

  useEffect(() => {
    hanko.authenticator
      .isAuthenticatorSupported()
      .then((supported) => setIsAuthenticatorSupported(supported))
      .catch((e) => setError(new TechnicalError(e)));
  }, [hanko]);

  return (
    <Content>
      <Headline>{t("headlines.loginEmail")}</Headline>
      <ErrorMessage error={error} />
      <Form onSubmit={onEmailSubmit}>
        <InputText
          name={"email"}
          type={"email"}
          autocomplete={"username"}
          required={true}
          onInput={onEmailInput}
          value={email}
          label={t("labels.email")}
          pattern={"^.*[^0-9]+$"}
          autofocus
        />
        <Button isLoading={isEmailLoginLoading} isSuccess={isEmailLoginSuccess}>
          {t("labels.continue")}
        </Button>
      </Form>
      {isAuthenticatorSupported && !isAndroidUserAgent ? (
        <Fragment>
          <Divider />
          <Form onSubmit={onWebAuthnSubmit}>
            <Button
              secondary
              isLoading={isPasskeyLoginLoading}
              isSuccess={isPasskeyLoginSuccess}
            >
              {t("labels.signInPasskey")}
            </Button>
          </Form>
        </Fragment>
      ) : null}
    </Content>
  );
};

export default LoginEmail;
