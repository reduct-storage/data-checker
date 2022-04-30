import {Client, BucketSettings, QuotaType} from 'reduct-js';
import crypto from 'crypto';
import md5 from 'md5';

const serverUrl = process.env.REDUCT_STORAGE_URL;
const size30Gb = 32212254720n;

const client = new Client(serverUrl);
const bigBlob = crypto.randomBytes(2 ** 20).toString('hex');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const writer = async (bucket) => {
  while (true) {
    const ts = BigInt(Date.now()) * 1000n;
    const blob = bigBlob.substring(0,
        Math.round(Math.random() * (bigBlob.length - 1)));

    await bucket.write('blobs', blob, ts);
    await bucket.write('md-sums', md5(blob), ts);

    console.log('Write blob with size %s kB',
        Math.round(blob.length / 1024));
    await sleep(100);
  }
};

const reader = async (bucket) => {
  await sleep(1000);
  while (true) {
    const entryInfo = await bucket.getEntryList();
    const info = entryInfo.find(entry => entry.name === 'blobs');

    console.log('Get list');
    const recordList = await bucket.list('md-sums', info.oldestRecord,
        info.latestRecord);
    for (let i = 0; i < recordList.length; ++i) {
      console.log('Read record with ts=%s', recordList[i].timestamp);
      const blob = await bucket.read('blobs', recordList[i].timestamp);
      const mdSum = await bucket.read('md-sums', recordList[i].timestamp);

      if (md5(blob) !== mdSum.toString()) {
        throw Error("Wrong MD5 sum");
      }
    }

    await sleep(100);
  }
};

client.getOrCreateBucket('test-bucket',
    {quotaType: QuotaType.FIFO, quotaSize: size30Gb}).
    then(async (bucket) => {
      await Promise.all([writer(bucket), reader(bucket)]);
    }).
    catch((err) => {
      console.error(err);
      process.exit(-1);
    });
