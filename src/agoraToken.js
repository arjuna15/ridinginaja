import { RtcTokenBuilder, RtcRole } from 'agora-token';

export const generateAgoraToken = (appId, appCertificate, channelName, uid) => {
    // RtcTokenBuilder.buildTokenWithUid(appId, appCertificate, channelName, uid, role, tokenExpire, privilegeExpire)
    const role = RtcRole.PUBLISHER;
    const tokenExpire = 24 * 3600; // 24 hours
    const privilegeExpire = 24 * 3600; 

    const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid,
        role,
        tokenExpire,
        privilegeExpire
    );
    return token;
};
