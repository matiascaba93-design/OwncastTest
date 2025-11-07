import { useRecoilState, useRecoilValue } from 'recoil';
import { Skeleton, Button, Spin } from 'antd';
import MessageFilled from '@ant-design/icons/MessageFilled';
import { FC, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import classnames from 'classnames';
import ActionButtons from './ActionButtons';
import { LOCAL_STORAGE_KEYS, getLocalStorage, setLocalStorage } from '../../../utils/localStorage';
import { canPushNotificationsBeSupported } from '../../../utils/browserPushNotifications';

import {
  clientConfigStateAtom,
  currentUserAtom,
  ChatState,
  chatStateAtom,
  appStateAtom,
  isOnlineSelector,
  isMobileAtom,
  serverStatusState,
  isChatAvailableSelector,
  visibleChatMessagesSelector,
} from '../../stores/ClientConfigStore';
import { ClientConfig } from '../../../interfaces/client-config.model';

import styles from './Content.module.scss';
import desktopStyles from './DesktopContent.module.scss';
import { OfflineBanner } from '../OfflineBanner/OfflineBanner';
import { AppStateOptions } from '../../stores/application-state';
import { ServerStatus } from '../../../interfaces/server-status.model';
import { Statusbar } from '../Statusbar/Statusbar';
import { ChatMessage } from '../../../interfaces/chat-message.model';
import { ExternalAction } from '../../../interfaces/external-action';
import { Modal } from '../Modal/Modal';
import { DesktopContent } from './DesktopContent';
import { MobileContent } from './MobileContent';
import { ChatModal } from '../../modals/ChatModal/ChatModal';
import { Footer } from '../Footer/Footer';

// Lazy loaded components
const ChatContainer = dynamic(
  () => import('../../chat/ChatContainer/ChatContainer').then(mod => mod.ChatContainer),
  {
    ssr: false,
  },
);

const FollowModal = dynamic(
  () => import('../../modals/FollowModal/FollowModal').then(mod => mod.FollowModal),
  {
    ssr: false,
    loading: () => <Skeleton loading active paragraph={{ rows: 8 }} />,
  },
);

const BrowserNotifyModal = dynamic(
  () =>
    import('../../modals/BrowserNotifyModal/BrowserNotifyModal').then(
      mod => mod.BrowserNotifyModal,
    ),
  {
    ssr: false,
    loading: () => <Skeleton loading active paragraph={{ rows: 6 }} />,
  },
);

const OwncastPlayer = dynamic(
  () => import('../../video/OwncastPlayer/OwncastPlayer').then(mod => mod.OwncastPlayer),
  {
    ssr: false,
    loading: () => <Skeleton loading active paragraph={{ rows: 12 }} />,
  },
);

const ExternalModal = ({ externalActionToDisplay, setExternalActionToDisplay }) => {
  const { title, description, url, html } = externalActionToDisplay;
  return (
    <Modal
      title={description || title}
      url={url}
      open={!!externalActionToDisplay}
      height="80vh"
      handleCancel={() => setExternalActionToDisplay(null)}
    >
      {html ? (
        <div
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
          style={{
            height: '100%',
            width: '100%',
            overflow: 'auto',
          }}
        />
      ) : null}
    </Modal>
  );
};

export const Content: FC = () => {
  const appState = useRecoilValue<AppStateOptions>(appStateAtom);
  const clientConfig = useRecoilValue<ClientConfig>(clientConfigStateAtom);
  const chatState = useRecoilValue<ChatState>(chatStateAtom);
  const currentUser = useRecoilValue(currentUserAtom);
  const serverStatus = useRecoilValue<ServerStatus>(serverStatusState);
  const [isMobile, setIsMobile] = useRecoilState<boolean | undefined>(isMobileAtom);
  const messages = useRecoilValue<ChatMessage[]>(visibleChatMessagesSelector);
  const online = useRecoilValue<boolean>(isOnlineSelector);
  const isChatAvailable = useRecoilValue<boolean>(isChatAvailableSelector);

  const { viewerCount, lastConnectTime, lastDisconnectTime, streamTitle } =
    useRecoilValue<ServerStatus>(serverStatusState);
  const {
    extraPageContent,
    name,
    summary,
    socialHandles,
    tags,
    externalActions,
    offlineMessage,
    chatDisabled,
    mobileChatEnabled,
    mobileExtraPageContentEnabled,
    federation,
    notifications,
  } = clientConfig;
  const isMobileDevice = isMobile === true;
  const mobileChatAllowed = mobileChatEnabled !== false;
  const extraContentAllowedOnMobile = mobileExtraPageContentEnabled !== false;
  const chatDisabledForDevice = chatDisabled || (isMobileDevice && !mobileChatAllowed);
  const extraPageContentForMobile = extraContentAllowedOnMobile ? extraPageContent : '';
  const [showNotifyReminder, setShowNotifyReminder] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const { account: fediverseAccount, enabled: fediverseEnabled } = federation;
  const { browser: browserNotifications } = notifications;
  const { enabled: browserNotificationsEnabled } = browserNotifications;
  const { online: isStreamLive } = serverStatus;
  const [externalActionToDisplay, setExternalActionToDisplay] = useState<ExternalAction>(null);
  const [currentBrowserWindowUrl, setCurrentBrowserWindowUrl] = useState('');

  const [supportsBrowserNotifications, setSupportsBrowserNotifications] = useState(false);
  const supportFediverseFeatures = fediverseEnabled;

  const [showChatModal, setShowChatModal] = useState(false);

  const externalActionSelected = (action: ExternalAction) => {
    const { openExternally, url } = action;

    if (url) {
      const updatedUrl = new URL(url);
      updatedUrl.searchParams.append('instance', currentBrowserWindowUrl);

      if (currentUser) {
        const { displayName } = currentUser;

        // Append url and username to params so the link knows where we came from and who we are.
        updatedUrl.searchParams.append('username', displayName);
      }
      const fullUrl = updatedUrl.toString();
      // Overwrite URL with the updated one that includes the params.
      const updatedAction = {
        ...action,
        url: fullUrl,
      };

      // apply openExternally only if we don't have an HTML embed
      if (openExternally) {
        window.open(fullUrl, '_blank');
      } else {
        setExternalActionToDisplay(updatedAction);
      }
    } else {
      setExternalActionToDisplay(action);
    }
  };

  const incrementVisitCounter = () => {
    let visits = parseInt(getLocalStorage(LOCAL_STORAGE_KEYS.userVisitCount), 10);
    if (Number.isNaN(visits)) {
      visits = 0;
    }

    setLocalStorage(LOCAL_STORAGE_KEYS.userVisitCount, visits + 1);

    if (visits > 2 && !getLocalStorage(LOCAL_STORAGE_KEYS.hasDisplayedNotificationModal)) {
      setShowNotifyReminder(true);
    }
  };

  const disableNotifyReminderPopup = () => {
    setShowNotifyModal(false);
    setShowNotifyReminder(false);
    setLocalStorage(LOCAL_STORAGE_KEYS.hasDisplayedNotificationModal, true);
  };

  const checkIfMobile = () => {
    const w = window.innerWidth;
    if (isMobile === undefined) {
      if (w <= 768) setIsMobile(true);
      else setIsMobile(false);
    }
    if (!isMobile && w <= 768) setIsMobile(true);
    if (isMobile && w > 768) setIsMobile(false);
  };

  useEffect(() => {
    incrementVisitCounter();
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  useEffect(() => {
    // isPushNotificationSupported relies on `navigator` so that needs to be
    // fired from this useEffect.
    setSupportsBrowserNotifications(
      canPushNotificationsBeSupported() && browserNotificationsEnabled,
    );
  }, [browserNotificationsEnabled]);

  useEffect(() => {
    setCurrentBrowserWindowUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (isMobileDevice && !mobileChatAllowed && showChatModal) {
      setShowChatModal(false);
    }
  }, [isMobileDevice, mobileChatAllowed, showChatModal]);

  const showChat = isChatAvailable && !chatDisabledForDevice && chatState === ChatState.VISIBLE;

  return (
    <div className={styles.main}>
      <div className={styles.mainColumn}>
        <section className={styles.videoSection}>
          {appState.appLoading ? (
            <div className={classnames(styles.centerSpinner, styles.videoSkeleton)}>
              <Spin delay={2} size="large" tip="One moment..." />
            </div>
          ) : (
            <OwncastPlayer source="/hls/stream.m3u8" online={online} title={streamTitle || name} />
          )}
          {!online && !appState.appLoading && (
            <OfflineBanner
              showsHeader={false}
              streamName={name}
              customText={offlineMessage}
              notificationsEnabled={supportsBrowserNotifications}
              fediverseAccount={fediverseAccount}
              lastLive={lastDisconnectTime}
              onNotifyClick={() => setShowNotifyModal(true)}
              onFollowClick={() => setShowFollowModal(true)}
              className={classnames(styles.offlineBanner, styles.card)}
            />
          )}
        </section>
        {isStreamLive && (
          <section className={styles.statusSection}>
            <Statusbar
              online={online}
              lastConnectTime={lastConnectTime}
              lastDisconnectTime={lastDisconnectTime}
              viewerCount={viewerCount}
              className={styles.statusBar}
            />
          </section>
        )}
        <section className={styles.actionsSection}>
          <ActionButtons
            supportFediverseFeatures={supportFediverseFeatures}
            supportsBrowserNotifications={supportsBrowserNotifications}
            showNotifyReminder={showNotifyReminder}
            setShowNotifyModal={setShowNotifyModal}
            disableNotifyReminderPopup={disableNotifyReminderPopup}
            externalActions={externalActions || []}
            setShowFollowModal={setShowFollowModal}
            externalActionSelected={externalActionSelected}
          />
        </section>

        <Modal
          title="Browser Notifications"
          open={showNotifyModal}
          afterClose={() => disableNotifyReminderPopup()}
          handleCancel={() => disableNotifyReminderPopup()}
        >
          <BrowserNotifyModal />
        </Modal>
          <section className={styles.contentSection}>
            {!name && <Skeleton active loading style={{ marginLeft: '10vw', marginRight: '10vw' }} />}
            {isMobile ? (
              <div className={styles.card}>
                <MobileContent
                  name={name}
                  summary={summary}
                  tags={tags}
                  socialHandles={socialHandles}
                  extraPageContent={extraPageContentForMobile}
                  setShowFollowModal={setShowFollowModal}
                  supportFediverseFeatures={supportFediverseFeatures}
                  online={online}
                />
              </div>
            ) : (
              <div className={classnames(desktopStyles.bottomSectionContent, styles.card)}>
                <DesktopContent
                  name={name}
                  summary={summary}
                  tags={tags}
                  socialHandles={socialHandles}
                  extraPageContent={extraPageContent}
                  setShowFollowModal={setShowFollowModal}
                  supportFediverseFeatures={supportFediverseFeatures}
                />
              </div>
            )}
          </section>
        <div style={{ flex: '1 1' }} />
        <Footer />
      </div>
      {showChat && !isMobile && currentUser && (
        <ChatContainer
          messages={messages}
          usernameToHighlight={currentUser.displayName}
          chatUserId={currentUser.id}
          isModerator={currentUser.isModerator}
          chatAvailable={isChatAvailable}
          showInput={!!currentUser}
          desktop
        />
      )}
      {externalActionToDisplay && (
        <ExternalModal
          externalActionToDisplay={externalActionToDisplay}
          setExternalActionToDisplay={setExternalActionToDisplay}
        />
      )}
      <Modal
        title={`Follow ${name}`}
        open={showFollowModal}
        handleCancel={() => setShowFollowModal(false)}
        width="550px"
      >
        <FollowModal
          account={fediverseAccount}
          name={name}
          handleClose={() => setShowFollowModal(false)}
        />
      </Modal>
        {isMobile && mobileChatAllowed && showChatModal && chatState === ChatState.VISIBLE && (
          <ChatModal
            messages={messages}
            currentUser={currentUser}
            handleClose={() => setShowChatModal(false)}
          />
        )}
        {isMobile && isChatAvailable && !chatDisabledForDevice && (
          <Button
            id="mobile-chat-button"
            type="primary"
            onClick={() => setShowChatModal(true)}
            className={styles.floatingMobileChatModalButton}
          >
            Chat <MessageFilled />
          </Button>
        )}
    </div>
  );
};
