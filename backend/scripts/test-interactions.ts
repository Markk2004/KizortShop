import * as nacl from 'tweetnacl';

async function testHttpInteractions() {
  console.log('Testing Discord HTTP Interaction Endpoint with Cryptographic KeyPair...');

  const keyPair = nacl.sign.keyPair();
  const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');
  process.env.DISCORD_OPS_PUBLIC_KEY = publicKeyHex;

  // 1. Test unsigned request -> must be rejected with 401
  const unauthRes = await fetch('http://localhost:4000/api/v1/discord/interactions/ops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 1 }),
  });
  console.log('[Test 1 Unsigned Request] Status:', unauthRes.status, '(Expected: 401)');

  // Helper to send signed request
  const sendSigned = async (body: any) => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify(body);
    const message = Buffer.concat([
      Buffer.from(timestamp, 'utf-8'),
      Buffer.from(rawBody, 'utf-8'),
    ]);
    const sig = Buffer.from(nacl.sign.detached(message, keyPair.secretKey)).toString('hex');

    return await fetch('http://localhost:4000/api/v1/discord/interactions/ops', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-signature-ed25519': sig,
        'x-signature-timestamp': timestamp,
      },
      body: rawBody,
    });
  };

  // 2. Test ping with signature headers -> must return {"type": 1}
  const pingRes = await sendSigned({ type: 1 });
  const pingJson = await pingRes.json().catch(() => ({}));
  console.log('[Test 2 Discord PING] Status:', pingRes.status, 'Response:', JSON.stringify(pingJson));

  // 3. Test slash command /web
  const cmdRes = await sendSigned({
    type: 2,
    data: { name: 'web' },
    member: { roles: [] },
  });
  const cmdJson = await cmdRes.json().catch(() => ({}));
  console.log('[Test 3 /web Command] Type:', cmdJson.type, 'Title:', cmdJson.data?.embeds?.[0]?.title);

  // 4. Test slash command /stock
  const stockRes = await sendSigned({
    type: 2,
    data: { name: 'stock' },
    member: { roles: [] },
  });
  const stockJson = await stockRes.json().catch(() => ({}));
  console.log('[Test 4 /stock Command] Type:', stockJson.type, 'Title:', stockJson.data?.embeds?.[0]?.title);

  // 5. Test slash command /mute
  const muteRes = await sendSigned({
    type: 2,
    data: {
      name: 'mute',
      options: [
        { name: 'alert', value: 'system_watchdog_incident' },
        { name: 'minutes', value: 30 },
      ],
    },
    member: { roles: [] },
  });
  const muteJson = await muteRes.json().catch(() => ({}));
  console.log('[Test 5 /mute Command] Type:', muteJson.type, 'Title:', muteJson.data?.embeds?.[0]?.title);
}

testHttpInteractions().catch(console.error);
