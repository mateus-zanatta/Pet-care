import {
  FAKE_API_KEY,
  FAKE_PROJECT_ID,
  fakeGoogleServiceInfoPlist,
  fakeGoogleServicesJson,
} from './fakeFirebaseConfig';

describe('configuração Firebase falsa (modo só-emuladores)', () => {
  it('a chave de API tem o formato que o firebase-installations exige (\\AA[\\w-]{38}\\z)', () => {
    expect(FAKE_API_KEY).toMatch(/^A[\w-]{38}$/);
    expect(FAKE_API_KEY).toHaveLength(39);
  });

  it('o google-services.json usa o projeto dos emuladores e o identificador do app', () => {
    const json = JSON.parse(fakeGoogleServicesJson('br.com.exemplo.petcare'));
    expect(json.project_info.project_id).toBe(FAKE_PROJECT_ID);
    expect(FAKE_PROJECT_ID.startsWith('demo-')).toBe(true); // é isso que liga os emuladores sozinho
    expect(json.client[0].client_info.android_client_info.package_name).toBe('br.com.exemplo.petcare');
    expect(json.client[0].api_key[0].current_key).toBe(FAKE_API_KEY);
    expect(json.client[0].client_info.mobilesdk_app_id).toContain(':android:');
  });

  it('o plist do iOS usa a mesma chave e o identificador do app', () => {
    const plist = fakeGoogleServiceInfoPlist('br.com.exemplo.petcare');
    expect(plist).toContain(`<key>API_KEY</key><string>${FAKE_API_KEY}</string>`);
    expect(plist).toContain('<key>BUNDLE_ID</key><string>br.com.exemplo.petcare</string>');
    expect(plist).toContain(`<key>PROJECT_ID</key><string>${FAKE_PROJECT_ID}</string>`);
  });
});
