/**
 * Arquivos de configuração do Firebase FALSOS, usados só no perfil "development-emulators"
 * (app que conversa apenas com os emuladores no computador; veja docs/SETUP.md, Caminho A).
 *
 * Os valores precisam PARECER reais, porque as bibliotecas nativas do Firebase validam o formato:
 * a chave de API tem de começar com "A" e ter exatamente 39 caracteres (`\AA[\w-]{38}\z` no
 * firebase-installations), senão as Cloud Functions falham com "Please set a valid API key".
 */
const FAKE_PROJECT_ID = 'demo-petcare';
const FAKE_API_KEY = 'AIzaSyDemoPetCareEmulatorOnly0000000000';
const FAKE_PROJECT_NUMBER = '000000000000';

/** @param {string} identifier identificador do app (pacote Android) */
function fakeGoogleServicesJson(identifier) {
  return JSON.stringify(
    {
      project_info: {
        project_number: FAKE_PROJECT_NUMBER,
        project_id: FAKE_PROJECT_ID,
        storage_bucket: `${FAKE_PROJECT_ID}.appspot.com`,
      },
      client: [
        {
          client_info: {
            mobilesdk_app_id: `1:${FAKE_PROJECT_NUMBER}:android:0000000000000000`,
            android_client_info: { package_name: identifier },
          },
          oauth_client: [],
          api_key: [{ current_key: FAKE_API_KEY }],
          services: { appinvite_service: { other_platform_oauth_client: [] } },
        },
      ],
      configuration_version: '1',
    },
    null,
    2,
  );
}

/** @param {string} identifier identificador do app (bundle id do iOS) */
function fakeGoogleServiceInfoPlist(identifier) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CLIENT_ID</key><string>${FAKE_PROJECT_NUMBER}-fake.apps.googleusercontent.com</string>
<key>REVERSED_CLIENT_ID</key><string>com.googleusercontent.apps.${FAKE_PROJECT_NUMBER}-fake</string>
<key>API_KEY</key><string>${FAKE_API_KEY}</string>
<key>GCM_SENDER_ID</key><string>${FAKE_PROJECT_NUMBER}</string>
<key>BUNDLE_ID</key><string>${identifier}</string>
<key>PROJECT_ID</key><string>${FAKE_PROJECT_ID}</string>
<key>STORAGE_BUCKET</key><string>${FAKE_PROJECT_ID}.appspot.com</string>
<key>GOOGLE_APP_ID</key><string>1:${FAKE_PROJECT_NUMBER}:ios:0000000000000000</string>
</dict></plist>
`;
}

module.exports = { FAKE_PROJECT_ID, FAKE_API_KEY, fakeGoogleServicesJson, fakeGoogleServiceInfoPlist };
