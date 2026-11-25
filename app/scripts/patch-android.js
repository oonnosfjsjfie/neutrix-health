// Applies Neutrix's settings to the Android project that `npx cap add android` generates.
// Run from the app/ folder (GitHub Actions does this on every build).
//  - camera permission (photos of reports, exercise coach)
//  - version number from the build number
//  - signing with the Neutrix key from GitHub secrets (or the debug key if the secrets are missing)
//  - Google sign-in, only when google-services.json is present
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'android');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);
const must = (ok, what) => { if (!ok) { console.error('patch-android: could not ' + what); process.exit(1); } };

// ---------- AndroidManifest: permissions ----------
const manifestPath = 'app/src/main/AndroidManifest.xml';
let manifest = read(manifestPath);
const perms = [
    '<uses-permission android:name="android.permission.CAMERA" />',
    '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    // Neutrix Assistant: talk to it (speech recognition) and it talks back (text to speech)
    '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
    '<queries><intent><action android:name="android.speech.RecognitionService" /></intent><intent><action android:name="android.intent.action.TTS_SERVICE" /></intent></queries>'
];
perms.forEach(p => { if (!manifest.includes(p)) manifest = manifest.replace('</manifest>', `    ${p}\n</manifest>`); });
write(manifestPath, manifest);
console.log('patch-android: camera + microphone permissions added');

// ---------- app/build.gradle: version + signing ----------
const gradlePath = 'app/build.gradle';
let gradle = read(gradlePath);
const run = parseInt(process.env.GITHUB_RUN_NUMBER || '1', 10);
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${100 + run}`).replace(/versionName\s+"[^"]*"/, `versionName "2.${run}"`);
must(/versionCode \d+/.test(gradle), 'set the version');

const signing = `
    signingConfigs {
        neutrix {
            def ks = System.getenv("NEUTRIX_KEYSTORE_FILE")
            if (ks) {
                storeFile file(ks)
                storePassword System.getenv("NEUTRIX_KEYSTORE_PASSWORD")
                keyAlias System.getenv("NEUTRIX_KEY_ALIAS") ?: "neutrix"
                keyPassword System.getenv("NEUTRIX_KEYSTORE_PASSWORD")
            }
        }
    }
`;
if (!gradle.includes('signingConfigs {')) {
    gradle = gradle.replace(/(\n\s*buildTypes\s*\{)/, signing + '$1');
}
if (!gradle.includes('signingConfigs.neutrix :')) gradle = gradle.replace(/(release\s*\{\s*\n)/,`$1            signingConfig System.getenv("NEUTRIX_KEYSTORE_FILE") ? signingConfigs.neutrix : signingConfigs.debug\n`);
must(gradle.includes('signingConfigs.neutrix'), 'add signing');
write(gradlePath, gradle);
console.log('patch-android: version', 100 + run, '/ signing', process.env.NEUTRIX_KEYSTORE_FILE ? 'Neutrix key' : 'debug key');

// ---------- Google sign-in (needs google-services.json from Firebase) ----------
const services = path.join(root, 'app', 'google-services.json');
if (fs.existsSync(services)) {
    const varsPath = 'variables.gradle';
    let vars = read(varsPath);
    if (!vars.includes('rgcfaIncludeGoogle')) {
        vars = vars.replace(/ext\s*\{/, 'ext {\n    rgcfaIncludeGoogle = true');
        write(varsPath, vars);
    }
    console.log('patch-android: Google sign-in on');
} else {
    console.log('patch-android: no google-services.json, Google sign-in off (email sign-in still works)');
}
