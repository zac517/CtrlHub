import CommunicationManager from './utils/communicationManager';
App({
  onLaunch() {
    CommunicationManager.init();
  }
})
