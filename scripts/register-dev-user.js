/**
 * register-dev-user.js
 * 가장 최근에 로그인한 Firebase Auth 사용자를 Firestore users 컬렉션에 등록합니다.
 * 사용법: node scripts/register-dev-user.js
 */

const admin = require('../functions/node_modules/firebase-admin');

const privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDbLMyY49kwXGkg\nLBSH1Nz2X3tcW6hqvW4d6MY0Q5kOdMjNZMiZeDdwLzsS/Wfl8aGAUFC+xibUSaVm\n3Abwx86FEo/oM5NiLgFnWR/zwvGivlP63armoQDpBGP6VAAW/yd+KYTPeVb94EQH\nsPI4yMnpV3xg7MSyJ0XuPLa7NQ30JpbKlMLSg9L3cvFBdx5IBG4Lyynq6L7wN893\ndCp3/Uk+wTYDpVGey4rkzWeg5WGk7GMYmVegV5GMcK/yrEKe4UWOFChgbC9QLbI0\n6bXedClZoDV9zp+Gb8fQUUNgd6Stdb2YyC9N8z3ojvQkTX8Y2DTTZXDrmszcs/V+\n/XSORVTBAgMBAAECggEAB74Io92n97J1VTlcEqNKmJptXhPFJTDNYcRDXNJxfEZU\nV0BtlKb06w3ZZqA/KhXeeGJTQ+CgkQRhUdBJH3rTbmB7kb6MAN5yrBRaJwSBKthR\n2PgOeDNXoqObe4WO85ZZA7bS602pl3IeEm57VABbH5bN/OeIQunVFCd0ELS8/4hH\nsTf9GMBV3gNWMPfFL0gTiRDNl4Av8CkE8OHyXngh57Zeu4UBMSZk2AU/cRJvO/Fi\ngSFu4bbK9BhqukjHJqfqRqGvecnZsHGRM4x+dWfNshsL19Bsvo5zCxdoIp99iKwO\n58iSAHBw4J4ESYjLEPPceGeFkLjtbP28e5uqMdfLEQKBgQD2DH2A98Hw0Bx4YMI9\nV438ungjFtbcZH3IadWKHr3x8Djd8T1Ri7bc2/r2W9pfrl+V5JfX7muywKOAJuZD\n69dCBS5sPLKHnjSaVjBJaP9xc2v16YCiuH1QdFegJRpK1EAxnYVhkZsOBJMqr6AT\n1tl35bpK7nJZOowzlSpMOZz6mQKBgQDkChD+Oi0fdXxJPWBL33NgOgmhegSyKBl7\nqRs7ALzj0vBsbkC9XnVo3hBX5K1/X5imCbm2kBetkFoVifD7AvGVVmKrFemvjPlv\nxIONZ3KpVM12I08mvmOre88dAQB3Lhic0PU4IViyHApbaiUjMDMpOtEbqNxR6nAP\nier9oLpsaQKBgAw7Trnsly2biu7JEJ7wDVT1CCfmaMQIEuC1sjHtmU+/u3P9HClD\notGT9gPtSQvcpU/UT2AisCPww7AJPwU9YjQcAdTLp6xqRv8tLbVYjOpc7I8LDqQI\nO+KWBg0mCwqRRqewxwK0tFqcC5zhojmaQrFdMEetVu3spS+jSLkFXDJxAoGAJR+S\nZqC36dApfI7WV2O4F6k7GiOQEiS/CUedXDyhg4E6jJxiQ7HV8U19YaGjsQGyCw24\nQwUwJZxDXhBHv8VZ6NLYWzvFAEQ180ENnX6Cxxg8HohfAVKrTSZpsDISjlRdw2Gt\nGgcrtkskUH92LkVRftvJYPRbcaZ1ucHdFI8O6kkCgYEA5JqWwRw5VEpk0/OLGO2M\nHNmZts2b/ZSQ3FVPMbqOHfsoM5iOB34IhsZgRnkmJfInLdD0kYhucpZ8gCI0jqW0\nXgLJRsJw2zeSClvuOy+XokuMLXLqGVvpAYVHLGXG9/E1+5naSD2B2VYFTxFR/ejx\nESI4+i+98m2+L5iGqlD8sDM=\n-----END PRIVATE KEY-----\n";

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: 'bananyang-b9237',
        clientEmail: 'firebase-adminsdk-fbsvc@bananyang-b9237.iam.gserviceaccount.com',
        privateKey,
    }),
});

const auth = admin.auth();
const db = admin.firestore();

async function main() {
    // 1) 최근 로그인 사용자 목록 조회
    const listResult = await auth.listUsers(50);
    const users = listResult.users;

    if (users.length === 0) {
        console.log('Firebase Auth에 등록된 사용자가 없습니다.');
        process.exit(1);
    }

    // 최근 로그인 순으로 정렬
    users.sort((a, b) => {
        const aTime = a.metadata.lastSignInTime ? new Date(a.metadata.lastSignInTime).getTime() : 0;
        const bTime = b.metadata.lastSignInTime ? new Date(b.metadata.lastSignInTime).getTime() : 0;
        return bTime - aTime;
    });

    console.log('\n=== Firebase Auth 사용자 목록 (최근 로그인 순) ===');
    users.forEach((u, i) => {
        console.log(`[${i + 1}] uid: ${u.uid} | email: ${u.email} | 최근 로그인: ${u.metadata.lastSignInTime}`);
    });

    // 2) 가장 최근에 로그인한 사용자 선택
    const target = users[0];
    console.log(`\n→ 등록 대상: ${target.email} (${target.uid})`);

    // 3) Firestore users/{uid} 문서 생성/업데이트
    await db.collection('users').doc(target.uid).set({
        uid: target.uid,
        email: target.email || '',
        hasPurchased: true,
        plan: 'dev',
        purchasedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`✓ Firestore users/${target.uid} 등록 완료!`);
    console.log('  hasPurchased: true, plan: dev');
    console.log('\n앱에서 로그아웃 후 재로그인하면 정상 접근됩니다.');
    process.exit(0);
}

main().catch((err) => {
    console.error('오류:', err.message);
    process.exit(1);
});
